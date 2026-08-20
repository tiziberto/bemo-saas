<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import AppShell from '../../components/AppShell.vue';
import PageHeader from '../../components/ui/PageHeader.vue';
import UiEmpty from '../../components/ui/UiEmpty.vue';
import UiIcon from '../../components/ui/UiIcon.vue';
import UiModal from '../../components/ui/UiModal.vue';
import UiSkeleton from '../../components/ui/UiSkeleton.vue';
import { api, errMessage } from '../../lib/api';
import { ENTRY_TYPE } from '../../lib/format';
import { useUi } from '../../stores/ui';

interface Plantilla {
  id: string;
  title: string;
  type: string;
  content: string;
  own: boolean;
}

const ui = useUi();
const plantillas = ref<Plantilla[]>([]);
const loading = ref(true);
const error = ref('');

const delSistema = computed(() => plantillas.value.filter((p) => !p.own));
const propias = computed(() => plantillas.value.filter((p) => p.own));

async function load() {
  loading.value = true;
  try {
    plantillas.value = await api<Plantilla[]>('/clinical-templates');
  } catch (e) {
    error.value = errMessage(e, 'No se pudieron cargar los preinformes');
  } finally {
    loading.value = false;
  }
}
onMounted(load);

// ── Alta y edición ──────────────────────────────────────────────────────────
const editando = ref<Plantilla | null>(null);
const abierto = ref(false);
const guardando = ref(false);
const form = reactive({ title: '', type: 'note', content: '' });

function nuevo() {
  editando.value = null;
  Object.assign(form, { title: '', type: 'note', content: '' });
  abierto.value = true;
}

/** Los del sistema se pueden copiar pero no editar: sirve como punto de partida. */
function duplicar(p: Plantilla) {
  editando.value = null;
  Object.assign(form, { title: `${p.title} (mío)`, type: p.type, content: p.content });
  abierto.value = true;
}

function editar(p: Plantilla) {
  editando.value = p;
  Object.assign(form, { title: p.title, type: p.type, content: p.content });
  abierto.value = true;
}

async function guardar() {
  if (!form.title.trim() || !form.content.trim()) return;
  guardando.value = true;
  try {
    const cuerpo = {
      title: form.title.trim(),
      type: form.type,
      content: form.content,
    };
    if (editando.value) {
      await api(`/clinical-templates/${editando.value.id}`, { method: 'PATCH', body: cuerpo });
    } else {
      await api('/clinical-templates', { method: 'POST', body: cuerpo });
    }
    abierto.value = false;
    await load();
    ui.success(editando.value ? 'Preinforme actualizado' : 'Preinforme creado');
  } catch (e) {
    ui.error('No se pudo guardar', errMessage(e));
  } finally {
    guardando.value = false;
  }
}

async function borrar(p: Plantilla) {
  const ok = await ui.confirm({
    title: '¿Borrar el preinforme?',
    desc: `"${p.title}" deja de estar disponible al cargar la historia. Lo ya escrito con él no se toca.`,
    confirmLabel: 'Borrar',
    cancelLabel: 'Volver',
    danger: true,
  });
  if (!ok) return;
  try {
    await api(`/clinical-templates/${p.id}`, { method: 'DELETE' });
    await load();
    ui.success('Preinforme borrado');
  } catch (e) {
    ui.error('No se pudo borrar', errMessage(e));
  }
}
</script>

<template>
  <AppShell width="wide">
    <PageHeader
      title="Preinformes"
      subtitle="Textos que reusás al cargar la historia clínica"
    >
      <template #actions>
        <button class="btn sm" @click="nuevo">
          <UiIcon name="plus" size="15" /> Nuevo preinforme
        </button>
      </template>
    </PageHeader>

    <div v-if="error" class="alert err"><UiIcon name="alert-circle" size="16" />{{ error }}</div>
    <UiSkeleton v-if="loading" :rows="3" />

    <template v-else>
      <div class="card flush mb-lg">
        <div class="card-head">
          <h2>Míos</h2>
          <span class="chip gray">{{ propias.length }}</span>
        </div>
        <div v-if="propias.length" class="table-wrap">
          <table>
            <tbody>
              <tr v-for="p in propias" :key="p.id">
                <td style="width:1%;white-space:nowrap">
                  <span class="chip">
                    <UiIcon :name="ENTRY_TYPE[p.type]?.icon || 'file-text'" size="12" />
                    {{ ENTRY_TYPE[p.type]?.label || p.type }}
                  </span>
                </td>
                <td>
                  <div class="strong">{{ p.title }}</div>
                  <div class="muted text-xs truncate">{{ p.content.replace(/\n+/g, ' · ') }}</div>
                </td>
                <td style="text-align:right;white-space:nowrap">
                  <button class="btn secondary sm" @click="editar(p)">Editar</button>
                  <button class="btn ghost sm" @click="borrar(p)">Borrar</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <UiEmpty
          v-else
          icon="file-text"
          title="Todavía no cargaste ninguno"
          desc="Empezá copiando uno del sistema y ajustalo a cómo escribís vos."
        />
      </div>

      <div class="card flush">
        <div class="card-head">
          <h2>Del sistema</h2>
          <span class="chip gray">{{ delSistema.length }}</span>
        </div>
        <p class="muted text-sm" style="padding:0 var(--s-lg) var(--s-sm)">
          Esqueletos genéricos, iguales para todos. No se editan, pero podés copiarlos
          y quedarte con tu propia versión.
        </p>
        <div class="table-wrap">
          <table>
            <tbody>
              <tr v-for="p in delSistema" :key="p.id">
                <td style="width:1%;white-space:nowrap">
                  <span class="chip gray">
                    <UiIcon :name="ENTRY_TYPE[p.type]?.icon || 'file-text'" size="12" />
                    {{ ENTRY_TYPE[p.type]?.label || p.type }}
                  </span>
                </td>
                <td>
                  <div class="strong">{{ p.title }}</div>
                  <div class="muted text-xs truncate">{{ p.content.replace(/\n+/g, ' · ') }}</div>
                </td>
                <td style="text-align:right;white-space:nowrap">
                  <button class="btn secondary sm" @click="duplicar(p)">Copiar como mío</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <UiModal
      v-if="abierto"
      :title="editando ? 'Editar preinforme' : 'Nuevo preinforme'"
      subtitle="Sólo vos vas a verlo"
      size="md"
      @close="abierto = false"
    >
      <div class="field">
        <label class="label">Título</label>
        <input v-model="form.title" required placeholder="Control de ortodoncia" />
      </div>
      <div class="field">
        <label class="label">Tipo de entrada</label>
        <select v-model="form.type">
          <option v-for="(meta, key) in ENTRY_TYPE" :key="key" :value="key">{{ meta.label }}</option>
        </select>
      </div>
      <div class="field">
        <label class="label">Texto</label>
        <textarea v-model="form.content" rows="8" placeholder="Arco:&#10;Brackets:&#10;Próximo ajuste:"></textarea>
        <p class="muted text-xs mt-xs">
          Se inserta tal cual al final de lo que estés escribiendo. Dejá los renglones
          vacíos que quieras completar en la consulta.
        </p>
      </div>
      <template #footer>
        <button class="btn ghost sm" @click="abierto = false">Cancelar</button>
        <button class="btn sm" :disabled="guardando" @click="guardar">
          <span v-if="guardando" class="spinner"></span>Guardar
        </button>
      </template>
    </UiModal>
  </AppShell>
</template>
