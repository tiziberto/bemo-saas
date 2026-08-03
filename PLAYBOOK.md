# Playbook — cómo replicar esto en otro proyecto, desde cero

> Lo que funcionó construyendo **bemo** (SaaS multi-tenant de agenda + fichas clínicas,
> Vue 3 + NestJS + Postgres): el método, la estética, los patrones de producto y las
> decisiones técnicas que conviene repetir.
>
> No es documentación de bemo — es la receta. Copiá este archivo al proyecto nuevo y
> seguilo de arriba a abajo.

---

## 0. La idea en tres líneas

1. **Escribí tres documentos antes de escribir código**: qué se construye, para quién, y cómo
   se ve. Después no se discute más: se consultan.
2. **Construí en vertical, no en capas**: cada feature completa incluye migración, API con sus
   permisos, tests y pantalla. Una feature "hecha a medias en el back" no está hecha.
3. **Verificá de verdad**: tests contra la base real, la app corriendo en el navegador, y
   decir en voz alta lo que quedó sin hacer.

---

## 1. Las skills instaladas y cuándo usar cada una

Vienen del plugin **gstack**. Se invocan con `/nombre`.

### Antes de codear
| Skill | Para qué |
|---|---|
| `/office-hours` | Modo YC: te cuestiona la idea, la demanda y el precio. **Corré esto primero.** Es el que te dice si hay que frenar. |
| `/spec` | Convierte una idea vaga en un spec ejecutable en cinco fases. Sale el modelo de datos, los permisos y los criterios de aceptación. |
| `/design-consultation` | Define el sistema de diseño: dirección estética, tipografías, color, espaciado. Genera previews. Termina en un `DESIGN.md`. |

### Revisar el plan antes de construirlo
| Skill | Lente |
|---|---|
| `/plan-ceo-review` | ¿Esto se vende? ¿Es lo más importante ahora? |
| `/plan-eng-review` | ¿El plan es construible? ¿Qué se rompe? |
| `/plan-design-review` | ¿La experiencia tiene sentido? |
| `/plan-devex-review` | ¿Un dev nuevo puede trabajar acá? |
| `/autoplan` | Corre las cuatro seguidas con decisiones automáticas. |

### Mientras construís
| Skill | Para qué |
|---|---|
| `/browse` | Navegador headless para probar la app de verdad. |
| `/qa` | Testea sistemáticamente la app y arregla lo que encuentra. `/qa-only` reporta sin tocar. |
| `/design-review` | Ojo de diseñador: inconsistencias, jerarquía, patrones de slop. |
| `/investigate` | Debugging con causa raíz, no parches. |
| `/health` | Tablero de calidad del código. |
| `/simplify` | Pasada de reuso y simplificación sobre lo que cambiaste. |

### Antes de mergear y de desplegar
| Skill | Para qué |
|---|---|
| `/review` | Revisión previa al merge. |
| `/code-review` | Revisión multi-agente (la versión `ultra` corre en la nube y se factura aparte). |
| `/security-review` | Revisión de seguridad de los cambios de la rama. |
| `/cso` | Modo Chief Security Officer: mira el sistema entero. |
| `/ship` | Merge de la base, tests, bump de versión, CHANGELOG, commit, push, PR. |
| `/land-and-deploy` + `/canary` | Desplegar y vigilar el despliegue. |
| `/retro` | Retrospectiva semanal. |

### Utilitarias que valen la pena
`/context-save` y `/context-restore` (guardar el hilo entre sesiones) · `/learn` (registrar
aprendizajes del proyecto) · `/diagram` (diagramas editables) · `/document-generate` ·
`/make-pdf` · `/guard` y `/freeze` (limitar qué se puede tocar).

**Regla práctica:** las skills no reemplazan el criterio. Si `/qa` dice que está todo bien y
vos viste algo raro, tenés razón vos.

---

## 2. El método

Ocho etapas con **gates**: no se pasa a la siguiente sin cumplir el criterio de salida. Las
de negocio son tan obligatorias como las técnicas.

| # | Etapa | Gate de salida |
|---|---|---|
| 0 | Validación de demanda | Alguien dice "sí, lo pago" con un precio concreto |
| 1 | Fundaciones | `docker compose up` levanta todo en menos de 5 minutos |
| 2 | Auth + tenant + aislamiento | Test que prueba **cero fuga** entre dos cuentas |
| 3 | El núcleo del producto | El caso de uso central funciona sin trabarse |
| 4 | El dato sensible (si lo hay) | Privacidad probada con tests, no con confianza |
| 5 | Frontend | Un humano lo usa sin ayuda |
| 6 | Testing y seguridad | Suite de permisos en verde |
| 7 | Piloto real | Uso diario sostenido |
| 8 | Cobro | Primeros pagos |

**Lo que más se salta y más duele:** la etapa 0 y los gates de la 2, 3 y 4. Si los gates son
tests y no hay tests, no cerraste ningún gate — sólo escribiste código.

### Cómo se construye una feature (siempre igual)

```
migración (tabla + RLS + permisos)
   → servicio con sus reglas de negocio
   → controlador con sus roles
   → tests: camino feliz + cada denegación + aislamiento
   → pantalla
   → verificación en el navegador
   → marcarla como disponible
```

Si te quedás sin tiempo, cortá features enteras — no cortes las capas de una feature.

---

## 3. Los tres documentos que gobiernan el proyecto

**`CLAUDE.md`** (raíz) — las reglas que el agente debe seguir siempre. Corto y mandatorio:

```markdown
# <proyecto> — <una línea de qué es>

<Contexto: para quién, qué stack, qué restricción legal o de negocio manda.>

Documentos clave:
- `docs/spec.md` — spec técnico.
- `DESIGN.md` — sistema de diseño (fuente de verdad visual).

## Design System
Leé DESIGN.md antes de cualquier decisión visual.
Tipografías, colores, espaciado y dirección estética están definidos ahí.
No te desvíes sin aprobación explícita.
```

**`DESIGN.md`** — la fuente de verdad visual. Ver sección 4.

**`docs/roadmap.md`** — las etapas con sus gates, esfuerzo estimado y qué desbloquea cada una.

Sumá un **Decisions Log** al final de `DESIGN.md`: fecha, decisión, razón. Evita
re-litigar lo mismo en tres meses.

---

## 4. La estética

### El método para definirla

1. **Elegí un ancla en una palabra**: lo que el producto tiene que transmitir. En bemo fue
   *"confiable"*. Todo lo demás se subordina.
2. **Mirá a qué tiende tu categoría y andá a contramano** si podés defenderlo. El software
   clínico tiende al pastel alegre para parecer amigable; bemo eligió calma y contención.
3. **Elegí un acento raro y usá neutros para todo lo demás.** Un color, no una paleta.

### El sistema de tokens

Un solo archivo con variables CSS. **Ningún componente define un color.**

```css
:root {
  /* Neutros: el 95% de la interfaz */
  --bg: #fbfbfa;        --surface: #ffffff;   --surface-2: #f5f3ee;  --surface-3: #efece5;
  --line: #e7e5e1;      --line-strong: #d8d5cf;
  --ink: #14201f;       --ink-2: #33403f;     --muted: #5b6766;      --muted-2: #8a9694;

  /* Acento: uno solo */
  --accent: #0e7c86;    --accent-hover: #0b656d;
  --accent-tint: #e1f1f2; --accent-line: #bfe0e2;
  --on-accent: #ffffff;   /* texto sobre acento sólido */

  /* Semánticos, apagados */
  --success: #2e7d5b;  --warning: #b5760a;  --danger: #b23a32;
  /* + su -tint y -line */

  --r-sm: 6px; --r-md: 8px; --r-lg: 12px;   /* nada de redondeo burbuja */
  --s-xs: 4px … --s-3xl: 48px;              /* escala base 4 */
  --sh-1: 0 1px 2px rgba(20,32,31,.05);     /* elevación mínima */
  --ring: 0 0 0 3px rgba(14,124,134,.18);   /* foco visible siempre */
  --t-micro: 90ms; --t-short: 170ms;        /* velocidad = confianza */
}
```

**Modo oscuro**: `[data-theme='dark']` redefine los mismos tokens. Dos detalles que casi todos
se olvidan:
- `--on-accent` pasa a un tono **oscuro**: un acento claro con texto blanco no contrasta.
- Un script inline en el `<head>` aplica el tema **antes del primer pintado**, leyendo
  localStorage y `prefers-color-scheme`. Sin eso hay un destello blanco en cada carga.

### Tipografía

Dos familias: una con carácter para títulos y una neutra para UI. **Evitá Inter y Space
Grotesk como primarias** — son el default de todo y el resultado se ve genérico.
Body 14px, `line-height: 1.5`, `font-variant-numeric: tabular-nums` en cualquier cosa que
tenga números en columna.

### Reglas anti-slop (lo que NO se hace)

- Gradientes, glassmorphism, sombras de colores, bordes brillantes.
- Violeta SaaS como acento.
- Tres tarjetas con íconos dentro de círculos de colores.
- Todo centrado.
- Redondeo uniforme tipo burbuja (juguete = menos confiable).
- Foto de stock, ilustración genérica, blob decorativo.
- Copy con `¡…!` y emoji. Tono declarativo.
- Animaciones de entrada, partículas, tarjetas que flotan.

---

## 5. Inventario de componentes

Estos veinte archivos cubren el 90% de cualquier app de gestión. Construilos una vez.

**Primitivos** — `UiIcon` (SVG inline, sin dependencias), `UiModal` (foco automático al abrir,
Escape cierra, scroll bloqueado), `UiMenu` (dropdown con click-afuera), `UiAvatar` (iniciales,
ignorando títulos como "Dr."), `UiEmpty`, `UiSkeleton`, `StatusChip`, `StatCard`,
`SearchInput`, `PageHeader`, `DatePager`.

**Transversales** — `UiToasts` + store de UI, `UiConfirm` (confirmación como promesa:
`await ui.confirm({...})`), `CommandPalette`.

**Estructura** — `AppShell` (sidebar agrupado por función + topbar + drawer en mobile),
`AuthLayout` (pantalla partida para login/registro/invitación).

**Clases CSS que vale la pena tener**: `.card` `.panel` `.chip` `.btn` (+ `secondary` `ghost`
`danger` `sm` `lg` `block`) `.alert` `.empty` `.sk` `.segmented` `.tabs` `.list-item`
`.timeline` `.meter` `.steps` `.table-wrap` + utilidades de layout (`.row` `.stack` `.grid2/3/4`).

---

## 6. Las funcionalidades transversales

Ninguna es del dominio del producto, pero **todas se notan**.

### Login y sesión
- Pantalla partida: a la izquierda una promesa de 6-8 palabras y tres capacidades reales
  (no adjetivos); a la derecha la tarjeta, máx 400px. Bajo 860px el panel izquierdo **se
  oculta entero**, no se apila.
- Contraseña con ojo, `autocomplete` correcto, autofocus, Enter envía.
- Error en línea con el mensaje real de la API, no un genérico.
- **El refresh token va en cookie httpOnly, nunca en localStorage** (XSS).
- **Renovación automática y single-flight**: si cinco requests fallan a la vez con 401, se
  renueva una sola vez y las cinco esperan. El usuario no se entera.
- Si la renovación falla, ahí sí: cerrar sesión y volver al login con aviso.
- El logout limpia el estado local **primero** y después avisa al servidor. Si esperás a la
  red, el guard del router todavía ve el token viejo y rebota la navegación.
- Guard de rutas con `?next=` para volver adonde estabas.

### Búsqueda (hay tres, y son distintas)
1. **Filtro local** (`SearchInput` + `computed`): para listas que ya están en memoria.
2. **Paleta de comandos** (`⌘K`): navegar, ejecutar acciones y buscar entidades. Navegación
   con flechas, Enter abre, Escape cierra. Es lo que hace que la app se sienta rápida.
3. **Búsqueda contra el servidor con alta inline**: buscás por identificador; si no existe,
   el formulario de alta aparece ahí mismo con el dato ya cargado. Nunca "no encontrado, andá
   a otra pantalla a crearlo".

### Feedback
- **Toasts** para lo que salió bien (con detalle: *"Turno agendado · Marta Silva · 09:30"*).
- **Confirmación modal** para lo destructivo, con la consecuencia escrita.
- **Skeletons** mientras carga (nunca un spinner centrado que salta el layout).
- **Estados vacíos con salida**: título, explicación y el botón que resuelve.
- **Errores recuperables**: si el conflicto se puede resolver, ofrecé la alternativa en el
  mismo lugar (ej.: "ese horario se ocupó" + los horarios que siguen libres).

### Asistentes por pasos
Para cualquier flujo con más de dos decisiones: stepper arriba, un paso por pantalla, "Atrás"
siempre disponible, y los pasos completados clickeables para volver. Si venís de un atajo con
datos ya cargados, **saltá los pasos que ya no hace falta preguntar**.

### Otros que suman más de lo que cuestan
Modo oscuro · atajos de teclado en la pantalla principal (con la ayuda visible al pie) ·
tablas con `sticky` header y scroll horizontal propio · estilos de impresión · export CSV.

---

## 7. Backend: lo que vale la pena repetir

### Multi-tenant con RLS de Postgres, desde el día 1
La app se conecta con un rol **restringido** (no owner) y cada request abre transacción con
`SET LOCAL app.current_tenant_id`. Las policies filtran por ahí. Los guards de aplicación son
defensa en profundidad, no la única línea.

```sql
ALTER TABLE tabla ENABLE ROW LEVEL SECURITY;
CREATE POLICY tabla_tenant ON tabla
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());
GRANT SELECT, INSERT, UPDATE, DELETE ON tabla TO app_role;
```

El signup y el login ocurren **sin** contexto de tenant: van por funciones `SECURITY DEFINER`
acotadas. Lo mismo cualquier webhook, que llega sin sesión.

### Contrato de error único (RFC 9457)
Toda excepción sale con la misma forma y un **código estable** que el front puede leer:

```json
{ "type":"about:blank", "title":"Conflict", "status":409,
  "detail":"El profesional ya tiene un turno en esa franja",
  "code":"PROFESSIONAL_SLOT_TAKEN", "instance":"/v1/appointments" }
```

### Reglas de negocio en la base, no en el código
El anti-doble-turno es un constraint `EXCLUDE` con `btree_gist`, no un `SELECT` previo. Ningún
chequeo de aplicación sobrevive a dos requests simultáneos.

Y si usás constraints de exclusión: **serializá con un advisory lock** antes de tocarlos. Con
varias transacciones esperándose, el grafo de esperas puede ciclar y Postgres mata una con
deadlock — que el cliente ve como un 500. Además, reintentá los errores transitorios
(`40001`, `40P01`) en la capa de transacción.

### Seguridad que no se ve pero se nota
- **Validación de entorno al arrancar**: si falta un secreto, la app no levanta. Nunca un
  default inseguro.
- **Rotación de refresh tokens con detección de reuso**: si aparece un token ya usado,
  alguien tiene una copia → se revocan **todas** las sesiones de ese usuario.
- **helmet**, límite explícito de body, docs cerrados en producción.
- **Los 500 se registran.** Un error que sólo se serializa al cliente es un error invisible.
- **Rechazá campos que no están en el contrato** (`forbidNonWhitelisted`): un cliente que
  manda `role: "admin"` se entera, y vos también.
- **Auditoría append-only** de cada acceso a datos sensibles, incluidas las denegaciones. El
  rol de la app tiene INSERT y SELECT, pero no UPDATE ni DELETE.

### Cuando algo es privado por diseño y aun así necesitás el número
Si RLS impide que un admin vea los datos de otro usuario, no aflojes la policy: exponé una
función `SECURITY DEFINER` que devuelva **sólo agregados** y se acote sola con el tenant del
que pregunta.

---

## 8. Verificación

### Tests que valen
Levantá la **app real** (mismo módulo, mismos pipes, mismo filtro de errores) contra una base
de test que se crea y se migra sola con **las mismas migraciones de producción**. Un schema
armado a mano para los tests prueba otra cosa.

Los cuatro que encuentran bugs de verdad:

1. **Matriz de permisos table-driven**: cada rol × cada endpoint, incluido "sin token". Sumar
   una fila cuando agregás un endpoint es más barato que enterarte en producción.
2. **Aislamiento entre cuentas**: dos tenants sembrados, cero fuga en todos los list/get, y
   que un update cruzado dé 404 y no un 200 vacío.
3. **Concurrencia**: N requests en paralelo a la misma operación exclusiva → exactamente un
   éxito, ningún 5xx. Este encontró el deadlock.
4. **Bordes de zona horaria**: un registro a las 23:30 tiene que caer en el día que el usuario
   cree, no en el del servidor.

### QA real
Corré la app y usala: crear, buscar, romper a propósito. Poné un token vencido a mano y mirá
si la sesión se recupera sola. Probá el rol más limitado y confirmá que no ve de más.

### Backups (si hay datos que importan)
Un script que hace el dump **y lo verifica**, y otro que restaura con `--yes` obligatorio.
Probá el restore contra una base de ensayo. Un backup que nunca se restauró no es un backup.

---

## 9. Honestidad de producto

Cuando mostrás algo que todavía no funciona —una pantalla de precios, un plan futuro— la regla
es: **no simules datos, simulá el futuro.**

- Cada capacidad del catálogo lleva `status: 'available' | 'soon'`. La UI muestra "En
  desarrollo" en vez de un ✓. Cuando la terminás, cambiás el estado y la pantalla se actualiza
  sola.
- El indicador de demo viaja **en el dato** (`demo: true`), no hardcodeado: cuando llegue la
  API real, los avisos desaparecen solos.
- Estados vacíos reales donde todavía no hay datos, con el texto que van a tener.
- Controles reales **deshabilitados** con una nota de cuándo llegan. Un botón apagado y
  explicado se lee como roadmap; uno ausente se lee como olvido.
- **Nunca**: facturas falsas, `Visa •••• 4242`, "se debitará automáticamente".

---

## 10. Errores que cometí acá — no los repitas

1. **Construir cinco etapas sin cerrar la etapa 0.** El test de la billetera seguía pendiente
   con el producto casi terminado.
2. **Gates que son tests, sin tests.** Tres etapas "cerradas" que en realidad nunca se
   verificaron. La suite las cerró retroactivamente y encontró tres bugs reales.
3. **Tablas que nadie usa.** `availability_exceptions` existía en la base desde etapa 3 y
   ningún código la leía: la feature "bloqueos de agenda" no existía en la práctica. Si creás
   una tabla, creá el endpoint y la UI en el mismo movimiento, o no la crees.
4. **Arreglar el síntoma.** El primer arreglo del deadlock fue un reintento: bajó la frecuencia
   pero no lo eliminó. El arreglo real fue que el ciclo no pudiera existir.
5. **Hacer asíncrono algo que no lo necesita.** Poner un `await` de red en el logout rompió
   el redirect: el guard veía el token viejo.
6. **Confiar en un test flaky.** Falló una vez de cada cuatro y casi lo atribuyo a "la
   máquina". Era un 500 real bajo contención.
7. **Instalar dependencias sólo en el host** cuando el contenedor tiene su propio
   `node_modules` en un volumen. Se rompe al reiniciar, no al instalar.

---

## 11. Arranque de un proyecto nuevo

```
□ /office-hours                        ← antes de escribir una línea
□ /spec                                → docs/spec.md
□ /design-consultation                 → DESIGN.md
□ CLAUDE.md apuntando a los dos anteriores
□ docs/roadmap.md con etapas y gates
□ Docker Compose: db + api + web, con healthchecks
□ Migraciones con auto-run en dev + seed de datos demo
□ Rol de base restringido + RLS en la primera migración
□ Contrato de error + prefijo de versión (/v1) + validación de entorno
□ Sistema de tokens CSS + modo oscuro + script anti-flash
□ Los ~20 componentes de la sección 5
□ Login + refresh automático + guard de rutas
□ jest + supertest contra Postgres real, en CI desde el primer día
□ gitleaks en pre-commit y en CI
□ Dockerfile de producción (multi-stage, sin devDeps, usuario sin privilegios)
□ Script de backup + restore probado
```

### Prompt para pegar en el proyecto nuevo

```
Vamos a construir <PRODUCTO>: <una línea>. Stack: <STACK>.

Trabajamos así:
- Antes de cualquier decisión visual, leé DESIGN.md. Es la fuente de verdad.
- Cada feature va completa: migración con RLS, servicio, controlador con roles,
  tests (camino feliz + cada denegación + aislamiento entre cuentas) y pantalla.
  Nada de features a medias en el back.
- Verificá de verdad: corré los tests contra la base real y usá la app en el
  navegador antes de decirme que algo funciona.
- Si algo queda sin hacer o no lo pudiste probar, decímelo explícitamente.
- Nada de datos falsos en la UI. Lo que no existe se marca como "en desarrollo".

Empezá por preguntarme lo que te falte para escribir el spec.
```
