<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AppShell from '../../components/AppShell.vue';
import PageHeader from '../../components/ui/PageHeader.vue';
import UiEmpty from '../../components/ui/UiEmpty.vue';
import UiIcon from '../../components/ui/UiIcon.vue';
import UiSkeleton from '../../components/ui/UiSkeleton.vue';
import { api, errMessage } from '../../lib/api';
import type { Room } from '../../lib/types';
import { useUi } from '../../stores/ui';

const ui = useUi();
const rooms = ref<Room[]>([]);
const loading = ref(true);
const saving = ref(false);
const name = ref('');

async function load() {
  loading.value = true;
  try {
    rooms.value = await api<Room[]>('/rooms');
  } catch (e) {
    ui.error('No se pudieron cargar los consultorios', errMessage(e));
  } finally {
    loading.value = false;
  }
}

// Editar en la misma fila: para cambiarle el nombre a una sala no hace falta
// abrir un modal.
const editando = ref('');
const nombreEditado = ref('');
const guardando = ref(false);

function editar(r: Room) {
  editando.value = r.id;
  nombreEditado.value = r.name;
}

async function guardar(r: Room) {
  const nombre = nombreEditado.value.trim();
  if (!nombre || nombre === r.name) { editando.value = ''; return; }
  guardando.value = true;
  try {
    await api(`/rooms/${r.id}`, { method: 'PATCH', body: { name: nombre } });
    editando.value = '';
    await load();
    ui.success('Consultorio actualizado');
  } catch (e) {
    ui.error('No se pudo guardar', errMessage(e));
  } finally {
    guardando.value = false;
  }
}

/**
 * No hay borrado: los turnos ya dados apuntan a la sala y borrarla dejaría la
 * agenda histórica sin poder decir dónde se atendió. Desactivar la saca de los
 * selectores y deja el pasado intacto.
 */
async function alternarActivo(r: Room) {
  guardando.value = true;
  try {
    await api(`/rooms/${r.id}`, { method: 'PATCH', body: { isActive: !r.is_active } });
    await load();
  } catch (e) {
    ui.error('No se pudo cambiar', errMessage(e));
  } finally {
    guardando.value = false;
  }
}

async function create() {
  saving.value = true;
  try {
    await api('/rooms', { method: 'POST', body: { name: name.value.trim() } });
    ui.success('Consultorio agregado', name.value.trim());
    name.value = '';
    await load();
  } catch (e) {
    ui.error('No se pudo agregar', errMessage(e));
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <AppShell width="wide">
    <PageHeader
      title="Consultorios"
      subtitle="Las salas donde se atiende. bemo impide que dos turnos ocupen la misma sala al mismo tiempo."
    />

    <div class="card flush mb-lg">
      <div class="card-head">
        <UiIcon name="door" size="17" style="color:var(--muted)" />
        <h2>Salas cargadas</h2>
        <span class="chip gray" style="margin-left:auto">{{ rooms.length }}</span>
      </div>

      <div v-if="loading" style="padding:12px"><UiSkeleton :rows="2" /></div>

      <div v-else-if="rooms.length" class="table-wrap">
        <table>
          <tbody>
            <tr v-for="r in rooms" :key="r.id" :class="{ inactivo: !r.is_active }">
              <td>
                <div class="row tight">
                  <UiIcon name="door" size="16" style="color:var(--muted-2)" />
                  <input
                    v-if="editando === r.id"
                    v-model="nombreEditado"
                    class="sm"
                    style="max-width:280px"
                    @keydown.enter.prevent="guardar(r)"
                    @keydown.esc="editando = ''"
                  />
                  <span v-else class="strong">{{ r.name }}</span>
                  <span v-if="!r.is_active" class="chip gray">Inactivo</span>
                </div>
              </td>
              <td style="text-align:right;white-space:nowrap">
                <template v-if="editando === r.id">
                  <button class="btn sm" :disabled="guardando" @click="guardar(r)">Guardar</button>
                  <button class="btn ghost sm" @click="editando = ''">Cancelar</button>
                </template>
                <template v-else>
                  <button class="btn secondary sm" @click="editar(r)">
                    <UiIcon name="edit" size="14" /> Editar
                  </button>
                  <button class="btn ghost sm" :disabled="guardando" @click="alternarActivo(r)">
                    {{ r.is_active ? 'Desactivar' : 'Activar' }}
                  </button>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <UiEmpty
        v-else
        icon="door"
        title="Todavía no cargaste consultorios"
        desc="Podés empezar con uno solo: “Consultorio 1”. Si atendés en un único lugar igual conviene cargarlo."
      />

      <div class="card-foot">
        <form class="row tight form-narrow" @submit.prevent="create">
          <input v-model="name" required placeholder="Nombre del consultorio" style="flex:1;min-width:180px" />
          <button class="btn sm" :disabled="saving || !name.trim()">
            <UiIcon name="plus" size="15" /> Agregar
          </button>
        </form>
      </div>
    </div>

    <p class="hint">Renombrar o eliminar consultorios todavía no está disponible desde la app.</p>
  </AppShell>
</template>
