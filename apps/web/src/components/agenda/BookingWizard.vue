<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { api, errMessage, qs, type ApiError } from '../../lib/api';
import { parsearDni } from '../../lib/dni';
import { DURACIONES, WEEKDAYS_SHORT, addDays, capitalize, fmtDayLong, fmtDayShort, fmtTime, minutesOfDay, todayISO } from '../../lib/format';
import type { Professional, Room, Slot } from '../../lib/types';
import { useUi } from '../../stores/ui';
import UiAvatar from '../ui/UiAvatar.vue';
import UiIcon from '../ui/UiIcon.vue';
import UiModal from '../ui/UiModal.vue';

interface Person {
  id: string;
  dni: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
}

interface Exception {
  id: string;
  date: string;
  kind: 'add' | 'remove';
  start_time: string | null;
}

const props = defineProps<{
  professionals: Professional[];
  rooms: Room[];
  /** Precargados cuando se entra desde un hueco de la grilla. */
  initialProfessionalId?: string | null;
  initialSlot?: Slot | null;
  initialDate?: string;
}>();
const emit = defineEmits<{ close: []; booked: [] }>();

const ui = useUi();

type Step = 'paciente' | 'profesional' | 'horario' | 'confirmar';
const STEPS: { id: Step; label: string }[] = [
  { id: 'paciente', label: 'Paciente' },
  { id: 'profesional', label: 'Profesional' },
  { id: 'horario', label: 'Horario' },
  { id: 'confirmar', label: 'Confirmar' },
];

const step = ref<Step>('paciente');
const saving = ref(false);
const error = ref('');
const conflict = ref(false);

// --- Paso 1: paciente ---
const term = ref('');
const searching = ref(false);
const searched = ref(false);
const matches = ref<Person[]>([]);
const person = reactive({
  id: '', dni: '', firstName: '', lastName: '', phone: '',
  sex: '' as '' | 'F' | 'M' | 'X',
  birthdate: '',
});

/**
 * El lector de DNI se comporta como un teclado: apoyás el documento y "tipea" la
 * cadena entera de un saque, terminando en Enter. Si lo que llegó al campo tiene
 * pinta de escaneo se completa todo solo y se busca; si no, sigue siendo el DNI
 * o el nombre que alguien escribió a mano.
 */
function alEscribirEnBusqueda() {
  const datos = parsearDni(term.value);
  if (!datos) return false;
  term.value = datos.dni;
  Object.assign(person, {
    id: '',
    dni: datos.dni,
    firstName: datos.nombres,
    lastName: datos.apellido,
    sex: datos.sexo ?? '',
    birthdate: datos.fechaNacimiento ?? '',
  });
  ui.success('DNI leído', `${datos.nombres} ${datos.apellido}`);
  return true;
}

/** Enter en el campo: puede venir del lector o de alguien que aprieta Enter. */
function buscarOLeer() {
  // Si era un escaneo, igual se busca: puede que el paciente ya exista.
  alEscribirEnBusqueda();
  search();
}

/** Si el texto tiene letras es un nombre; si no, un DNI. */
const isName = computed(() => /[a-záéíóúñ]/i.test(term.value));

async function search() {
  const value = term.value.trim();
  if (!value) return;
  searching.value = true;
  searched.value = false;
  try {
    matches.value = await api<Person[]>(
      '/persons' + qs(isName.value ? { q: value } : { dni: value }),
    );
    searched.value = true;
    if (matches.value.length === 1) choosePerson(matches.value[0]);
    else if (!matches.value.length && !isName.value) {
      // No está: se precarga el DNI para darlo de alta sin volver a escribirlo.
      Object.assign(person, { id: '', dni: value, firstName: '', lastName: '', phone: '' });
    }
  } catch (e) {
    ui.error('No se pudo buscar', errMessage(e));
  } finally {
    searching.value = false;
  }
}

function choosePerson(p: Person) {
  Object.assign(person, {
    id: p.id,
    dni: p.dni,
    firstName: p.first_name,
    lastName: p.last_name,
    phone: p.phone ?? '',
  });
  matches.value = [];
}

const personReady = computed(
  () => !!person.dni.trim() && !!person.firstName.trim() && !!person.lastName.trim(),
);
const personIsNew = computed(() => personReady.value && !person.id);

// --- Paso 2: profesional ---
const professionalId = ref(props.initialProfessionalId ?? '');
const professional = computed(() =>
  props.professionals.find((p) => p.id === professionalId.value),
);

// --- Paso 3: horario ---
// Ventana móvil de 7 días desde hoy (o desde el día que se estaba mirando).
// Arrancar el lunes de la semana en curso mostraría días que ya pasaron.
const weekStart = ref(maxDate(props.initialDate ?? todayISO(), todayISO()));
const slots = ref<Slot[]>([]);
const exceptions = ref<Exception[]>([]);
const loadingWeek = ref(false);
const selected = ref<Slot | null>(props.initialSlot ?? null);

function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}

const weekDays = computed(() =>
  Array.from({ length: 7 }, (_, i) => addDays(weekStart.value, i)),
);

/** Los huecos ya pasados no se ofrecen: no se puede agendar para atrás. */
const nowIso = new Date().toISOString();
const slotsByDay = computed(() => {
  const map: Record<string, Slot[]> = {};
  for (const day of weekDays.value) map[day] = [];
  for (const s of slots.value) {
    const day = dayOf(s.start);
    if (map[day] && s.start > nowIso) map[day].push(s);
  }
  return map;
});

/** Fecha local (de la clínica) de un instante ISO. */
function dayOf(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(iso));
}

const blockedDays = computed(
  () =>
    new Set(
      exceptions.value
        .filter((e) => e.kind === 'remove' && !e.start_time)
        .map((e) => e.date.slice(0, 10)),
    ),
);

async function loadWeek() {
  if (!professionalId.value) return;
  loadingWeek.value = true;
  try {
    const from = weekStart.value;
    const to = addDays(from, 6);
    const [libres, exc] = await Promise.all([
      api<Slot[]>(
        '/availability' +
          qs({ professionalId: professionalId.value, from, to, includeTaken: '1' }),
      ),
      api<Exception[]>(
        '/availability-exceptions' + qs({ professionalId: professionalId.value, from, to }),
      ).catch(() => [] as Exception[]),
    ]);
    slots.value = libres;
    exceptions.value = exc;
  } catch (e) {
    ui.error('No se pudieron cargar los horarios', errMessage(e));
  } finally {
    loadingWeek.value = false;
  }
}

// Los ocupados se muestran (para poder sobreturnear) pero no son "libres": si se
// cuentan, el pie miente sobre la disponibilidad real de la semana.
const totalSlots = computed(
  () => Object.values(slotsByDay.value).flat().filter((s) => !s.taken).length,
);

// --- Paso 4: confirmar ---
const form = reactive({ roomId: '', reason: '', durationMinutes: 30 });
const REASONS = ['Control', 'Limpieza', 'Primera consulta', 'Urgencia', 'Tratamiento'];

function pickSlot(slot: Slot) {
  selected.value = slot;
  // El consultorio ya está definido en Horarios: se propone ese y no se vuelve a
  // preguntar. Sigue siendo editable por si ese día se atiende en otra sala.
  if (slot.roomId) form.roomId = slot.roomId;
  // La duración por defecto es la del hueco configurado en Horarios.
  form.durationMinutes = Math.max(
    5,
    Math.round((new Date(slot.end).getTime() - new Date(slot.start).getTime()) / 60000),
  );
  step.value = 'confirmar';
}

/**
 * Alta del turno. `allowOverbook` sólo viaja en el segundo intento, después de que
 * el usuario vio el choque y lo aceptó: la primera vez el turno superpuesto se
 * rechaza igual que siempre, así que un choque accidental sigue siendo imposible.
 */
async function confirm(allowOverbook = false) {
  if (!selected.value || !professionalId.value) return;
  saving.value = true;
  error.value = '';
  conflict.value = false;
  try {
    await api('/appointments', {
      method: 'POST',
      body: {
        professionalId: professionalId.value,
        roomId: form.roomId || undefined,
        startsAt: selected.value.start,
        durationMinutes: Number(form.durationMinutes),
        reason: form.reason || undefined,
        allowOverbook: allowOverbook || undefined,
        person: {
          dni: person.dni.trim(),
          firstName: person.firstName.trim(),
          lastName: person.lastName.trim(),
          phone: person.phone.trim() || undefined,
          sex: person.sex || undefined,
          birthdate: person.birthdate || undefined,
        },
      },
    });
    ui.success(
      allowOverbook ? 'Sobreturno agendado' : 'Turno agendado',
      `${person.firstName} ${person.lastName} · ${fmtTime(selected.value.start)}`,
    );
    emit('booked');
  } catch (e) {
    const err = e as ApiError;
    const ocupado =
      err.code === 'PROFESSIONAL_SLOT_TAKEN' || err.code === 'ROOM_SLOT_TAKEN';

    // Ese horario está tomado. Puede ser que alguien se adelantó, o puede ser una
    // urgencia que hay que encajar igual: se pregunta, y recién ahí se fuerza.
    if (ocupado && !allowOverbook) {
      saving.value = false;
      const ok = await ui.confirm({
        title: '¿Cargarlo como sobreturno?',
        desc:
          `${fmtTime(selected.value.start)} ya está ocupado. ` +
          'Si seguís, el turno queda encima del existente y marcado como sobreturno. ' +
          'El profesional va a tener dos pacientes a la misma hora.',
        confirmLabel: 'Sí, es un sobreturno',
        cancelLabel: 'Elegir otro horario',
        danger: true,
      });
      if (ok) return confirm(true);
      conflict.value = true;
      error.value = 'Ese horario ya está ocupado. Elegí otro.';
      await loadWeek();
      return;
    }

    conflict.value = ocupado;
    error.value = errMessage(e, 'No se pudo agendar el turno');
    if (conflict.value) await loadWeek();
  } finally {
    saving.value = false;
  }
}

// --- Navegación ---
const canAdvance = computed(() => {
  if (step.value === 'paciente') return personReady.value;
  if (step.value === 'profesional') return !!professionalId.value;
  return false;
});

function next() {
  if (step.value === 'paciente') {
    // Si ya venía elegido el hueco (entró desde la grilla), no hay nada que preguntar.
    step.value = props.initialSlot && professionalId.value ? 'confirmar' : 'profesional';
  } else if (step.value === 'profesional') {
    step.value = 'horario';
    loadWeek();
  }
}

function goTo(target: Step) {
  const order = STEPS.map((s) => s.id);
  if (order.indexOf(target) < order.indexOf(step.value)) step.value = target;
}

function stepState(id: Step): string {
  const order = STEPS.map((s) => s.id);
  if (id === step.value) return 'current';
  return order.indexOf(id) < order.indexOf(step.value) ? 'done' : '';
}

watch(weekStart, loadWeek);
watch(professionalId, () => {
  selected.value = null;
});

onMounted(() => {
  if (props.initialSlot) {
    form.durationMinutes = Math.max(
      5,
      Math.round(
        (new Date(props.initialSlot.end).getTime() -
          new Date(props.initialSlot.start).getTime()) /
          60000,
      ),
    );
  }
});
</script>

<template>
  <UiModal
    title="Agendar turno"
    subtitle="Buscá al paciente, elegí el profesional y tomá un horario libre"
    size="lg"
    @close="emit('close')"
  >
    <div class="steps mb-lg">
      <template v-for="(s, i) in STEPS" :key="s.id">
        <button type="button" class="step" :class="stepState(s.id)" @click="goTo(s.id)">
          <span class="step-num">
            <UiIcon v-if="stepState(s.id) === 'done'" name="check" size="12" />
            <template v-else>{{ i + 1 }}</template>
          </span>
          {{ s.label }}
        </button>
        <UiIcon v-if="i < STEPS.length - 1" name="chevron-right" size="14" class="step-sep" />
      </template>
    </div>

    <!-- ══ Paso 1 · Paciente ══ -->
    <section v-if="step === 'paciente'">
      <div class="field">
        <label class="label">DNI del paciente</label>
        <div class="row tight nowrap">
          <input
            v-model="term"
            autofocus
            inputmode="numeric"
            placeholder="30111222 — o el nombre, si no lo sabés"
            @keydown.enter.prevent="buscarOLeer"
          />
          <button class="btn secondary" :disabled="searching || !term.trim()" @click="search">
            <span v-if="searching" class="spinner"></span>
            <UiIcon v-else name="search" size="15" />
            Buscar
          </button>
        </div>
      </div>

      <!-- Varios resultados: elegir -->
      <div v-if="matches.length > 1" class="card flush mb-md">
        <div class="card-head"><h3>{{ matches.length }} coincidencias</h3></div>
        <button
          v-for="m in matches"
          :key="m.id"
          class="list-item"
          @click="choosePerson(m)"
        >
          <UiAvatar :name="`${m.first_name} ${m.last_name}`" size="sm" neutral />
          <div class="li-main">
            <div class="li-title">{{ m.first_name }} {{ m.last_name }}</div>
            <div class="li-sub">DNI {{ m.dni }}<template v-if="m.phone"> · {{ m.phone }}</template></div>
          </div>
          <UiIcon name="chevron-right" size="16" style="color:var(--muted-2)" />
        </button>
      </div>

      <!-- Paciente ya existente -->
      <div v-if="person.id" class="panel row tight nowrap" style="align-items:center">
        <UiAvatar :name="`${person.firstName} ${person.lastName}`" size="md" />
        <div style="min-width:0;flex:1">
          <div class="strong">{{ person.firstName }} {{ person.lastName }}</div>
          <div class="muted text-sm">
            DNI {{ person.dni }}<template v-if="person.phone"> · {{ person.phone }}</template>
          </div>
        </div>
        <span class="chip success"><span class="dot"></span>Ya está en el sistema</span>
        <button class="btn ghost sm" @click="Object.assign(person, { id: '', dni: '', firstName: '', lastName: '', phone: '' }); term = ''; searched = false">
          Cambiar
        </button>
      </div>

      <!-- No existe: alta rápida -->
      <div v-else-if="searched && !matches.length">
        <div class="alert warn">
          <UiIcon name="info" size="16" />
          <div>
            No hay nadie con ese {{ isName ? 'nombre' : 'DNI' }}. Cargalo y queda dado de alta
            al confirmar el turno.
          </div>
        </div>
        <div class="grid2">
          <div class="field">
            <label class="label">DNI</label>
            <input v-model="person.dni" inputmode="numeric" required />
          </div>
          <div class="field">
            <label class="label">Teléfono</label>
            <input v-model="person.phone" inputmode="tel" placeholder="11 5555 5555" />
          </div>
        </div>
        <div class="grid2">
          <div class="field">
            <label class="label">Nombre</label>
            <input v-model="person.firstName" required />
          </div>
          <div class="field">
            <label class="label">Apellido</label>
            <input v-model="person.lastName" required />
          </div>
        </div>
      </div>

      <p v-else-if="!searching" class="hint">
        Buscá primero: si el paciente ya vino alguna vez, se reutiliza su ficha.
      </p>
    </section>

    <!-- ══ Paso 2 · Profesional ══ -->
    <section v-else-if="step === 'profesional'">
      <p class="muted text-sm mb-md">¿Con quién se atiende {{ person.firstName }}?</p>
      <div class="grid2">
        <button
          v-for="p in professionals"
          :key="p.id"
          class="panel row tight nowrap"
          style="cursor:pointer;text-align:left"
          :style="professionalId === p.id ? 'border-color:var(--teal);background:var(--teal-tint)' : ''"
          @click="professionalId = p.id"
        >
          <UiAvatar :name="p.full_name" size="md" />
          <span class="strong" style="flex:1;min-width:0">{{ p.full_name }}</span>
          <UiIcon v-if="professionalId === p.id" name="check" size="16" style="color:var(--teal)" />
        </button>
      </div>
      <p v-if="!professionals.length" class="hint">
        No hay profesionales cargados todavía.
      </p>
    </section>

    <!-- ══ Paso 3 · Horario ══ -->
    <section v-else-if="step === 'horario'">
      <div class="row tight mb-md">
        <UiAvatar :name="professional?.full_name" size="sm" />
        <span class="text-sm strong">{{ professional?.full_name }}</span>
        <div class="spacer"></div>
        <div class="segmented" style="padding:2px">
          <button
            aria-label="Semana anterior"
            style="padding:5px 8px"
            :disabled="weekStart <= todayISO()"
            @click="weekStart = addDays(weekStart, -7)"
          >
            <UiIcon name="chevron-left" size="16" />
          </button>
          <button
            aria-label="Semana siguiente"
            style="padding:5px 8px"
            @click="weekStart = addDays(weekStart, 7)"
          >
            <UiIcon name="chevron-right" size="16" />
          </button>
        </div>
        <span class="muted text-sm">
          {{ capitalize(fmtDayShort(weekStart)) }} al {{ fmtDayShort(addDays(weekStart, 6)) }}
        </span>
      </div>

      <div v-if="loadingWeek" class="empty"><span class="spinner"></span></div>

      <template v-else>
        <div class="week-grid">
          <div
            v-for="day in weekDays"
            :key="day"
            class="week-day"
            :class="{ today: day === todayISO() }"
          >
            <div class="week-day-head">
              <div class="week-day-name">{{ WEEKDAYS_SHORT[new Date(day + 'T12:00').getDay()] }}</div>
              <div class="week-day-num">{{ Number(day.slice(8)) }}</div>
            </div>
            <div v-if="slotsByDay[day]?.length" class="week-day-slots">
              <button
                v-for="s in slotsByDay[day]"
                :key="s.start"
                class="slot-pick"
                :class="{ taken: s.taken }"
                :aria-pressed="selected?.start === s.start"
                :title="s.taken ? 'Ocupado · se puede cargar como sobreturno' : 'Libre'"
                @click="pickSlot(s)"
              >
                {{ fmtTime(s.start) }}
              </button>
            </div>
            <div v-else class="week-day-empty">
              {{ blockedDays.has(day) ? 'Bloqueado' : 'Sin horarios' }}
            </div>
          </div>
        </div>

        <p v-if="!totalSlots" class="alert warn mt-lg">
          <UiIcon name="alert-circle" size="16" />
          <span>
            No hay huecos esta semana. Probá la siguiente, o revisá los horarios y bloqueos
            de {{ professional?.full_name }}.
          </span>
        </p>
        <p v-else class="hint">
          {{ totalSlots }} horarios libres esta semana. La duración sale de lo configurado en
          Horarios; podés ajustarla al confirmar.
        </p>
      </template>
    </section>

    <!-- ══ Paso 4 · Confirmar ══ -->
    <section v-else>
      <div class="panel mb-lg">
        <div class="row tight nowrap mb-sm">
          <UiIcon name="user" size="15" style="color:var(--muted)" />
          <span class="text-sm muted">Paciente</span>
          <span class="text-sm strong" style="margin-left:auto">
            {{ person.firstName }} {{ person.lastName }} · DNI {{ person.dni }}
            <span v-if="personIsNew" class="chip" style="margin-left:6px">nuevo</span>
          </span>
        </div>
        <div class="row tight nowrap mb-sm">
          <UiIcon name="users" size="15" style="color:var(--muted)" />
          <span class="text-sm muted">Profesional</span>
          <span class="text-sm strong" style="margin-left:auto">{{ professional?.full_name }}</span>
        </div>
        <div class="row tight nowrap">
          <UiIcon name="calendar" size="15" style="color:var(--muted)" />
          <span class="text-sm muted">Cuándo</span>
          <span class="text-sm strong" style="margin-left:auto">
            {{ selected ? capitalize(fmtDayLong(selected.start)) : '' }} ·
            {{ selected ? fmtTime(selected.start) : '' }}
          </span>
        </div>
      </div>

      <div class="grid2">
        <div class="field">
          <label class="label">Duración</label>
          <select v-model="form.durationMinutes">
            <option v-for="d in DURACIONES" :key="d.valor" :value="d.valor">{{ d.texto }}</option>
          </select>
        </div>
        <div class="field">
          <label class="label">Consultorio</label>
          <select v-model="form.roomId">
            <option value="">Sin asignar</option>
            <option v-for="r in rooms" :key="r.id" :value="r.id">{{ r.name }}</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label class="label">Motivo</label>
        <input v-model="form.reason" list="wizard-reasons" placeholder="Control, limpieza…" />
        <datalist id="wizard-reasons">
          <option v-for="r in REASONS" :key="r" :value="r" />
        </datalist>
      </div>

      <div v-if="error" class="alert err">
        <UiIcon name="alert-circle" size="16" />
        <div>
          <div>{{ error }}</div>
          <button
            v-if="conflict"
            class="btn secondary sm mt-sm"
            @click="step = 'horario'"
          >
            Elegir otro horario
          </button>
        </div>
      </div>
    </section>

    <template #footer>
      <button
        v-if="step !== 'paciente'"
        class="btn secondary"
        style="margin-right:auto"
        @click="step = step === 'confirmar' ? 'horario' : step === 'horario' ? 'profesional' : 'paciente'"
      >
        <UiIcon name="arrow-left" size="15" /> Atrás
      </button>
      <button class="btn secondary" @click="emit('close')">Cancelar</button>
      <button
        v-if="step === 'paciente' || step === 'profesional'"
        class="btn"
        :disabled="!canAdvance"
        @click="next"
      >
        Continuar <UiIcon name="arrow-right" size="15" />
      </button>
      <button v-else-if="step === 'confirmar'" class="btn" :disabled="saving" @click="confirm()">
        <span v-if="saving" class="spinner"></span>
        <UiIcon v-else name="check" size="15" />
        Confirmar turno
      </button>
    </template>
  </UiModal>
</template>
