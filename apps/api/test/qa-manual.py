"""QA de bemo-saas: matriz de roles, aislamiento, concurrencia y flujos completos.

Complementa a los tests de jest, no los reemplaza. Los de jest corren contra la app
montada en memoria; este golpea la API levantada de verdad, con varias sesiones a la
vez, que es donde aparecen las carreras y los cruces entre clínicas.

Levantar el stack y correrlo a mano:

    docker compose up -d
    python3 apps/api/test/qa-manual.py

Crea clínicas nuevas en cada corrida (no ensucia las de demostración) e imprime al
final los hallazgos o "Sin hallazgos". Sale con código 1 si encontró algo.
"""
import json, urllib.request, urllib.error, datetime, threading, random, sys

API = "http://localhost:3000/v1"
HALLAZGOS = []


def call(path, body=None, tok=None, method=None, raw=False):
    data = json.dumps(body).encode() if body is not None else None
    h = {'Content-Type': 'application/json'}
    if tok:
        h['Authorization'] = 'Bearer ' + tok
    r = urllib.request.Request(API + path, data=data,
                               method=method or ('POST' if data else 'GET'), headers=h)
    try:
        with urllib.request.urlopen(r) as x:
            cuerpo = x.read()
            return (json.loads(cuerpo) if cuerpo and not raw else cuerpo), x.status
    except urllib.error.HTTPError as e:
        cuerpo = e.read()
        try:
            return json.loads(cuerpo), e.code
        except Exception:
            return {'_raw': cuerpo.decode()[:200]}, e.code
    except Exception as e:
        return {'_err': str(e)}, 0


def hallazgo(sev, area, que, detalle=''):
    HALLAZGOS.append((sev, area, que, detalle))


def chequear(cond, sev, area, que, detalle=''):
    if not cond:
        hallazgo(sev, area, que, detalle)
    return cond


def nueva_clinica(nombre, mail):
    reg, c = call('/auth/register-clinic', {
        'clinicName': nombre, 'email': mail, 'password': 'probar1234',
        'fullName': 'Admin ' + nombre, 'timezone': 'America/Argentina/Buenos_Aires'})
    return reg


def sumar(admin_tok, mail, rol, nombre):
    inv, c = call('/users/invite', {'email': mail, 'role': rol}, admin_tok)
    if 'inviteToken' not in inv:
        return None
    call('/auth/accept-invite',
         {'token': inv['inviteToken'], 'password': 'probar1234', 'fullName': nombre})
    s, _ = call('/auth/login', {'email': mail, 'password': 'probar1234'})
    return s


def dia_habil(delta=1):
    d = datetime.date.today() + datetime.timedelta(days=delta)
    while d.weekday() > 4:
        d += datetime.timedelta(days=1)
    return d


print('═' * 72)
print('  QA bemo-saas — roles, aislamiento, concurrencia')
print('═' * 72)

# ─────────────────────────────────────────────────────────── montaje
suf = random.randint(10000, 99999)
A = nueva_clinica(f'QA Norte {suf}', f'qa.admin.{suf}@t.test')
admin, admin_id = A['accessToken'], A['user']['id']
p1 = sumar(admin, f'qa.p1.{suf}@t.test', 'professional', 'Dra. Uno')
p2 = sumar(admin, f'qa.p2.{suf}@t.test', 'professional', 'Dr. Dos')
rec = sumar(admin, f'qa.rec.{suf}@t.test', 'receptionist', 'Recepción')
chequear(p1 and p2 and rec, 'ALTO', 'equipo', 'no se pudo armar el equipo completo')
p1t, p1id = p1['accessToken'], p1['user']['id']
p2t, p2id = p2['accessToken'], p2['user']['id']
rect = rec['accessToken']

B = nueva_clinica(f'QA Sur {suf}', f'qa.otra.{suf}@t.test')
otro_admin = B['accessToken']
otro_id = B['user']['id']

sala, _ = call('/rooms', {'name': 'Sala 1'}, admin)
for pid in (p1id, p2id):
    for wd in range(1, 6):
        call('/availability-blocks', {'professionalId': pid, 'weekday': wd,
                                      'startTime': '09:00', 'endTime': '13:00',
                                      'slotMinutes': 30, 'roomId': sala['id']}, admin)
print(f'\nClínica A: admin, 2 profesionales, 1 recepción. Clínica B aparte.')

# ─────────────────────────────────────────── 1 · matriz de permisos
print('\n── 1 · Matriz de permisos ' + '─' * 44)
MATRIZ = [
    # (descripción, método, ruta, body, {rol: esperado})
    ('listar turnos',        'GET',  '/appointments', None,
     {'admin': 200, 'prof': 200, 'recep': 200}),
    ('listar pacientes',     'GET',  '/patients', None,
     {'admin': 200, 'prof': 200, 'recep': 403}),
    ('crear consultorio',    'POST', '/rooms', {'name': 'X'},
     {'admin': 201, 'prof': 403, 'recep': 403}),
    ('invitar al equipo',    'POST', '/users/invite', {'email': f'x{suf}@t.test', 'role': 'professional'},
     {'admin': 201, 'prof': 403, 'recep': 403}),
    ('ver el equipo',        'GET',  '/users', None,
     {'admin': 200, 'prof': 403, 'recep': 403}),
    ('reportes',             'GET',  '/reports/summary?from=2026-01-01&to=2026-12-31', None,
     {'admin': 200, 'prof': 200, 'recep': 403}),
    # El admin que registra la clínica es TAMBIÉN profesional, así que 200 es
    # correcto. Recepción, que no informa, no debe verlos.
    ('preinformes',          'GET',  '/clinical-templates', None,
     {'admin': 200, 'prof': 200, 'recep': 403}),
    ('especialidades clínica (leer)', 'GET', '/clinic/specialties', None,
     {'admin': 200, 'prof': 200, 'recep': 200}),
    ('especialidades clínica (fijar)', 'PUT', '/clinic/specialties', {'specialtyIds': []},
     {'admin': 200, 'prof': 403, 'recep': 403}),
]
TOKENS = {'admin': admin, 'prof': p1t, 'recep': rect}
for desc, met, ruta, body, esperado in MATRIZ:
    linea = []
    for rol, esp in esperado.items():
        _, c = call(ruta, body, TOKENS[rol], met)
        ok = c == esp
        linea.append(f'{rol}:{c}{"" if ok else f"(esperaba {esp})"}')
        if not ok:
            hallazgo('MEDIO', 'permisos', f'{desc} — {rol} devolvió {c}, se esperaba {esp}')
    print(f'  {desc:34} {" · ".join(linea)}')

# ─────────────────────────────────────────── 2 · aislamiento
print('\n── 2 · Aislamiento entre clínicas ' + '─' * 36)
t, c = call('/appointments', {'professionalId': p1id,
                              'startsAt': f'{dia_habil(3)}T09:00:00-03:00',
                              'durationMinutes': 30,
                              'person': {'dni': f'3{suf}111', 'firstName': 'Ais', 'lastName': 'Lado'}}, admin)
turno_a = t.get('id')
_, c = call(f'/appointments/{turno_a}/status', {'status': 'confirmed'}, otro_admin, 'PATCH')
chequear(c == 404, 'ALTO', 'aislamiento', f'la clínica B pudo tocar un turno de A (HTTP {c})')
print(f'  clínica B toca turno de A → {c} (404 esperado)')

ajenos, _ = call('/appointments', tok=otro_admin)
chequear(not any(x['id'] == turno_a for x in ajenos), 'ALTO', 'aislamiento',
         'la clínica B ve turnos de A en el listado')
print(f'  clínica B lista turnos: {len(ajenos)} (no incluye los de A)')

_, c = call(f'/users/{p1id}/specialties', {'specialtyIds': []}, otro_admin, 'PUT')
chequear(c in (400, 403, 404), 'ALTO', 'aislamiento',
         f'la clínica B pudo tocar especialidades de un profesional de A (HTTP {c})')
print(f'  clínica B toca especialidades de A → {c}')

# ─────────────────────────────── 3 · privacidad de la historia
print('\n── 3 · Privacidad de la historia clínica ' + '─' * 30)
pac, _ = call('/patients', {'dni': f'4{suf}222', 'firstName': 'Priv', 'lastName': 'Ado'}, p1t)
pid_pac = pac.get('personId')
_, c = call(f'/patients/{pid_pac}/clinical-entries',
            {'type': 'note', 'content': 'Nota privada de Uno'}, p1t)
print(f'  P1 escribe una entrada → {c}')
e2, c2 = call(f'/patients/{pid_pac}/clinical-entries', tok=p2t)
chequear(c2 != 200 or len(e2) == 0, 'ALTO', 'privacidad',
         f'P2 leyó la historia escrita por P1 ({len(e2) if isinstance(e2, list) else e2})')
print(f'  P2 lee esa historia → {c2}, {len(e2) if isinstance(e2, list) else "—"} entradas')
ea, ca = call(f'/patients/{pid_pac}/clinical-entries', tok=admin)
chequear(ca != 200 or len(ea) == 0, 'ALTO', 'privacidad',
         f'el admin leyó la historia de un profesional ({len(ea) if isinstance(ea, list) else ea})')
print(f'  admin lee esa historia → {ca}, {len(ea) if isinstance(ea, list) else "—"} entradas')
er, cr = call(f'/patients/{pid_pac}/clinical-entries', tok=rect)
chequear(cr == 403, 'ALTO', 'privacidad', f'recepción accedió a la historia (HTTP {cr})')
print(f'  recepción lee esa historia → {cr}')

# ─────────────────────────────────────────── 4 · concurrencia
print('\n── 4 · Uso simultáneo ' + '─' * 48)


def reservar(resultados, i, hora, pid):
    r, c = call('/appointments', {'professionalId': pid,
                                  'startsAt': hora, 'durationMinutes': 30,
                                  'person': {'dni': f'5{suf}{i:03d}', 'firstName': f'Sim{i}',
                                             'lastName': 'Ultaneo'}}, admin)
    resultados[i] = c


d = dia_habil(4)
hora = f'{d}T10:00:00-03:00'
res = {}
hilos = [threading.Thread(target=reservar, args=(res, i, hora, p1id)) for i in range(8)]
[h.start() for h in hilos]
[h.join() for h in hilos]
exitos = sum(1 for v in res.values() if v == 201)
conflictos = sum(1 for v in res.values() if v == 409)
errores = sum(1 for v in res.values() if v >= 500 or v == 0)
print(f'  8 reservas al MISMO slot: {exitos} ok · {conflictos} conflicto · {errores} error')
chequear(exitos == 1, 'ALTO', 'concurrencia', f'{exitos} reservas entraron al mismo slot (debía ser 1)')
chequear(errores == 0, 'ALTO', 'concurrencia', f'{errores} respuestas 5xx bajo concurrencia')

# dos profesionales distintos, misma hora, misma sala
res2 = {}


def reservar_sala(resultados, i, pid):
    r, c = call('/appointments', {'professionalId': pid, 'roomId': sala['id'],
                                  'startsAt': f'{dia_habil(5)}T11:00:00-03:00', 'durationMinutes': 30,
                                  'person': {'dni': f'6{suf}{i:03d}', 'firstName': f'Sala{i}',
                                             'lastName': 'Test'}}, admin)
    resultados[i] = c


hilos = [threading.Thread(target=reservar_sala, args=(res2, i, [p1id, p2id][i % 2])) for i in range(6)]
[h.start() for h in hilos]
[h.join() for h in hilos]
ok2 = sum(1 for v in res2.values() if v == 201)
err2 = sum(1 for v in res2.values() if v >= 500 or v == 0)
print(f'  6 reservas en la MISMA sala/hora (2 profs): {ok2} ok · {err2} error')
chequear(ok2 == 1, 'ALTO', 'concurrencia', f'{ok2} entraron a la misma sala y hora (debía ser 1)')
chequear(err2 == 0, 'ALTO', 'concurrencia', f'{err2} respuestas 5xx en la carrera por la sala')

# cambios de estado simultáneos sobre el mismo turno
res3 = {}


def cambiar(resultados, i, estado):
    _, c = call(f'/appointments/{turno_a}/status', {'status': estado}, admin, 'PATCH')
    resultados[i] = c


estados = ['waiting', 'in_progress', 'completed', 'no_show', 'cancelled', 'confirmed']
hilos = [threading.Thread(target=cambiar, args=(res3, i, estados[i])) for i in range(6)]
[h.start() for h in hilos]
[h.join() for h in hilos]
err3 = sum(1 for v in res3.values() if v >= 500 or v == 0)
print(f'  6 cambios de estado simultáneos: {sorted(res3.values())} · {err3} error')
chequear(err3 == 0, 'ALTO', 'concurrencia', f'{err3} respuestas 5xx cambiando estado en paralelo')

# ─────────────────────────────────────────── 5 · flujos
print('\n── 5 · Flujos completos ' + '─' * 46)
d6 = dia_habil(6)
t6, c6 = call('/appointments', {'professionalId': p1id,
                                'startsAt': f'{d6}T09:00:00-03:00', 'durationMinutes': 30,
                                'person': {'dni': f'7{suf}333', 'firstName': 'Flu', 'lastName': 'Jo'}}, rect)
chequear(c6 == 201, 'ALTO', 'flujo', f'recepción no pudo agendar (HTTP {c6})')
print(f'  recepción agenda → {c6}')
mios, _ = call('/patients', tok=p1t)
chequear(any(x['dni'] == f'7{suf}333' for x in mios), 'ALTO', 'flujo',
         'el paciente agendado por recepción no le figura al profesional')
print(f'  ¿le figura al profesional? {any(x["dni"] == f"7{suf}333" for x in mios)}')

for est in ['waiting', 'in_progress', 'completed']:
    _, c = call(f"/appointments/{t6['id']}/status", {'status': est}, p1t, 'PATCH')
    chequear(c == 200, 'MEDIO', 'flujo', f'transición a {est} devolvió {c}')
print('  ciclo llegó → atender → atendido: ok')

# sobreturno
_, c = call('/appointments', {'professionalId': p1id,
                              'startsAt': f'{d6}T09:00:00-03:00', 'durationMinutes': 30,
                              'person': {'dni': f'8{suf}444', 'firstName': 'Sobre', 'lastName': 'Turno'}}, rect)
chequear(c == 409, 'ALTO', 'sobreturno', f'un turno normal se superpuso sin pedirlo (HTTP {c})')
_, c = call('/appointments', {'professionalId': p1id, 'allowOverbook': True,
                              'startsAt': f'{d6}T09:00:00-03:00', 'durationMinutes': 30,
                              'person': {'dni': f'8{suf}444', 'firstName': 'Sobre', 'lastName': 'Turno'}}, rect)
chequear(c == 201, 'ALTO', 'sobreturno', f'el sobreturno explícito fue rechazado (HTTP {c})')
print(f'  sobreturno: sin pedir 409, pidiéndolo 201')

# ─────────────────────────────────────────── 6 · validaciones
print('\n── 6 · Entradas inválidas ' + '─' * 44)
CASOS = [
    ('turno en el pasado', '/appointments',
     {'professionalId': p1id, 'startsAt': '2020-01-01T10:00:00-03:00', 'durationMinutes': 30,
      'person': {'dni': '11111111', 'firstName': 'A', 'lastName': 'B'}}, [400, 409, 422]),
    ('duración de 9 horas', '/appointments',
     {'professionalId': p1id, 'startsAt': f'{dia_habil(8)}T09:00:00-03:00', 'durationMinutes': 540,
      'person': {'dni': '11111112', 'firstName': 'A', 'lastName': 'B'}}, [400]),
    ('DNI vacío', '/patients', {'dni': '', 'firstName': 'A', 'lastName': 'B'}, [400]),
    ('bloque con fin antes del inicio', '/availability-blocks',
     {'professionalId': p1id, 'weekday': 2, 'startTime': '18:00', 'endTime': '09:00'}, [400, 409, 500]),
    ('rango de bloqueo invertido', '/availability-exceptions',
     {'professionalId': p1id, 'date': str(dia_habil(10)), 'dateTo': str(dia_habil(2)), 'kind': 'remove'}, [400, 500]),
    ('estado inventado', f'/appointments/{turno_a}/status', {'status': 'inventado'}, [400]),
]
for desc, ruta, body, esperados in CASOS:
    met = 'PATCH' if 'status' in ruta else 'POST'
    r, c = call(ruta, body, admin, met)
    ok = c in esperados
    marca = '' if ok else f'  ← esperaba {esperados}'
    if not ok:
        hallazgo('MEDIO' if c < 500 else 'ALTO', 'validación',
                 f'{desc}: devolvió {c}, se esperaba {esperados}')
    if c >= 500:
        hallazgo('ALTO', 'validación', f'{desc} devuelve 500 en vez de un error de negocio')
    print(f'  {desc:34} → {c}{marca}')

# ─────────────────────────────────────────── informe
print('\n' + '═' * 72)
if not HALLAZGOS:
    print('  Sin hallazgos.')
else:
    print(f'  {len(HALLAZGOS)} HALLAZGOS')
    print('═' * 72)
    for sev, area, que, det in sorted(HALLAZGOS, key=lambda x: x[0]):
        print(f'  [{sev:5}] {area:14} {que}')
        if det:
            print(f'{"":24}{det}')
print('═' * 72)
