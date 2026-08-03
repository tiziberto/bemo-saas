<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { api, apiBlob, apiUpload, errMessage } from '../../lib/api';
import { fmtBytes, fmtDate } from '../../lib/format';
import type { Attachment } from '../../lib/types';
import { useUi } from '../../stores/ui';
import UiEmpty from '../ui/UiEmpty.vue';
import UiIcon from '../ui/UiIcon.vue';
import UiSkeleton from '../ui/UiSkeleton.vue';

const props = defineProps<{ personId: string; canEdit: boolean }>();

const ui = useUi();
const items = ref<Attachment[]>([]);
const loading = ref(true);
const uploading = ref(false);
const dragging = ref(false);
const note = ref('');
const fileInput = ref<HTMLInputElement | null>(null);

const ICON_BY_MIME = (mime: string) => (mime.startsWith('image/') ? 'eye' : 'file-text');

async function load() {
  loading.value = true;
  try {
    items.value = await api<Attachment[]>(`/patients/${props.personId}/attachments`);
  } catch (e) {
    ui.error('No se pudieron cargar los estudios', errMessage(e));
  } finally {
    loading.value = false;
  }
}

async function send(files: FileList | File[]) {
  const list = Array.from(files);
  if (!list.length) return;
  uploading.value = true;
  try {
    for (const file of list) {
      const form = new FormData();
      form.append('file', file);
      if (note.value.trim()) form.append('note', note.value.trim());
      await apiUpload(`/patients/${props.personId}/attachments`, form);
    }
    note.value = '';
    ui.success(
      list.length === 1 ? 'Estudio agregado' : `${list.length} estudios agregados`,
    );
    await load();
  } catch (e) {
    ui.error('No se pudo subir', errMessage(e));
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = '';
  }
}

function onPick(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (files) send(files);
}

function onDrop(e: DragEvent) {
  dragging.value = false;
  if (e.dataTransfer?.files?.length) send(e.dataTransfer.files);
}

/** Se abre en una pestaña nueva desde un blob: la URL nunca queda expuesta. */
async function open(item: Attachment) {
  try {
    const blob = await apiBlob(
      `/patients/${props.personId}/attachments/${item.id}/content`,
    );
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    ui.error('No se pudo abrir el estudio', errMessage(e));
  }
}

async function remove(item: Attachment) {
  const ok = await ui.confirm({
    title: '¿Borrar el estudio?',
    desc: `${item.filename}. El archivo se elimina; queda registro de que existió.`,
    confirmLabel: 'Borrar',
    danger: true,
  });
  if (!ok) return;
  try {
    await api(`/patients/${props.personId}/attachments/${item.id}`, { method: 'DELETE' });
    ui.success('Estudio borrado');
    await load();
  } catch (e) {
    ui.error('No se pudo borrar', errMessage(e));
  }
}

watch(() => props.personId, load);
onMounted(load);
</script>

<template>
  <div>
    <div v-if="!canEdit" class="alert info">
      <UiIcon name="lock" size="16" />
      <div>Estos estudios están compartidos con vos en <strong>sólo lectura</strong>.</div>
    </div>

    <UiSkeleton v-if="loading" :rows="3" />

    <div v-else-if="items.length" class="card flush mb-lg">
      <div class="table-wrap">
        <table>
          <tbody>
            <tr v-for="a in items" :key="a.id">
              <td style="width:1%">
                <UiIcon :name="ICON_BY_MIME(a.mime)" size="18" style="color:var(--muted)" />
              </td>
              <td>
                <div class="text-sm strong">{{ a.filename }}</div>
                <div class="muted text-xs">
                  {{ fmtDate(a.created_at) }} · {{ fmtBytes(a.size_bytes) }}
                  <template v-if="a.note"> · {{ a.note }}</template>
                </div>
              </td>
              <td class="actions">
                <div class="row tight nowrap end">
                  <button class="btn secondary sm" @click="open(a)">
                    <UiIcon name="eye" size="15" /> Ver
                  </button>
                  <button v-if="canEdit" class="icon-btn" title="Borrar" @click="remove(a)">
                    <UiIcon name="trash" size="16" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <UiEmpty
      v-else
      icon="upload"
      title="Sin estudios cargados"
      :desc="
        canEdit
          ? 'Arrastrá una radiografía o un PDF acá abajo, o elegí el archivo.'
          : 'El profesional todavía no cargó estudios de este paciente.'
      "
    />

    <div
      v-if="canEdit"
      class="panel"
      :style="dragging ? 'border-color:var(--teal);background:var(--teal-tint)' : ''"
      style="text-align:center;padding:var(--s-xl);border-style:dashed"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <UiIcon name="upload" size="22" style="color:var(--muted-2)" />
      <p class="text-sm mt-sm">
        Arrastrá el archivo o
        <button
          class="btn ghost sm"
          style="padding:0 4px;vertical-align:baseline"
          :disabled="uploading"
          @click="fileInput?.click()"
        >
          elegilo de tu compu
        </button>
      </p>
      <p class="hint">Imágenes o PDF, hasta 20 MB.</p>
      <input
        ref="fileInput"
        type="file"
        class="hidden"
        multiple
        accept="image/*,application/pdf"
        @change="onPick"
      />
      <div class="row tight mt-md" style="justify-content:center">
        <input
          v-model="note"
          placeholder="Nota (opcional): panorámica, control post…"
          style="max-width:320px"
        />
      </div>
      <p v-if="uploading" class="row tight mt-sm" style="justify-content:center">
        <span class="spinner"></span><span class="text-sm muted">Subiendo…</span>
      </p>
    </div>
  </div>
</template>
