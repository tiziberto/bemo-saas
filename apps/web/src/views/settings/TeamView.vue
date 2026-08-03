<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import AppShell from '../../components/AppShell.vue';
import PageHeader from '../../components/ui/PageHeader.vue';
import UiAvatar from '../../components/ui/UiAvatar.vue';
import UiEmpty from '../../components/ui/UiEmpty.vue';
import UiIcon from '../../components/ui/UiIcon.vue';
import UiModal from '../../components/ui/UiModal.vue';
import UiSkeleton from '../../components/ui/UiSkeleton.vue';
import { api, errMessage } from '../../lib/api';
import { ROLE_LABEL } from '../../lib/format';
import type { TeamUser } from '../../lib/types';
import { useUi } from '../../stores/ui';

const ui = useUi();

const users = ref<TeamUser[]>([]);
const loading = ref(true);
const error = ref('');
const showInvite = ref(false);
const sending = ref(false);
const invite = reactive({ email: '', role: 'professional' });
const lastInvite = ref<{ email: string; token: string } | null>(null);

const inviteUrl = computed(() =>
  lastInvite.value ? `${location.origin}/invitacion?token=${lastInvite.value.token}` : '',
);

const ROLES = [
  {
    value: 'professional',
    label: 'Profesional',
    desc: 'Atiende pacientes. Ve su agenda y su historia clínica privada.',
  },
  {
    value: 'receptionist',
    label: 'Recepción',
    desc: 'Agenda turnos de todo el equipo. No accede a historias clínicas.',
  },
  {
    value: 'admin',
    label: 'Admin',
    desc: 'Configura la clínica, invita gente y gestiona consultorios.',
  },
];

async function load() {
  loading.value = true;
  try {
    users.value = await api<TeamUser[]>('/users');
  } catch (e) {
    error.value = errMessage(e);
  } finally {
    loading.value = false;
  }
}

async function send() {
  sending.value = true;
  try {
    const r = await api<{ inviteToken: string }>('/users/invite', {
      method: 'POST',
      body: { email: invite.email.trim(), role: invite.role },
    });
    lastInvite.value = { email: invite.email.trim(), token: r.inviteToken };
    invite.email = '';
    showInvite.value = false;
    ui.success('Invitación creada', 'Copiá el link y mandáselo a la persona.');
    await load();
  } catch (e) {
    ui.error('No se pudo invitar', errMessage(e));
  } finally {
    sending.value = false;
  }
}

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    ui.success(`${what} copiado`);
  } catch {
    ui.error('No se pudo copiar', 'Copialo a mano desde el recuadro.');
  }
}

onMounted(load);
</script>

<template>
  <AppShell width="narrow">
    <PageHeader
      title="Equipo"
      subtitle="Quién entra a bemo y qué puede hacer cada uno"
    >
      <template #actions>
        <button class="btn sm" @click="showInvite = true">
          <UiIcon name="user-plus" size="15" /> Invitar
        </button>
      </template>
    </PageHeader>

    <div v-if="error" class="alert err"><UiIcon name="alert-circle" size="16" />{{ error }}</div>

    <div v-if="lastInvite" class="card pad-sm mb-lg" style="border-color:var(--teal-line)">
      <div class="row tight mb-sm">
        <UiIcon name="check-circle" size="16" style="color:var(--success)" />
        <strong class="text-sm">Invitación lista para {{ lastInvite.email }}</strong>
        <button class="icon-btn" style="margin-left:auto" @click="lastInvite = null" aria-label="Cerrar">
          <UiIcon name="x" size="15" />
        </button>
      </div>
      <p class="muted text-sm mb-sm">
        Todavía no mandamos emails: pasale este link para que cree su contraseña. Vence en 7 días y
        se usa una sola vez.
      </p>
      <div class="row tight nowrap">
        <input class="mono text-xs" :value="inviteUrl" readonly @focus="($event.target as HTMLInputElement).select()" />
        <button class="btn secondary sm" @click="copy(inviteUrl, 'Link')">
          <UiIcon name="copy" size="15" /> Copiar
        </button>
      </div>
    </div>

    <div class="card flush">
      <div class="card-head">
        <h2>Personas</h2>
        <span class="chip gray" style="margin-left:auto">{{ users.length }}</span>
      </div>

      <div v-if="loading" style="padding:12px"><UiSkeleton :rows="3" avatar /></div>

      <div v-else-if="users.length" class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Persona</th>
              <th>Roles</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id">
              <td>
                <div class="row tight nowrap">
                  <UiAvatar :name="u.full_name || u.email" size="sm" />
                  <div style="min-width:0">
                    <div class="truncate">{{ u.full_name || '—' }}</div>
                    <div class="muted text-xs truncate">{{ u.email }}</div>
                  </div>
                </div>
              </td>
              <td>
                <div class="row tight">
                  <span v-for="r in u.roles" :key="r" class="chip gray">{{ ROLE_LABEL[r] || r }}</span>
                  <span v-if="!u.roles.length" class="muted text-xs">Sin rol (invitación pendiente)</span>
                </div>
              </td>
              <td>
                <span class="chip" :class="u.is_active === false ? 'gray' : 'success'">
                  <span class="dot"></span>{{ u.is_active === false ? 'Inactivo' : 'Activo' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <UiEmpty v-else icon="users" title="Sos la única persona" desc="Invitá a los profesionales y a la recepción." />
    </div>

    <p class="hint mt-md">
      Dar de baja a alguien o cambiarle el rol todavía no está disponible desde la app.
    </p>

    <UiModal
      v-if="showInvite"
      title="Invitar a alguien"
      subtitle="Se genera un link de un solo uso"
      @close="showInvite = false"
    >
      <form id="invite-form" @submit.prevent="send">
        <div class="field">
          <label class="label">Email</label>
          <input v-model="invite.email" type="email" required placeholder="persona@consultorio.com" />
        </div>
        <div class="field">
          <label class="label">Rol</label>
          <div class="stack-sm">
            <label
              v-for="r in ROLES"
              :key="r.value"
              class="panel row tight nowrap"
              style="cursor:pointer;align-items:flex-start"
              :style="invite.role === r.value ? 'border-color:var(--teal);background:var(--teal-tint)' : ''"
            >
              <input type="radio" :value="r.value" v-model="invite.role" style="width:16px;margin-top:2px;accent-color:var(--teal)" />
              <span style="min-width:0">
                <span class="strong text-sm">{{ r.label }}</span>
                <span class="muted text-xs" style="display:block">{{ r.desc }}</span>
              </span>
            </label>
          </div>
        </div>
      </form>
      <template #footer>
        <button class="btn secondary" @click="showInvite = false">Cancelar</button>
        <button class="btn" type="submit" form="invite-form" :disabled="sending">
          <span v-if="sending" class="spinner"></span> Crear invitación
        </button>
      </template>
    </UiModal>
  </AppShell>
</template>
