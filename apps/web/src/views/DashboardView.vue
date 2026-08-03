<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import AppointmentModal from '../components/agenda/AppointmentModal.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import StatCard from '../components/ui/StatCard.vue';
import StatusChip from '../components/ui/StatusChip.vue';
import UiAvatar from '../components/ui/UiAvatar.vue';
import UiEmpty from '../components/ui/UiEmpty.vue';
import UiIcon from '../components/ui/UiIcon.vue';
import UiSkeleton from '../components/ui/UiSkeleton.vue';
import { api, errMessage, qs } from '../lib/api';
import {
  capitalize,
  fmtDayLong,
  fmtTime,
  fullName,
  minutesOfDay,
  todayISO,
  waLink,
} from '../lib/format';
import type {
  Appointment,
  AvailabilityBlock,
  Professional,
  Room,
  Slot,
} from '../lib/types';
import { useAuth } from '../stores/auth';

const auth = useAuth();
const router = useRouter();

const today = todayISO();
const loading = ref(true);
const error = ref('');
const appointments = ref<Appointment[]>([]);
const professionals = ref<Professional[]>([]);
const rooms = ref<Room[]>([]);
const blocks = ref<AvailabilityBlock[]>([]);
const freeCount = ref(0);
const detail = ref<Appointment | null>(null);

/** Un profesional ve su día; recepción y admin ven el del consultorio entero. */
const mine = computed(() =>
  auth.isProfessional && !auth.isAdmin && !auth.isReceptionist
    ? appointments.value.filter((a) => a.professional_id === auth.user?.id)
    : appointments.value,
);

const active = computed(() => mine.value.filter((a) => a.status !== 'cancelled'));

const stats = computed(() => ({
  total: active.value.length,
  confirmed: active.value.filter((a) => a.status === 'confirmed').length,
  pending: active.value.filter((a) => a.status === 'scheduled').length,
  done: active.value.filter((a) => a.status === 'completed').length,
  noShow: mine.value.filter((a) => a.status === 'no_show').length,
  cancelled: mine.value.filter((a) => a.status === 'cancelled').length,
}));

const nowMin = minutesOfDay(new Date().toISOString());
const upcoming = computed(() =>
  active.value
    .filter((a) => minutesOfDay(a.starts_at) >= nowMin - 15 && a.status !== 'completed')
    .slice(0, 6),
);
const past = computed(() => active.value.filter((a) => !upcoming.value.includes(a)));

const profName = (id: string) =>
  professionals.value.find((p) => p.id === id)?.full_name ?? '—';

// Checklist de puesta en marcha: el admin ve exactamente qué le falta.
const setup = computed(() => [
  {
    done: rooms.value.length > 0,
    title: 'Cargar los consultorios',
    desc: 'Las salas donde se atiende. Evita que dos profesionales choquen en el mismo lugar.',
    to: '/configuracion/consultorios',
    cta: 'Agregar consultorio',
  },
  {
    done: professionals.value.length > 0,
    title: 'Sumar al equipo',
    desc: 'Invitá a profesionales y recepción con su rol.',
    to: '/configuracion/equipo',
    cta: 'Invitar',
  },
  {
    done: blocks.value.length > 0,
    title: 'Definir horarios de atención',
    desc: 'Sin horarios cargados no hay huecos para agendar.',
    to: '/configuracion/horarios',
    cta: 'Cargar horarios',
  },
  {
    done: appointments.value.length > 0,
    title: 'Agendar el primer turno',
    desc: 'Probá el circuito completo con un paciente real.',
    to: '/agenda',
    cta: 'Ir a la agenda',
  },
]);

const setupDone = computed(() => setup.value.filter((s) => s.done).length);
const showSetup = computed(() => auth.isAdmin && setupDone.value < setup.value.length);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [appts, profs, rms, blks] = await Promise.all([
      api<Appointment[]>('/appointments' + qs({ date: today })),
      api<Professional[]>('/users/professionals'),
      api<Room[]>('/rooms').catch(() => [] as Room[]),
      api<AvailabilityBlock[]>('/availability-blocks').catch(() => [] as AvailabilityBlock[]),
    ]);
    appointments.value = appts;
    professionals.value = profs;
    rooms.value = rms;
    blocks.value = blks;

    const lists = await Promise.all(
      profs.map((p) =>
        api<Slot[]>('/availability' + qs({ professionalId: p.id, date: today })).catch(
          () => [] as Slot[],
        ),
      ),
    );
    freeCount.value = lists.reduce((n, l) => n + l.length, 0);
  } catch (e) {
    error.value = errMessage(e, 'No se pudo cargar el panel');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <AppShell>
    <PageHeader
      :title="`Hola, ${auth.displayName}`"
      :subtitle="capitalize(fmtDayLong(today))"
    >
      <template #actions>
        <router-link class="btn secondary sm" to="/agenda">
          <UiIcon name="calendar" size="15" /> Ver agenda
        </router-link>
        <button
          v-if="auth.isAdmin || auth.isReceptionist"
          class="btn sm"
          @click="router.push({ path: '/agenda', query: { nuevo: '1' } })"
        >
          <UiIcon name="plus" size="15" /> Agendar turno
        </button>
      </template>
    </PageHeader>

    <div v-if="error" class="alert err"><UiIcon name="alert-circle" size="16" />{{ error }}</div>

    <div v-if="loading" class="card pad"><UiSkeleton :rows="5" avatar /></div>

    <template v-else>
      <div class="grid4 mb-xl">
        <StatCard label="Turnos de hoy" :value="stats.total" icon="calendar" :foot="`${stats.done} ya atendidos`" />
        <StatCard label="Confirmados" :value="stats.confirmed" icon="check-circle" tone="success" :foot="`${stats.pending} sin confirmar`" />
        <StatCard label="Huecos libres" :value="freeCount" icon="clock" :foot="freeCount ? 'Disponibles hoy' : 'Agenda completa'" />
        <StatCard
          label="Ausencias"
          :value="stats.noShow + stats.cancelled"
          icon="alert-triangle"
          :tone="stats.noShow + stats.cancelled > 0 ? 'warning' : 'default'"
          :foot="`${stats.noShow} no vinieron · ${stats.cancelled} cancelados`"
        />
      </div>

      <div v-if="showSetup" class="card flush mb-xl">
        <div class="card-head">
          <UiIcon name="sparkle" size="17" style="color:var(--teal)" />
          <div>
            <h2>Puesta en marcha</h2>
            <p class="muted text-sm">{{ setupDone }} de {{ setup.length }} pasos completos</p>
          </div>
        </div>
        <div class="checklist">
          <div v-for="s in setup" :key="s.title" class="check-row" :class="{ done: s.done }">
            <span class="check-mark"><UiIcon name="check" size="13" /></span>
            <div class="check-main">
              <div class="check-title">{{ s.title }}</div>
              <div class="check-desc">{{ s.desc }}</div>
            </div>
            <router-link v-if="!s.done" class="btn secondary sm" :to="s.to">{{ s.cta }}</router-link>
          </div>
        </div>
      </div>

      <div class="grid2" style="align-items:start;gap:var(--s-lg)">
        <div class="card flush">
          <div class="card-head">
            <h2>Lo que viene</h2>
            <span class="chip gray" style="margin-left:auto">{{ upcoming.length }}</span>
          </div>
          <div v-if="upcoming.length">
            <button
              v-for="a in upcoming"
              :key="a.id"
              class="list-item"
              @click="detail = a"
            >
              <div class="strong" style="width:52px;font-variant-numeric:tabular-nums">
                {{ fmtTime(a.starts_at) }}
              </div>
              <UiAvatar :name="fullName(a)" size="sm" neutral />
              <div class="li-main">
                <div class="li-title">{{ fullName(a) }}</div>
                <div class="li-sub truncate">
                  {{ a.reason || 'Sin motivo' }} · {{ profName(a.professional_id) }}
                </div>
              </div>
              <StatusChip :status="a.status" />
              <a
                v-if="waLink(a.phone)"
                class="icon-btn"
                :href="waLink(a.phone)!"
                target="_blank"
                rel="noopener"
                title="Avisar por WhatsApp"
                @click.stop
              >
                <UiIcon name="whatsapp" size="16" />
              </a>
            </button>
          </div>
          <UiEmpty
            v-else
            icon="calendar-check"
            title="No queda nada por delante hoy"
            desc="Todos los turnos del día ya pasaron o todavía no hay ninguno agendado."
          />
        </div>

        <div class="card flush">
          <div class="card-head">
            <h2>Ya pasaron</h2>
            <span class="chip gray" style="margin-left:auto">{{ past.length }}</span>
          </div>
          <div v-if="past.length" class="scroll-y" style="max-height:420px">
            <button v-for="a in past" :key="a.id" class="list-item" @click="detail = a">
              <div class="muted" style="width:52px;font-variant-numeric:tabular-nums">
                {{ fmtTime(a.starts_at) }}
              </div>
              <div class="li-main">
                <div class="li-title">{{ fullName(a) }}</div>
                <div class="li-sub truncate">{{ profName(a.professional_id) }}</div>
              </div>
              <StatusChip :status="a.status" />
            </button>
          </div>
          <UiEmpty v-else icon="clock" title="Nada todavía" desc="Acá van apareciendo los turnos a medida que avanza el día." />
        </div>
      </div>
    </template>

    <AppointmentModal
      v-if="detail"
      :appt="detail"
      :professionals="professionals"
      :rooms="rooms"
      @close="detail = null"
      @updated="detail = null; load()"
    />
  </AppShell>
</template>
