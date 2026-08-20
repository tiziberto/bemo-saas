<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import AttachmentsPanel from '../components/patients/AttachmentsPanel.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import SearchInput from '../components/ui/SearchInput.vue';
import UiAvatar from '../components/ui/UiAvatar.vue';
import UiEmpty from '../components/ui/UiEmpty.vue';
import UiIcon from '../components/ui/UiIcon.vue';
import UiModal from '../components/ui/UiModal.vue';
import UiSkeleton from '../components/ui/UiSkeleton.vue';
import { api, errMessage } from '../lib/api';
import { parsearDni } from '../lib/dni';
import { ENTRY_TYPE, fmtDate, fullName, waLink } from '../lib/format';
import type { ClinicalEntry, Patient, Professional } from '../lib/types';
import { useAuth } from '../stores/auth';
import { useUi } from '../stores/ui';

const auth = useAuth();
const ui = useUi();
const route = useRoute();

/**
 * Al marcar un turno como atendido el modal manda acá con `?id=<paciente>&nueva=1`.
 * Lo que sigue es escribir la evolución, así que se deja el cursor puesto en el
 * formulario en vez de obligar a buscarlo en la página.
 */
/**
 * Modo atención: se llega desde "Atender" en la agenda, con el paciente ya
 * elegido. Se esconde la lista de pacientes porque no hay nada que elegir —
 * el paciente está sentado adelante— y así la historia se lee sin competencia.
 */
const modoAtencion = ref(false);

function salirDeAtencion() {
  modoAtencion.value = false;
  router.replace({ query: {} });
}

// ── Preinformes ─────────────────────────────────────────────────────────────
interface Plantilla { id: string; title: string; type: string; content: string; own: boolean }
const plantillas = ref<Plantilla[]>([]);
const plantillaElegida = ref('');
const plantillasSistema = computed(() => plantillas.value.filter((p) => !p.own));
const plantillasPropias = computed(() => plantillas.value.filter((p) => p.own));

/**
 * Inserta el preinforme al final de lo escrito, nunca lo pisa: alguien puede
 * haber empezado a escribir y después acordarse de la plantilla.
 */
function insertarPlantilla() {
  const p = plantillas.value.find((x) => x.id === plantillaElegida.value);
  // El reset va en el tick siguiente. Hacerlo acá deja el ref igual que antes
  // desde el punto de vista de Vue —'' → elegido → '' en el mismo handler— así
  // que no repinta el select, queda mostrando la opción elegida y volver a
  // elegir la misma no dispara `change`.
  nextTick(() => (plantillaElegida.value = ''));
  if (!p) return;
  entry.type = p.type;
  entry.content = entry.content.trim() ? `${entry.content.trimEnd()}\n\n${p.content}` : p.content;
  requestAnimationFrame(() => entryBox.value?.focus());
}

const entryBox = ref<HTMLTextAreaElement | null>(null);
function enfocarNuevaEntrada() {
  if (!route.query.nueva) return;
  modoAtencion.value = true;
  requestAnimationFrame(() => {
    entryBox.value?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    entryBox.value?.focus();
  });
}
const router = useRouter();

const patients = ref<Patient[]>([]);
const professionals = ref<Professional[]>([]);
const selected = ref<Patient | null>(null);
const entries = ref<ClinicalEntry[]>([]);
const loading = ref(true);
const loadingHistory = ref(false);
const error = ref('');
const historyError = ref('');

const search = ref('');
const scope = ref<'todos' | 'mios' | 'compartidos'>('todos');
const tab = ref<'historia' | 'estudios' | 'datos' | 'compartir'>('historia');
const typeFilter = ref('');

const showNew = ref(false);
const showImport = ref(false);
const savingNew = ref(false);
const newPatient = reactive({
  dni: '', firstName: '', lastName: '', phone: '',
  sex: '' as '' | 'F' | 'M' | 'X',
  birthdate: '',
});

/**
 * El lector de DNI escribe la cadena entera en el campo. Si lo que hay tiene
 * pinta de escaneo, se reparte en los campos que corresponden; si no, queda el
 * DNI tal cual lo tipearon.
 */
function leerDni() {
  const datos = parsearDni(newPatient.dni);
  if (!datos) return;
  Object.assign(newPatient, {
    dni: datos.dni,
    firstName: datos.nombres,
    lastName: datos.apellido,
    sex: datos.sexo ?? '',
    birthdate: datos.fechaNacimiento ?? '',
  });
  ui.success('DNI leído', `${datos.nombres} ${datos.apellido}`);
}
const importCsv = reactive({ text: '', busy: false });

const entry = reactive({ type: 'note', content: '', entryDate: '' });
const savingEntry = ref(false);
const shareWith = ref('');
const sharing = ref(false);

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase();
  return patients.value.filter((p) => {
    if (scope.value === 'mios' && !p.owned) return false;
    if (scope.value === 'compartidos' && p.owned) return false;
    if (!term) return true;
    return (
      fullName(p).toLowerCase().includes(term) ||
      p.dni.includes(term) ||
      (p.phone ?? '').includes(term)
    );
  });
});

const visibleEntries = computed(() =>
  typeFilter.value ? entries.value.filter((e) => e.type === typeFilter.value) : entries.value,
);

const shareTargets = computed(() =>
  professionals.value.filter((p) => p.id !== auth.user?.id),
);

async function loadPatients() {
  loading.value = true;
  error.value = '';
  try {
    patients.value = await api<Patient[]>('/patients');
    const wanted = route.query.id as string | undefined;
    const target = wanted ? patients.value.find((p) => p.id === wanted) : null;
    if (target) select(target);
  } catch (e) {
    error.value = errMessage(e, 'No se pudieron cargar los pacientes');
  } finally {
    loading.value = false;
  }
}

async function select(p: Patient) {
  selected.value = p;
  tab.value = 'historia';
  entries.value = [];
  historyError.value = '';
  loadingHistory.value = true;
  router.replace({ query: { ...route.query, id: p.id } });
  try {
    entries.value = await api<ClinicalEntry[]>(`/patients/${p.id}/clinical-entries`);
    enfocarNuevaEntrada();
  } catch (e) {
    historyError.value = errMessage(e, 'No se pudo abrir la historia clínica');
  } finally {
    loadingHistory.value = false;
  }
}

async function createPatient() {
  savingNew.value = true;
  try {
    await api('/patients', {
      method: 'POST',
      body: {
        dni: newPatient.dni.trim(),
        firstName: newPatient.firstName.trim(),
        lastName: newPatient.lastName.trim(),
        phone: newPatient.phone.trim() || undefined,
        sex: newPatient.sex || undefined,
        birthdate: newPatient.birthdate || undefined,
      },
    });
    ui.success('Paciente agregado', `${newPatient.firstName} ${newPatient.lastName}`);
    Object.assign(newPatient, { dni: '', firstName: '', lastName: '', phone: '' });
    showNew.value = false;
    await loadPatients();
  } catch (e) {
    ui.error('No se pudo agregar', errMessage(e));
  } finally {
    savingNew.value = false;
  }
}

async function onCsvFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) importCsv.text = await file.text();
}

async function runImport() {
  importCsv.busy = true;
  try {
    const r = await api<{ imported: number; errors: number }>('/patients/import', {
      method: 'POST',
      body: { csv: importCsv.text },
    });
    ui.success(
      `${r.imported} paciente${r.imported === 1 ? '' : 's'} importado${r.imported === 1 ? '' : 's'}`,
      r.errors ? `${r.errors} fila(s) con problemas` : undefined,
    );
    importCsv.text = '';
    showImport.value = false;
    await loadPatients();
  } catch (e) {
    ui.error('No se pudo importar', errMessage(e));
  } finally {
    importCsv.busy = false;
  }
}

async function addEntry() {
  if (!selected.value) return;
  savingEntry.value = true;
  try {
    await api(`/patients/${selected.value.id}/clinical-entries`, {
      method: 'POST',
      body: {
        type: entry.type,
        content: entry.content,
        entryDate: entry.entryDate || undefined,
      },
    });
    entry.content = '';
    entry.entryDate = '';
    entries.value = await api(`/patients/${selected.value.id}/clinical-entries`);
    ui.success('Entrada guardada');
  } catch (e) {
    ui.error('No se pudo guardar', errMessage(e));
  } finally {
    savingEntry.value = false;
  }
}

async function share() {
  if (!selected.value || !shareWith.value) return;
  const target = professionals.value.find((p) => p.id === shareWith.value);
  const ok = await ui.confirm({
    title: '¿Compartir la historia clínica?',
    desc: `${target?.full_name} va a poder leer (no editar) la historia de ${fullName(selected.value)}. Queda registrado el consentimiento y la auditoría.`,
    confirmLabel: 'Compartir',
  });
  if (!ok) return;
  sharing.value = true;
  try {
    await api(`/patients/${selected.value.id}/shares`, {
      method: 'POST',
      body: { sharedWithProfessionalId: shareWith.value },
    });
    shareWith.value = '';
    ui.success('Paciente compartido', 'Acceso de sólo lectura.');
  } catch (e) {
    ui.error('No se pudo compartir', errMessage(e));
  } finally {
    sharing.value = false;
  }
}

watch(
  () => route.query.nuevo,
  (v) => {
    if (v === '1') showNew.value = true;
  },
  { immediate: true },
);

onMounted(async () => {
  if (auth.isProfessional) {
    api<Plantilla[]>('/clinical-templates')
      .then((r) => (plantillas.value = r))
      .catch(() => (plantillas.value = []));
  }
  await loadPatients();
  professionals.value = await api<Professional[]>('/users/professionals').catch(() => []);
});
</script>

<template>
  <AppShell width="wide">
    <PageHeader
      title="Pacientes"
      :subtitle="`${patients.length} en tu lista · ${patients.filter((p) => !p.owned).length} compartidos con vos`"
    >
      <template #actions>
        <button class="btn secondary sm" @click="showImport = true">
          <UiIcon name="upload" size="15" /> Importar
        </button>
        <button class="btn sm" @click="showNew = true">
          <UiIcon name="user-plus" size="15" /> Nuevo paciente
        </button>
      </template>
    </PageHeader>

    <div v-if="modoAtencion" class="alert info atendiendo">
      <UiIcon name="user" size="16" />
      <span class="spacer">
        Estás atendiendo. Se muestra sólo este paciente para que la historia se lea sin ruido.
      </span>
      <button class="btn ghost sm" @click="salirDeAtencion">Ver todos los pacientes</button>
    </div>

    <div v-if="error" class="alert err"><UiIcon name="alert-circle" size="16" />{{ error }}</div>

    <div class="split" :class="{ 'solo-paciente': modoAtencion }">
      <!-- Columna izquierda: buscar y elegir. En modo atención no va: el
           profesional está con un paciente adelante, no eligiendo de una lista. -->
      <div v-if="!modoAtencion" class="card flush" style="position:sticky;top:76px">
        <div class="card-body" style="padding:12px">
          <SearchInput v-model="search" placeholder="Nombre, DNI o teléfono…" />
          <div class="segmented mt-sm w-full" style="display:flex">
            <button style="flex:1" :aria-pressed="scope === 'todos'" @click="scope = 'todos'">Todos</button>
            <button style="flex:1" :aria-pressed="scope === 'mios'" @click="scope = 'mios'">Míos</button>
            <button style="flex:1" :aria-pressed="scope === 'compartidos'" @click="scope = 'compartidos'">Compartidos</button>
          </div>
        </div>

        <UiSkeleton v-if="loading" :rows="5" avatar />

        <div v-else-if="filtered.length" class="scroll-y" style="max-height:calc(100vh - 260px)">
          <button
            v-for="p in filtered"
            :key="p.id"
            class="list-item"
            :aria-current="selected?.id === p.id"
            @click="select(p)"
          >
            <UiAvatar :name="fullName(p)" size="sm" :neutral="!p.owned" />
            <div class="li-main">
              <div class="li-title">{{ fullName(p) }}</div>
              <div class="li-sub">DNI {{ p.dni }}</div>
            </div>
            <span v-if="!p.owned" class="chip gray">compartido</span>
          </button>
        </div>

        <UiEmpty
          v-else
          icon="users"
          :title="search ? 'Sin coincidencias' : 'Todavía no tenés pacientes'"
          :desc="search ? 'Probá con otro nombre o DNI.' : 'Agregalos de a uno o importá tu planilla actual.'"
        >
          <button v-if="!search" class="btn sm" @click="showNew = true">Agregar el primero</button>
        </UiEmpty>
      </div>

      <!-- Columna derecha: ficha -->
      <div v-if="selected" class="card flush">
        <div class="card-head" style="align-items:flex-start">
          <UiAvatar :name="fullName(selected)" size="lg" :neutral="!selected.owned" />
          <div style="min-width:0">
            <h2>{{ fullName(selected) }}</h2>
            <p class="muted text-sm">
              DNI {{ selected.dni }}
              <template v-if="selected.phone"> · {{ selected.phone }}</template>
            </p>
          </div>
          <div class="row tight" style="margin-left:auto">
            <a v-if="selected.phone" class="btn secondary sm" :href="`tel:${selected.phone}`">
              <UiIcon name="phone" size="15" /> Llamar
            </a>
            <a
              v-if="waLink(selected.phone)"
              class="btn secondary sm"
              :href="waLink(selected.phone)!"
              target="_blank"
              rel="noopener"
            >
              <UiIcon name="whatsapp" size="15" /> WhatsApp
            </a>
          </div>
        </div>

        <div class="tabs" style="padding:0 var(--s-lg)">
          <button :aria-selected="tab === 'historia'" @click="tab = 'historia'">Historia clínica</button>
          <button :aria-selected="tab === 'estudios'" @click="tab = 'estudios'">Estudios</button>
          <button :aria-selected="tab === 'datos'" @click="tab = 'datos'">Datos</button>
          <button v-if="selected.owned" :aria-selected="tab === 'compartir'" @click="tab = 'compartir'">
            Compartir
          </button>
        </div>

        <!-- Historia -->
        <div v-if="tab === 'historia'" class="card-body">
          <div v-if="!selected.owned" class="alert info">
            <UiIcon name="lock" size="16" />
            <div>
              Esta historia está <strong>compartida con vos en sólo lectura</strong>. No podés
              agregar ni editar entradas.
            </div>
          </div>

          <div v-if="historyError" class="alert err">
            <UiIcon name="shield" size="16" />{{ historyError }}
          </div>

          <div class="row tight mb-lg">
            <button
              class="chip"
              :class="{ gray: typeFilter !== '' }"
              style="cursor:pointer"
              @click="typeFilter = ''"
            >
              Todo ({{ entries.length }})
            </button>
            <button
              v-for="(meta, key) in ENTRY_TYPE"
              :key="key"
              class="chip"
              :class="{ gray: typeFilter !== key }"
              style="cursor:pointer"
              @click="typeFilter = typeFilter === key ? '' : key"
            >
              {{ meta.label }} ({{ entries.filter((e) => e.type === key).length }})
            </button>
          </div>

          <UiSkeleton v-if="loadingHistory" :rows="3" />

          <div v-else-if="visibleEntries.length" class="timeline">
            <div v-for="e in visibleEntries" :key="e.id" class="tl-item">
              <div class="tl-head">
                <span class="chip">
                  <UiIcon :name="ENTRY_TYPE[e.type]?.icon || 'file-text'" size="12" />
                  {{ ENTRY_TYPE[e.type]?.label || e.type }}
                </span>
                <span class="muted text-xs">{{ fmtDate(e.entry_date) }}</span>
              </div>
              <div class="tl-content">{{ e.content }}</div>
            </div>
          </div>

          <UiEmpty
            v-else-if="!historyError"
            icon="file-text"
            title="Historia sin entradas"
            :desc="selected.owned ? 'Escribí la primera nota de la consulta.' : 'El profesional todavía no cargó entradas.'"
          />

          <template v-if="selected.owned">
            <hr class="divider" />
            <form class="panel" @submit.prevent="addEntry">
              <div class="row tight mb-sm">
                <button
                  v-for="(meta, key) in ENTRY_TYPE"
                  :key="key"
                  type="button"
                  class="chip"
                  :class="{ gray: entry.type !== key }"
                  style="cursor:pointer"
                  @click="entry.type = key"
                >
                  {{ meta.label }}
                </button>
                <div class="spacer"></div>
                <input type="date" v-model="entry.entryDate" style="width:auto" title="Fecha de la entrada (por defecto hoy)" />
              </div>
              <div v-if="plantillas.length" class="pre-barra">
                <label class="label" style="margin:0">Preinformes</label>
                <select v-model="plantillaElegida" @change="insertarPlantilla" style="max-width:260px">
                  <option value="">Elegir uno…</option>
                  <optgroup label="Del sistema">
                    <option v-for="p in plantillasSistema" :key="p.id" :value="p.id">{{ p.title }}</option>
                  </optgroup>
                  <optgroup v-if="plantillasPropias.length" label="Míos">
                    <option v-for="p in plantillasPropias" :key="p.id" :value="p.id">{{ p.title }}</option>
                  </optgroup>
                </select>
                <router-link class="btn ghost sm" to="/configuracion/preinformes">
                  Administrar
                </router-link>
              </div>
              <textarea
                ref="entryBox"
                v-model="entry.content"
                required
                rows="3"
                placeholder="Detalle de la consulta, diagnóstico, tratamiento indicado…"
              ></textarea>
              <div class="row end mt-sm">
                <span class="muted text-xs spacer">
                  Las entradas son append-only: quedan registradas y no se pueden reescribir.
                </span>
                <button class="btn sm" :disabled="savingEntry">
                  <span v-if="savingEntry" class="spinner"></span>
                  Guardar entrada
                </button>
              </div>
            </form>
          </template>
        </div>

        <!-- Estudios -->
        <div v-else-if="tab === 'estudios'" class="card-body">
          <AttachmentsPanel :person-id="selected.id" :can-edit="selected.owned" />
        </div>

        <!-- Datos -->
        <div v-else-if="tab === 'datos'" class="card-body">
          <div class="panel stack-sm">
            <div class="row tight nowrap">
              <UiIcon name="id-card" size="15" style="color:var(--muted)" />
              <span class="text-sm muted">DNI</span>
              <span class="text-sm strong" style="margin-left:auto">{{ selected.dni }}</span>
            </div>
            <div class="row tight nowrap">
              <UiIcon name="user" size="15" style="color:var(--muted)" />
              <span class="text-sm muted">Nombre completo</span>
              <span class="text-sm strong" style="margin-left:auto">{{ fullName(selected) }}</span>
            </div>
            <div class="row tight nowrap">
              <UiIcon name="phone" size="15" style="color:var(--muted)" />
              <span class="text-sm muted">Teléfono</span>
              <span class="text-sm strong" style="margin-left:auto">{{ selected.phone || '—' }}</span>
            </div>
            <div class="row tight nowrap">
              <UiIcon name="shield" size="15" style="color:var(--muted)" />
              <span class="text-sm muted">Acceso</span>
              <span class="text-sm strong" style="margin-left:auto">
                {{ selected.owned ? 'Paciente propio' : 'Compartido (lectura)' }}
              </span>
            </div>
          </div>
          <p class="hint">
            Editar los datos de contacto todavía no está disponible desde la app.
          </p>
        </div>

        <!-- Compartir -->
        <div v-else class="card-body">
          <div class="alert info">
            <UiIcon name="shield" size="16" />
            <div>
              Compartir da acceso de <strong>sólo lectura</strong> a la historia. Se registra el
              consentimiento y cada lectura queda auditada (Ley 25.326).
            </div>
          </div>
          <form class="row" @submit.prevent="share">
            <select v-model="shareWith" required style="flex:1;min-width:200px">
              <option value="" disabled>Elegí un profesional…</option>
              <option v-for="p in shareTargets" :key="p.id" :value="p.id">{{ p.full_name }}</option>
            </select>
            <button class="btn" :disabled="sharing || !shareWith">
              <UiIcon name="share" size="15" /> Compartir
            </button>
          </form>
          <p class="hint">
            Para revocar un acceso ya otorgado hace falta el listado de compartidos, que todavía no
            expone la API.
          </p>
        </div>
      </div>

      <div v-else class="card pad">
        <UiEmpty
          icon="users"
          title="Elegí un paciente"
          desc="Buscá por nombre o DNI en la lista de la izquierda para ver su historia clínica."
        />
      </div>
    </div>

    <!-- Nuevo paciente -->
    <UiModal
      v-if="showNew"
      title="Nuevo paciente"
      subtitle="Si el DNI ya existe en la clínica, se vincula esa ficha a tu lista"
      @close="showNew = false"
    >
      <form id="new-patient" @submit.prevent="createPatient">
        <div class="grid2">
          <div class="field">
            <label class="label">DNI</label>
            <input
              v-model="newPatient.dni"
              required
              inputmode="numeric"
              placeholder="Tipealo o escaneá el DNI"
              @input="leerDni"
              @keydown.enter.prevent="leerDni"
            />
          </div>
          <div class="field">
            <label class="label">Teléfono</label>
            <input v-model="newPatient.phone" inputmode="tel" placeholder="11 5555 5555" />
          </div>
        </div>
        <div class="grid2">
          <div class="field">
            <label class="label">Nombre</label>
            <input v-model="newPatient.firstName" required />
          </div>
          <div class="field">
            <label class="label">Apellido</label>
            <input v-model="newPatient.lastName" required />
          </div>
        </div>
      </form>
      <template #footer>
        <button class="btn secondary" @click="showNew = false">Cancelar</button>
        <button class="btn" form="new-patient" type="submit" :disabled="savingNew">
          <span v-if="savingNew" class="spinner"></span> Agregar paciente
        </button>
      </template>
    </UiModal>

    <!-- Importar CSV -->
    <UiModal
      v-if="showImport"
      title="Importar pacientes"
      subtitle="Traé tu planilla actual sin volver a cargar todo a mano"
      size="md"
      @close="showImport = false"
    >
      <div class="alert info">
        <UiIcon name="info" size="16" />
        <div>
          Una fila por paciente, separadas por coma:
          <code class="mono">DNI, Nombre, Apellido, Teléfono, Email</code>. La primera fila puede ser
          el encabezado.
        </div>
      </div>
      <div class="field">
        <label class="label">Archivo CSV</label>
        <input type="file" accept=".csv,text/csv" @change="onCsvFile" />
      </div>
      <div class="field">
        <label class="label">O pegá las filas acá</label>
        <textarea
          v-model="importCsv.text"
          rows="7"
          class="mono"
          placeholder="30111222, Ana, Gómez, 1155550001, ana@mail.com"
        ></textarea>
      </div>
      <template #footer>
        <button class="btn secondary" @click="showImport = false">Cancelar</button>
        <button class="btn" :disabled="!importCsv.text.trim() || importCsv.busy" @click="runImport">
          <span v-if="importCsv.busy" class="spinner"></span> Importar
        </button>
      </template>
    </UiModal>
  </AppShell>
</template>
