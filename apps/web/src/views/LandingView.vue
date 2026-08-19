<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import BemoLogo from '../components/ui/BemoLogo.vue';

// La barra arranca sobre el hero oscuro (texto claro, sin fondo) y al scrollear
// cae sobre papel: pasa a fondo sólido y tinta oscura. Con un solo color de
// texto no se leería en los dos.
//
// Va con IntersectionObserver en vez de un listener de 'scroll': no se dispara en
// cada cuadro del scroll, sólo cuando el centinela cruza el borde. El centinela
// es un punto de 1px arriba de todo: mientras se ve, estamos sobre el hero;
// cuando sale de pantalla, la barra pasa a sólida.
const compacto = ref(false);
const centinela = ref<HTMLElement | null>(null);
let observador: IntersectionObserver | null = null;

// La grilla del hero va de 09:00 a 15:00, 48px por hora. La línea de "ahora" se
// ubica con la hora real del visitante; fuera de ese rango no se muestra.
const GRID_START_MIN = 9 * 60;
const PX_POR_HORA = 48;
const ALTO_GRILLA = 288;

const hoyTexto = ref('');
const nowTop = ref<number | null>(null);

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

onMounted(() => {
  if (centinela.value) {
    observador = new IntersectionObserver(
      ([e]) => (compacto.value = !e.isIntersecting),
      { threshold: 0 },
    );
    observador.observe(centinela.value);
  }
  const d = new Date();
  hoyTexto.value = `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
  const top = ((d.getHours() * 60 + d.getMinutes() - GRID_START_MIN) / 60) * PX_POR_HORA;
  nowTop.value = top >= 0 && top <= ALTO_GRILLA ? top : null;
});
onBeforeUnmount(() => observador?.disconnect());

const planes = [
  {
    nombre: 'Agenda',
    para: 'Para el consultorio que hoy trabaja con Excel o con un cuaderno.',
    precio: '$22.000',
    destacado: false,
    cta: 'Empezar la prueba',
    items: [
      { t: 'Agenda multiprofesional sin choques accidentales', soon: false },
      { t: 'Ficha e historia clínica privada', soon: false },
      { t: 'Adjuntos: estudios y radiografías', soon: false },
      { t: 'Reportes de ausentismo y ocupación', soon: false },
      { t: 'Importación desde Excel o CSV', soon: false },
      { t: '1 usuario de recepción', soon: false },
    ],
  },
  {
    nombre: 'Portal',
    para: 'Para el consultorio que vive atendiendo el teléfono.',
    precio: '$35.000',
    destacado: true,
    cta: 'Empezar la prueba',
    items: [
      { t: 'Todo lo del plan Agenda', soon: false },
      { t: 'Reserva online 24/7', soon: true },
      { t: 'El paciente consulta sus turnos e indicaciones', soon: true },
      { t: 'Cancela y reprograma con tus reglas', soon: true },
      { t: '2 usuarios de recepción', soon: false },
    ],
  },
  {
    nombre: 'Automático',
    para: 'Para el que quiere dejar de perseguir pacientes.',
    precio: '$52.000',
    destacado: false,
    cta: 'Hablar con nosotros',
    items: [
      { t: 'Todo lo del plan Portal', soon: false },
      { t: 'Recordatorios por WhatsApp que confirman solos', soon: true },
      { t: 'Sacar turno por WhatsApp con asistente de IA', soon: true },
      { t: 'Lista de espera que ofrece los huecos liberados', soon: true },
      { t: 'Recepción sin límite y soporte prioritario', soon: false },
    ],
  },
];

const tiers = [
  { profs: '1 a 2', desc: '—', ej: '2 → $44.000 por mes' },
  { profs: '3 a 5', desc: '8 %', ej: '4 → $80.960 por mes' },
  { profs: '6 a 9', desc: '12 %', ej: '6 → $116.160 por mes' },
  { profs: '10 o más', desc: '18 %', ej: '10 → $180.400 por mes' },
];

const faqs = [
  {
    q: '¿Cuánto tarda en estar funcionando?',
    a: 'Una tarde. Cargás el equipo, los consultorios y los horarios de atención, importás tus pacientes desde Excel y ya podés agendar. No hay instalación: se usa desde el navegador.',
  },
  {
    q: '¿Cómo se cuentan los profesionales para la factura?',
    a: 'Se cobran los profesionales activos que atienden pacientes. Un administrador que sólo gestiona no se cobra, y si alguien es administrador y profesional a la vez, cuenta una sola vez.',
  },
  {
    q: '¿La recepción puede ver la historia clínica?',
    a: 'No. Recepción agenda turnos y administra los datos de contacto del paciente, pero no accede a la historia clínica. Es una regla del sistema, no una preferencia configurable.',
  },
  {
    q: '¿Qué pasa cuando terminan los 30 días?',
    a: 'Te avisamos antes. Si no seguís, no se cobra nada y podés exportar todos tus datos. No bloqueamos la agenda de un día para el otro.',
  },
];
</script>

<template>
  <div class="lp">
    <!-- Centinela del top: ver el comentario de `compacto` en el script. -->
    <div ref="centinela" class="lp-centinela" aria-hidden="true"></div>
    <header class="lp-nav" :class="compacto ? 'compacto' : 'sobre-hero'">
      <div class="lp-wrap lp-nav-in">
        <a class="lp-brand" href="#top">
          <BemoLogo :tam="32" con-nombre :invertido="!compacto" />
        </a>
        <nav class="lp-links">
          <a href="#agenda">Agenda</a>
          <a href="#ficha">Ficha</a>
          <a href="#seguridad">Seguridad</a>
          <a href="#precios">Precios</a>
        </nav>
        <div class="lp-acciones">
          <RouterLink class="btn secondary sm" to="/login">Entrar</RouterLink>
          <RouterLink class="btn sm" to="/register">Probar</RouterLink>
        </div>
      </div>
    </header>

    <main id="top">
      <!-- HERO -->
      <section class="lp-hero">
        <div class="lp-wrap lp-hero-grid">
          <div>
            <p class="lp-kicker">Para consultorios argentinos</p>
            <h1>La agenda del consultorio, sin choques ni papeles.</h1>
            <p class="lp-lede">
              Turnos, fichas de paciente e historia clínica en un solo lugar. Pensado para
              consultorios chicos de Argentina: se carga en una tarde y lo usa recepción sin
              capacitación.
            </p>
            <div class="lp-cta">
              <RouterLink class="btn lg" to="/register">Empezar los 30 días gratis</RouterLink>
              <a class="btn secondary lg" href="#agenda">Ver cómo funciona</a>
            </div>
            <p class="lp-note">Sin tarjeta. Sin instalación. Tus datos quedan en Argentina.</p>
          </div>

          <div
            class="lp-agenda"
            role="img"
            aria-label="Agenda del día con tres profesionales en columnas y un turno superpuesto marcado como conflicto"
          >
            <div class="lp-agenda-bar">
              <span class="lp-dot" aria-hidden="true"></span>
              <span class="lp-agenda-title">Hoy</span>
              <span class="lp-agenda-date tnum">{{ hoyTexto }}</span>
            </div>
            <div class="lp-cols" aria-hidden="true">
              <div class="lp-colhead"></div>
              <div class="lp-colhead">Dra. Gómez</div>
              <div class="lp-colhead">Dr. Pérez</div>
              <div class="lp-colhead">Dr. Vidal</div>
            </div>
            <div class="lp-body" aria-hidden="true">
              <div class="lp-times">
                <div class="lp-time tnum">09:00</div>
                <div class="lp-time tnum">10:00</div>
                <div class="lp-time tnum">11:00</div>
                <div class="lp-time tnum">12:00</div>
                <div class="lp-time tnum">13:00</div>
                <div class="lp-time tnum">14:00</div>
              </div>
              <div class="lp-col">
                <div class="lp-slot" v-for="n in 6" :key="n"></div>
                <div class="lp-ap" style="top: 0; height: 46px"><b>M. Ruiz</b><span>Control · 45'</span></div>
                <div class="lp-ap" style="top: 72px; height: 46px"><b>J. Alvarez</b><span>Primera vez</span></div>
                <div class="lp-ap" style="top: 192px; height: 70px"><b>L. Sosa</b><span>Control · OSDE</span></div>
              </div>
              <div class="lp-col">
                <div class="lp-slot" v-for="n in 6" :key="n"></div>
                <div class="lp-ap" style="top: 24px; height: 46px"><b>P. Díaz</b><span>Consulta</span></div>
                <div class="lp-ap warn" style="top: 96px; height: 46px">
                  <b>Sobreturno</b><span>Encima de otro, a propósito</span>
                </div>
                <div class="lp-ap" style="top: 168px; height: 46px"><b>C. Ferrer</b><span>Control</span></div>
              </div>
              <div class="lp-col">
                <div class="lp-slot" v-for="n in 6" :key="n"></div>
                <div class="lp-ap" style="top: 48px; height: 70px"><b>R. Molina</b><span>Estudio · 60'</span></div>
                <div class="lp-ap" style="top: 216px; height: 46px"><b>S. Kim</b><span>Control</span></div>
              </div>
              <div v-if="nowTop !== null" class="lp-now" :style="{ top: nowTop + 'px' }"></div>
            </div>
            <div class="lp-agenda-foot">
              Columnas por profesional · los choques se ven antes de guardar
            </div>
          </div>
        </div>
      </section>

      <!-- PROBLEMA -->
      <section>
        <div class="lp-wrap">
          <div class="lp-head">
            <p class="lp-eyebrow">Por qué existe</p>
            <h2>El cuaderno y el Excel funcionan hasta que dejan de funcionar.</h2>
          </div>
          <div class="lp-rows">
            <div class="lp-row">
              <div class="lp-k">El turno doble</div>
              <h3>Dos pacientes a las 10:00</h3>
              <p>
                Pasa cuando dos personas anotan al mismo tiempo. Acá la base de datos lo impide,
                aunque dos recepcionistas aprieten «Confirmar» en el mismo segundo. Si el
                sobreturno es a propósito —una urgencia que hay que encajar— se carga igual,
                pero pidiendo una segunda confirmación y queda marcado como tal.
              </p>
            </div>
            <div class="lp-row">
              <div class="lp-k">La ficha perdida</div>
              <h3>«¿Dónde quedó la historia?»</h3>
              <p>
                La historia clínica vive con el paciente, no en una carpeta. El profesional la
                abre mientras atiende, sin salir de la pantalla del turno.
              </p>
            </div>
            <div class="lp-row">
              <div class="lp-k">El que no vino</div>
              <h3>El ausentismo que nadie mide</h3>
              <p>
                Los turnos perdidos son plata. El reporte de no-show los muestra por profesional,
                por obra social y por franja horaria, para que puedas hacer algo al respecto.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- AGENDA -->
      <section id="agenda">
        <div class="lp-wrap">
          <div class="lp-head">
            <p class="lp-eyebrow">Agenda</p>
            <h2>Recepción tiene que poder agendar mientras habla por teléfono.</h2>
            <p>Ver el día completo de un vistazo y cargar un turno en pocos segundos.</p>
          </div>
          <div class="lp-split">
            <div>
              <h3>Una columna por profesional</h3>
              <p>
                El día entero en una grilla horaria. Los huecos y los choques se ven sin abrir
                nada, que es exactamente lo que una lista de turnos no muestra.
              </p>
              <ul class="lp-checks">
                <li>Reserva por pasos: buscás al paciente por DNI, elegís profesional y recién ahí ves los horarios libres reales.</li>
                <li>Respeta la duración del turno, los horarios de atención y los bloqueos de agenda.</li>
                <li>Si el paciente no existe, lo creás sin salir del flujo.</li>
              </ul>
            </div>
            <div class="card lp-fig">
              <div class="lp-fig-h">Nuevo turno · paso 3 de 4</div>
              <div class="lp-fig-b">
                <p class="lp-fig-cap">Horarios libres · Dra. Gómez · jueves</p>
                <div class="lp-slots">
                  <span class="btn secondary sm">09:00</span>
                  <span class="btn secondary sm">09:45</span>
                  <span class="btn sm">10:30</span>
                  <span class="btn secondary sm">11:15</span>
                  <span class="btn secondary sm" style="opacity: 0.4">12:00</span>
                  <span class="btn secondary sm">15:00</span>
                  <span class="btn secondary sm">15:45</span>
                  <span class="btn secondary sm">16:30</span>
                </div>
                <p class="lp-fig-cap" style="margin-top: 12px">
                  Los ocupados no aparecen. El de las 12:00 cae en un bloqueo de agenda.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- FICHA -->
      <section id="ficha">
        <div class="lp-wrap">
          <div class="lp-split flip">
            <div>
              <h3>La historia clínica es privada. En serio.</h3>
              <p>
                Cada profesional ve la historia que él escribió. No es una casilla que alguien
                puede destildar: la regla vive en la base de datos y se aplica a toda consulta,
                venga de donde venga.
              </p>
              <ul class="lp-checks">
                <li>Compartir en lectura con un colega, con registro de quién accedió.</li>
                <li>Adjuntos: radiografías, estudios y órdenes en la ficha del paciente.</li>
                <li>Importás tu padrón desde Excel o CSV el primer día.</li>
              </ul>
            </div>
            <div class="card lp-fig">
              <div class="lp-fig-h">Ficha · Marta Ruiz</div>
              <div class="lp-fig-b">
                <div class="lp-field"><span>Documento</span><b class="tnum">28.417.905</b></div>
                <div class="lp-field"><span>Obra social</span><b>OSDE 210</b></div>
                <div class="lp-field"><span>Última visita</span><b class="tnum">14/07/2026</b></div>
                <div class="lp-field"><span>Turnos</span><b class="tnum">12 · 1 ausente</b></div>
                <p class="lp-lock">
                  La historia clínica de otros profesionales no se muestra acá, ni siquiera para
                  el administrador de la clínica.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ROLES -->
      <section>
        <div class="lp-wrap">
          <div class="lp-head">
            <p class="lp-eyebrow">Cada uno ve lo suyo</p>
            <h2>Tres personas, tres pantallas distintas.</h2>
            <p>Al entrar, cada rol arranca donde tiene que arrancar. Nadie navega buscando su trabajo.</p>
          </div>
          <div class="lp-roles">
            <div class="card pad">
              <span class="lp-tag">Recepción</span>
              <h3>El calendario del día</h3>
              <p>Columnas por profesional, alta de turnos y de pacientes. No accede a ninguna historia clínica.</p>
            </div>
            <div class="card pad">
              <span class="lp-tag">Profesional</span>
              <h3>Sus turnos y su historia</h3>
              <p>La agenda propia del día y la ficha del paciente abierta al lado mientras atiende.</p>
            </div>
            <div class="card pad">
              <span class="lp-tag">Administrador</span>
              <h3>El consultorio</h3>
              <p>Equipo, consultorios, horarios, reportes de ocupación y ausentismo, y la auditoría de accesos.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- SEGURIDAD -->
      <section id="seguridad">
        <div class="lp-wrap lp-sec-grid">
          <div>
            <p class="lp-eyebrow">Seguridad</p>
            <h2>Son datos de salud. Se tratan como tales.</h2>
            <p class="lp-lede">
              En Argentina la historia clínica es un dato sensible bajo la Ley 25.326. No es una
              función que se agrega después: condiciona cómo está construido el sistema desde el
              primer día.
            </p>
          </div>
          <dl class="lp-facts">
            <div class="lp-fact">
              <dt>Aislamiento entre consultorios</dt>
              <dd>Cada clínica sólo alcanza sus propios datos, con la regla aplicada en la base de datos y no en el código de la aplicación.</dd>
            </div>
            <div class="lp-fact">
              <dt>Auditoría de accesos</dt>
              <dd>Queda registrado quién abrió qué historia y cuándo. Es consultable por el administrador.</dd>
            </div>
            <div class="lp-fact">
              <dt>Backups verificados</dt>
              <dd>Copias automáticas y ensayo de restauración. Un backup que nunca se restauró no es un backup.</dd>
            </div>
            <div class="lp-fact">
              <dt>Tus datos son tuyos</dt>
              <dd>Exportás pacientes y turnos cuando quieras. Si te vas, te llevás todo.</dd>
            </div>
          </dl>
        </div>
      </section>

      <!-- PRECIOS -->
      <section id="precios">
        <div class="lp-wrap">
          <div class="lp-head">
            <p class="lp-eyebrow">Precios</p>
            <h2>Pagás por profesional. Los precios están completos.</h2>
            <p>
              Valores mensuales por profesional activo, con IVA incluido. Un administrador que no
              atiende pacientes no se cobra. 30 días de prueba sin tarjeta.
            </p>
          </div>

          <div class="lp-plans">
            <div v-for="p in planes" :key="p.nombre" class="card pad lp-plan" :class="{ destacado: p.destacado }">
              <div>
                <div class="lp-plan-name">{{ p.nombre }}</div>
                <p class="lp-plan-for">{{ p.para }}</p>
              </div>
              <div class="lp-price"><b class="tnum">{{ p.precio }}</b><span>por profesional / mes</span></div>
              <ul class="lp-plan-items">
                <li v-for="it in p.items" :key="it.t" :class="{ soon: it.soon }">
                  {{ it.t }}
                  <span v-if="it.soon" class="lp-soon">En desarrollo</span>
                </li>
              </ul>
              <RouterLink class="btn" :class="{ secondary: !p.destacado }" to="/register">{{ p.cta }}</RouterLink>
            </div>
          </div>

          <div class="lp-tiers">
            <p class="lp-tiers-cap">Cuantos más profesionales, menor el precio de cada uno. El descuento se aplica solo.</p>
            <div class="lp-scroll">
              <table>
                <thead>
                  <tr><th>Profesionales</th><th>Descuento</th><th>Ejemplo en plan Agenda</th></tr>
                </thead>
                <tbody>
                  <tr v-for="t in tiers" :key="t.profs">
                    <td class="tnum">{{ t.profs }}</td>
                    <td>{{ t.desc }}</td>
                    <td class="tnum">{{ t.ej }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <p class="lp-disclaimer">
            Las funciones marcadas <span class="lp-soon">En desarrollo</span> todavía no están
            disponibles. Preferimos decirlo acá y no en la primera factura.
          </p>
        </div>
      </section>

      <!-- FAQ -->
      <section>
        <div class="lp-wrap">
          <div class="lp-head">
            <p class="lp-eyebrow">Preguntas</p>
            <h2>Lo que más nos preguntan.</h2>
          </div>
          <div class="lp-faq">
            <details v-for="(f, i) in faqs" :key="f.q" :open="i === 0">
              <summary>{{ f.q }}</summary>
              <p>{{ f.a }}</p>
            </details>
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section>
        <div class="lp-wrap">
          <div class="card pad lp-final">
            <h2>Probalo con la agenda de la semana que viene.</h2>
            <p>30 días completos, sin tarjeta. Si en la primera semana no te ahorró tiempo, no sigas.</p>
            <div class="lp-cta">
              <RouterLink class="btn lg" to="/register">Crear mi consultorio</RouterLink>
              <RouterLink class="btn secondary lg" to="/login">Ya tengo cuenta</RouterLink>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer class="lp-foot">
      <div class="lp-wrap lp-foot-in">
        <a class="lp-brand" href="#top"><BemoLogo :tam="24" con-nombre /></a>
        <span class="lp-foot-r">Hecho en Argentina · Ley 25.326</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>

/* ── Top: barra sobre hero oscuro (patrón de Bemo INMO, en teal) ────────────
   El hero se apoya sobre tinta y se mantiene oscuro en los dos temas: es una
   portada, no una superficie de la app. Por eso los tokens de abajo son fijos y
   no se redefinen en modo oscuro. */
.lp {
  --lp-tinta: #14201f;
  --lp-sobre-tinta: #e9efed;
  --lp-sobre-tinta-muted: rgba(233, 239, 237, 0.72);
  --lp-sobre-tinta-accent: #4fa9b1;
}

.lp-centinela { position: absolute; top: 0; height: 1px; width: 1px; }

.lp-nav {
  position: sticky;
  top: 0;
  z-index: 40;
  height: 64px;
  border-bottom: 1px solid transparent;
  background: transparent;
  backdrop-filter: none;
  transition: background var(--t-short), border-color var(--t-short);
}
.lp-nav.compacto {
  background: color-mix(in srgb, var(--bg) 86%, transparent);
  backdrop-filter: blur(10px);
  border-bottom-color: var(--line);
}
.lp-nav-in { height: 64px; }
.lp-acciones { display: flex; align-items: center; gap: var(--s-sm); }

/* Sobre el hero oscuro el texto y los botones se invierten. */
.lp-nav.sobre-hero .lp-links a:not(.btn) { color: var(--lp-sobre-tinta-muted); }
.lp-nav.sobre-hero .lp-links a:not(.btn):hover { color: #fff; }
.lp-nav.sobre-hero .btn.secondary {
  background: rgba(255, 255, 255, 0.07);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.26);
}
.lp-nav.sobre-hero .btn.secondary:hover { background: rgba(255, 255, 255, 0.14); }
.lp-nav.sobre-hero .btn:not(.secondary) {
  background: var(--lp-sobre-tinta-accent);
  border-color: var(--lp-sobre-tinta-accent);
  color: #06201f;
}

/* El hero sube por debajo de la barra para que la barra quede ENCIMA del
   oscuro; el padding devuelve el alto que se comió el margen negativo. */
.lp-hero {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  margin-top: -64px;
  padding: calc(clamp(48px, 7vw, 88px) + 64px) 0 clamp(48px, 7vw, 88px);
  background: var(--lp-tinta);
  color: var(--lp-sobre-tinta);
  border-top: none;
}
.lp-kicker {
  margin: 0 0 var(--s-md);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lp-sobre-tinta-accent);
}
.lp-hero h1 {
  font-size: clamp(36px, 5.4vw, 60px);
  line-height: 1.06;
  max-width: 15ch;
  color: #fff;
  letter-spacing: -0.02em;
}
.lp-hero .lp-lede { color: var(--lp-sobre-tinta-muted); }
.lp-hero .lp-note { color: rgba(233, 239, 237, 0.55); }
.lp-hero .btn.secondary {
  background: rgba(255, 255, 255, 0.07);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.26);
}
.lp-hero .btn.secondary:hover { background: rgba(255, 255, 255, 0.14); }
.lp-hero .btn:not(.secondary) {
  background: var(--lp-sobre-tinta-accent);
  border-color: var(--lp-sobre-tinta-accent);
  color: #06201f;
}
/* Todos los colores, radios y espacios salen de los tokens de design.css. */
.lp { background: var(--bg); color: var(--ink); }
.lp-wrap { max-width: 1120px; margin: 0 auto; padding: 0 var(--s-xl); }
.tnum { font-variant-numeric: tabular-nums; }

h1, h2, h3 { font-family: 'General Sans', sans-serif; font-weight: 600; line-height: 1.15; text-wrap: balance; margin: 0; }
h1 { font-size: 46px; letter-spacing: -0.02em; }
h2 { font-size: 30px; letter-spacing: -0.015em; }
p { margin: 0; }

.lp-eyebrow {
  font-size: 12px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--muted); margin-bottom: var(--s-md);
}
.lp-lede { font-size: 17px; color: var(--muted); max-width: 60ch; margin-top: var(--s-lg); }
.lp-note { margin-top: var(--s-md); font-size: 13px; color: var(--muted); }
.lp-cta { display: flex; gap: var(--s-md); margin-top: var(--s-xl); flex-wrap: wrap; }

/* nav — la anatomía; los colores del top están arriba, con el hero oscuro */
.lp-nav-in { display: flex; align-items: center; gap: var(--s-xl); }
.lp-brand { display: flex; align-items: center; text-decoration: none; color: var(--ink); }
.lp-links { display: flex; gap: var(--s-xl); margin-left: auto; align-items: center; }
.lp-links a:not(.btn) { font-size: 14px; color: var(--muted); text-decoration: none; transition: color 150ms ease-out; }
.lp-links a:not(.btn):hover { color: var(--ink); }

/* hero */
.lp-hero-grid { display: grid; grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr); gap: var(--s-3xl); align-items: center; }
.lp-hero .lp-lede { font-size: 18px; }

/* agenda del hero */
.lp-agenda { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); box-shadow: var(--sh-1); overflow: hidden; }
.lp-agenda-bar { display: flex; align-items: center; gap: var(--s-sm); padding: var(--s-md) var(--s-lg); border-bottom: 1px solid var(--line); }
.lp-agenda-title { font-family: 'General Sans', sans-serif; font-weight: 600; font-size: 14px; }
.lp-agenda-date { font-size: 12px; color: var(--muted); margin-left: auto; }
.lp-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--success); }
.lp-cols { display: grid; grid-template-columns: 46px repeat(3, minmax(0, 1fr)); }
.lp-colhead {
  padding: var(--s-sm) var(--s-md); font-size: 11px; font-weight: 500; color: var(--muted);
  border-bottom: 1px solid var(--line); border-left: 1px solid var(--line);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.lp-colhead:first-child { border-left: none; }
.lp-body { position: relative; display: grid; grid-template-columns: 46px repeat(3, minmax(0, 1fr)); height: 288px; }
.lp-times { display: flex; flex-direction: column; }
.lp-time { height: 48px; font-size: 10px; color: var(--muted); padding: 2px var(--s-sm) 0 0; text-align: right; border-bottom: 1px solid var(--line); }
.lp-col { position: relative; border-left: 1px solid var(--line); }
.lp-slot { height: 48px; border-bottom: 1px solid var(--line); }
.lp-ap {
  position: absolute; left: 3px; right: 3px; border-radius: var(--r-sm); padding: 5px 7px;
  background: var(--teal-tint); border: 1px solid var(--teal-line); border-left: 2px solid var(--teal);
  font-size: 11px; line-height: 1.3; overflow: hidden;
}
.lp-ap b { display: block; font-weight: 500; }
.lp-ap span { color: var(--muted); font-size: 10px; }
.lp-ap.warn { background: var(--warning-tint); border-color: var(--warning-line); border-left-color: var(--warning); }
.lp-now { position: absolute; left: 46px; right: 0; height: 1px; background: var(--teal); z-index: 3; }
.lp-now::before { content: ''; position: absolute; left: -3px; top: -2.5px; width: 6px; height: 6px; border-radius: 50%; background: var(--teal); }
.lp-agenda-foot { padding: var(--s-sm) var(--s-lg); border-top: 1px solid var(--line); font-size: 11px; color: var(--muted); }

/* secciones */
section { padding: var(--s-3xl) 0; border-top: 1px solid var(--line); }
.lp-head { max-width: 62ch; margin-bottom: var(--s-2xl); }
.lp-head p { margin-top: var(--s-md); color: var(--muted); font-size: 16px; }

.lp-rows { border-top: 1px solid var(--line); }
.lp-row {
  display: grid; grid-template-columns: minmax(0, 7rem) minmax(0, 1fr) minmax(0, 1.25fr);
  gap: var(--s-xl); padding: var(--s-xl) 0; border-bottom: 1px solid var(--line); align-items: baseline;
}
.lp-k { font-size: 12px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
.lp-row h3 { font-size: 17px; }
.lp-row p { color: var(--muted); font-size: 14px; }

.lp-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--s-3xl); align-items: center; }
.lp-split h3 { font-size: 22px; margin-bottom: var(--s-md); }
.lp-split > div > p { color: var(--muted); }
.lp-split.flip .lp-fig { order: -1; }
.lp-checks { list-style: none; padding: 0; margin: var(--s-lg) 0 0; display: flex; flex-direction: column; gap: var(--s-sm); }
.lp-checks li { font-size: 14px; padding-left: var(--s-lg); position: relative; }
.lp-checks li::before { content: ''; position: absolute; left: 0; top: 9px; width: 6px; height: 6px; border-radius: 50%; background: var(--teal); }

.lp-fig { padding: 0; overflow: hidden; }
.lp-fig-h { padding: var(--s-md) var(--s-lg); border-bottom: 1px solid var(--line); font-size: 13px; font-weight: 500; }
.lp-fig-b { padding: var(--s-lg); }
.lp-fig-cap { font-size: 12px; color: var(--muted); margin-bottom: var(--s-md); }
.lp-slots { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--s-sm); }
.lp-slots .btn { justify-content: center; pointer-events: none; }
.lp-field { display: flex; justify-content: space-between; gap: var(--s-lg); padding: var(--s-sm) 0; border-bottom: 1px solid var(--line); font-size: 13px; }
.lp-field span { color: var(--muted); }
.lp-lock {
  margin-top: var(--s-lg); padding: var(--s-md); font-size: 12px;
  background: var(--teal-tint); border: 1px solid var(--teal-line); border-radius: var(--r-md);
}

.lp-roles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--s-xl); }
.lp-roles h3 { font-size: 16px; margin-bottom: var(--s-sm); }
.lp-roles p { font-size: 14px; color: var(--muted); }
.lp-tag { font-size: 11px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--teal); display: block; margin-bottom: var(--s-sm); }

.lp-sec-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: var(--s-3xl); align-items: start; }
.lp-facts { border-top: 1px solid var(--line); margin: 0; }
.lp-fact { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: var(--s-lg); padding: var(--s-lg) 0; border-bottom: 1px solid var(--line); }
.lp-fact dt { font-size: 14px; font-weight: 500; }
.lp-fact dd { margin: 0; font-size: 14px; color: var(--muted); }

.lp-plans { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--s-lg); align-items: stretch; }
.lp-plan { display: flex; flex-direction: column; gap: var(--s-md); }
.lp-plan.destacado { border-color: var(--teal); }
.lp-plan-name { font-family: 'General Sans', sans-serif; font-weight: 600; font-size: 18px; }
.lp-plan-for { font-size: 13px; color: var(--muted); min-height: 38px; }
.lp-price { display: flex; align-items: baseline; gap: var(--s-xs); }
.lp-price b { font-family: 'General Sans', sans-serif; font-size: 30px; font-weight: 600; }
.lp-price span { font-size: 13px; color: var(--muted); }
.lp-plan-items { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--s-sm); }
.lp-plan-items li { font-size: 13px; padding-left: var(--s-lg); position: relative; }
.lp-plan-items li::before { content: ''; position: absolute; left: 0; top: 8px; width: 6px; height: 6px; border-radius: 50%; background: var(--teal); }
.lp-plan-items li.soon { color: var(--muted); }
.lp-plan-items li.soon::before { background: var(--muted-2); }
.lp-plan .btn { margin-top: auto; justify-content: center; }
.lp-soon {
  font-size: 10px; font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase;
  color: var(--warning); border: 1px solid var(--warning-line); border-radius: var(--r-sm);
  padding: 0 4px; margin-left: 4px; white-space: nowrap;
}

.lp-tiers { margin-top: var(--s-xl); border: 1px solid var(--line); border-radius: var(--r-lg); background: var(--surface); overflow: hidden; }
.lp-tiers-cap { padding: var(--s-md) var(--s-lg); font-size: 13px; color: var(--muted); border-bottom: 1px solid var(--line); }
.lp-scroll { overflow-x: auto; }
.lp-tiers table { width: 100%; border-collapse: collapse; font-size: 13px; }
.lp-tiers th, .lp-tiers td { text-align: left; padding: var(--s-md) var(--s-lg); border-bottom: 1px solid var(--line); white-space: nowrap; }
.lp-tiers th { font-weight: 500; color: var(--muted); font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; }
.lp-tiers tr:last-child td { border-bottom: none; }
.lp-disclaimer { font-size: 12px; color: var(--muted); margin-top: var(--s-md); }

.lp-faq { border-top: 1px solid var(--line); }
.lp-faq details { border-bottom: 1px solid var(--line); }
.lp-faq summary {
  padding: var(--s-lg) 0; cursor: pointer; font-weight: 500; font-size: 15px; list-style: none;
  display: flex; justify-content: space-between; gap: var(--s-lg); align-items: center;
}
.lp-faq summary::-webkit-details-marker { display: none; }
.lp-faq summary::after { content: '+'; color: var(--muted); font-size: 18px; line-height: 1; }
.lp-faq details[open] summary::after { content: '−'; }
.lp-faq details p { padding: 0 0 var(--s-lg); color: var(--muted); font-size: 14px; max-width: 70ch; }

.lp-final { padding: var(--s-3xl); }
.lp-final h2 { font-size: 26px; }
.lp-final > p { margin-top: var(--s-md); color: var(--muted); max-width: 56ch; }

.lp-foot { border-top: 1px solid var(--line); padding: var(--s-xl) 0; font-size: 13px; color: var(--muted); }
.lp-foot-in { display: flex; gap: var(--s-lg); flex-wrap: wrap; align-items: center; }
.lp-foot-r { margin-left: auto; }

@media (max-width: 900px) {
  .lp-hero-grid, .lp-split, .lp-sec-grid { grid-template-columns: minmax(0, 1fr); gap: var(--s-xl); }
  .lp-split.flip .lp-fig { order: 0; }
  .lp-roles, .lp-plans { grid-template-columns: minmax(0, 1fr); }
  .lp-row { grid-template-columns: minmax(0, 1fr); gap: var(--s-sm); }
  .lp-fact { grid-template-columns: minmax(0, 1fr); gap: var(--s-xs); }
  h1 { font-size: 34px; }
  h2 { font-size: 24px; }
  .lp-links a:not(.btn) { display: none; }
}
</style>
