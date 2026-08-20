<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AppShell from '../../components/AppShell.vue';
import PageHeader from '../../components/ui/PageHeader.vue';
import UiIcon from '../../components/ui/UiIcon.vue';
import { api, errMessage } from '../../lib/api';
import { ROLE_LABEL, TZ } from '../../lib/format';
import type { Professional, Room } from '../../lib/types';
import { useAuth } from '../../stores/auth';
import { useUi } from '../../stores/ui';

const auth = useAuth();
const ui = useUi();
const counts = ref({ professionals: 0, rooms: 0 });

const clinicName = ref(auth.clinicName);

// ── Especialidades del consultorio ──────────────────────────────────────────
// Define qué puede elegir después cada profesional: no se puede asignar una que
// la clínica no ofrezca. Por eso se edita acá y no en cada ficha.
interface Especialidad { id: string; label: string }
const catalogo = ref<Especialidad[]>([]);
const elegidas = ref<string[]>([]);
const guardandoEsp = ref(false);

async function cargarEspecialidades() {
  const [todas, mias] = await Promise.all([
    api<Especialidad[]>('/specialties'),
    api<Especialidad[]>('/clinic/specialties'),
  ]);
  catalogo.value = todas;
  elegidas.value = mias.map((e) => e.id);
}

async function guardarEspecialidades() {
  guardandoEsp.value = true;
  try {
    await api('/clinic/specialties', { method: 'PUT', body: { specialtyIds: elegidas.value } });
    ui.success('Especialidades guardadas');
  } catch (e) {
    // El error explica cuál está en uso y por quién: se muestra tal cual.
    ui.error('No se pudo guardar', errMessage(e));
    await cargarEspecialidades();
  } finally {
    guardandoEsp.value = false;
  }
}

function saveName() {
  // El nombre todavía no se puede editar en la API: lo guardamos localmente
  // para que la topbar diga cómo se llama el consultorio.
  auth.setProfile({ clinicName: clinicName.value.trim() || undefined });
  ui.success('Nombre actualizado', 'Se guarda en este dispositivo hasta que la API lo soporte.');
}

onMounted(async () => {
  cargarEspecialidades();
  const [profs, rooms] = await Promise.all([
    api<Professional[]>('/users/professionals').catch(() => []),
    api<Room[]>('/rooms').catch(() => []),
  ]);
  counts.value = { professionals: profs.length, rooms: rooms.length };
});
</script>

<template>
  <AppShell width="narrow">
    <PageHeader title="Clínica" subtitle="Datos generales del consultorio y de tu cuenta" />

    <div class="card pad-sm mb-lg">
      <h2 class="mb-md">Consultorio</h2>
      <form class="row tight" @submit.prevent="saveName">
        <div style="flex:1;min-width:200px">
          <label class="label">Nombre</label>
          <input v-model="clinicName" placeholder="Consultorio Odontológico Norte" />
        </div>
        <button class="btn secondary sm" style="margin-top:22px">Guardar</button>
      </form>

      <div class="panel stack-sm mt-lg">
        <div class="row tight nowrap">
          <UiIcon name="clock" size="15" style="color:var(--muted)" />
          <span class="text-sm muted">Zona horaria</span>
          <span class="text-sm strong" style="margin-left:auto">{{ TZ }}</span>
        </div>
        <div class="row tight nowrap">
          <UiIcon name="users" size="15" style="color:var(--muted)" />
          <span class="text-sm muted">Profesionales</span>
          <span class="text-sm strong" style="margin-left:auto">{{ counts.professionals }}</span>
        </div>
        <div class="row tight nowrap">
          <UiIcon name="door" size="15" style="color:var(--muted)" />
          <span class="text-sm muted">Consultorios</span>
          <span class="text-sm strong" style="margin-left:auto">{{ counts.rooms }}</span>
        </div>
      </div>
    </div>

    <div class="card pad-sm mb-lg">
      <h2 class="mb-xs">Especialidades del consultorio</h2>
      <p class="muted text-sm mb-md">
        Lo que se atiende acá. Cada profesional elige las suyas de esta lista, así
        que si falta alguna hay que agregarla primero.
      </p>
      <div class="esp-grid">
        <label v-for="e in catalogo" :key="e.id" class="esp-item">
          <input type="checkbox" :value="e.id" v-model="elegidas" />
          <span>{{ e.label }}</span>
        </label>
      </div>
      <div class="row end mt-md">
        <span class="muted text-xs spacer">{{ elegidas.length }} seleccionadas</span>
        <button class="btn sm" :disabled="guardandoEsp" @click="guardarEspecialidades">
          <span v-if="guardandoEsp" class="spinner"></span>
          Guardar especialidades
        </button>
      </div>
    </div>

    <div class="card pad-sm mb-lg">
      <h2 class="mb-md">Tu cuenta</h2>
      <div class="panel stack-sm">
        <div class="row tight nowrap">
          <UiIcon name="user" size="15" style="color:var(--muted)" />
          <span class="text-sm muted">Nombre</span>
          <span class="text-sm strong" style="margin-left:auto">{{ auth.displayName }}</span>
        </div>
        <div class="row tight nowrap">
          <UiIcon name="mail" size="15" style="color:var(--muted)" />
          <span class="text-sm muted">Email</span>
          <span class="text-sm strong" style="margin-left:auto">{{ auth.user?.email }}</span>
        </div>
        <div class="row tight nowrap">
          <UiIcon name="shield" size="15" style="color:var(--muted)" />
          <span class="text-sm muted">Roles</span>
          <span class="row tight" style="margin-left:auto">
            <span v-for="r in auth.user?.roles" :key="r" class="chip gray">{{ ROLE_LABEL[r] || r }}</span>
          </span>
        </div>
      </div>
    </div>

    <div class="card pad-sm">
      <div class="row tight mb-md">
        <UiIcon name="lock" size="17" style="color:var(--teal)" />
        <h2>Privacidad y datos</h2>
      </div>
      <ul class="muted text-sm" style="margin:0;padding-left:18px;line-height:1.9">
        <li>Cada clínica ve únicamente sus propios datos (aislamiento a nivel base de datos).</li>
        <li>La historia clínica es privada del profesional; compartir da acceso de sólo lectura.</li>
        <li>Cada lectura de historia, cada acceso denegado y cada login quedan auditados.</li>
        <li>Las entradas clínicas son append-only: no se reescriben ni se borran.</li>
      </ul>
      <p class="hint">
        Cambiar contraseña, exportar los datos de la clínica y editar el nombre en el servidor
        todavía no están disponibles.
      </p>
    </div>
  </AppShell>
</template>
