<script setup lang="ts">
import { MOD_K } from '../lib/platform';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import AppointmentModal from '../components/agenda/AppointmentModal.vue';
import BookingWizard from '../components/agenda/BookingWizard.vue';
import DayGrid from '../components/agenda/DayGrid.vue';
import DatePager from '../components/ui/DatePager.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import SearchInput from '../components/ui/SearchInput.vue';
import StatusChip from '../components/ui/StatusChip.vue';
import UiAvatar from '../components/ui/UiAvatar.vue';
import UiEmpty from '../components/ui/UiEmpty.vue';
import UiIcon from '../components/ui/UiIcon.vue';
import UiModal from '../components/ui/UiModal.vue';
import UiSkeleton from '../components/ui/UiSkeleton.vue';
import { api, errMessage, qs } from '../lib/api';
import {
  addDays,
  fmtDayShort,
  fmtTime,
  fullName,
  relativeDay,
  todayISO,
  waLink,
} from '../lib/format';
import type { Appointment, Professional, Room, Slot } from '../lib/types';
import { useAuth } from '../stores/auth';
import { useUi } from '../stores/ui';

const auth = useAuth();
const ui = useUi();
const route = useRoute();
const router = useRouter();

const canBook = computed(() => auth.isAdmin || auth.isReceptionist);

const date = ref((route.query.fecha as string) || todayISO());
const view = ref<'grid' | 'list'>(
  (localStorage.getItem('bemo_agenda_view') as 'grid' | 'list') || 'grid',
);
const professionals = ref<Professional[]>([]);
const rooms = ref<Room[]>([]);
const appointments = ref<Appointment[]>([]);
const freeSlots = ref<Record<string, Slot[]>>({});
const hiddenProfs = ref<Set<string>>(new Set());
const search = ref('');
const statusFilter = ref('activos');
const loading = ref(true);
const error = ref('');

const booking = ref<{ profId: string; slot: Slot | null } | null>(null);
const detail = ref<Appointment | null>(null);
const gapFinder = ref<{ loading: boolean; results: { date: string; profId: string; slots: Slot[] }[] } | null>(null);

const visibleProfs = computed(() =>
  professionals.value.filter((p) => !hiddenProfs.value.has(p.id)),
);

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase();
  return appointments.value.filter((a) => {
    if (hiddenProfs.value.has(a.professional_id)) return false;
    if (statusFilter.value === 'activos' && (a.status === 'cancelled' || a.status === 'no_show')) return false;
    if (statusFilter.value !== 'activos' && statusFilter.value !== 'todos' && a.status !== statusFilter.value) return false;
    if (!term) return true;
    return (
      fullName(a).toLowerCase().includes(term) ||
      (a.dni ?? '').includes(term) ||
      (a.reason ?? '').toLowerCase().includes(term)
    );
  });
});

const totals = computed(() => {
  const list = appointments.value.filter((a) => !hiddenProfs.value.has(a.professional_id));
  return {
    active: list.filter((a) => a.status !== 'cancelled').length,
    free: visibleProfs.value.reduce((n, p) => n + (freeSlots.value[p.id]?.length ?? 0), 0),
  };
});

const profName = (id: string) =>
  professionals.value.find((p) => p.id === id)?.full_name ?? '—';
const roomName = (id: string | null) =>
  rooms.value.find((r) => r.id === id)?.name ?? '—';

async function loadBase() {
  try {
    const [profs, rms] = await Promise.all([
      api<Professional[]>('/users/professionals'),
      api<Room[]>('/rooms').catch(() => [] as Room[]),
    ]);
    professionals.value = profs;
    rooms.value = rms;
  } catch (e) {
    error.value = errMessage(e);
  }
}

async function refresh() {
  loading.value = true;
  error.value = '';
  try {
    appointments.value = await api<Appointment[]>('/appointments' + qs({ date: date.value }));
    const lists = await Promise.all(
      professionals.value.map((p) =>
        api<Slot[]>('/availability' + qs({ professionalId: p.id, date: date.value })).catch(
          () => [] as Slot[],
        ),
      ),
    );
    const map: Record<string, Slot[]> = {};
    professionals.value.forEach((p, i) => (map[p.id] = lists[i]));
    freeSlots.value = map;
  } catch (e) {
    error.value = errMessage(e, 'No se pudo cargar la agenda');
  } finally {
    loading.value = false;
  }
}

function toggleProf(id: string) {
  const next = new Set(hiddenProfs.value);
  next.has(id) ? next.delete(id) : next.add(id);
  hiddenProfs.value = next;
}

function openBooking(profId?: string, slot?: Slot | null) {
  if (!canBook.value) return;
  booking.value = { profId: profId ?? '', slot: slot ?? null };
}

async function onBooked() {
  booking.value = null;
  await refresh();
}

/** "¿Cuándo tenés lugar?" — escanea los próximos 7 días hasta encontrar huecos. */
async function findNextGap() {
  gapFinder.value = { loading: true, results: [] };
  const results: { date: string; profId: string; slots: Slot[] }[] = [];
  for (let i = 0; i < 7 && results.length < 4; i++) {
    const day = addDays(date.value, i);
    const lists = await Promise.all(
      visibleProfs.value.map((p) =>
        api<Slot[]>('/availability' + qs({ professionalId: p.id, date: day })).catch(
          () => [] as Slot[],
        ),
      ),
    );
    visibleProfs.value.forEach((p, idx) => {
      if (lists[idx].length) results.push({ date: day, profId: p.id, slots: lists[idx] });
    });
  }
  gapFinder.value = { loading: false, results };
}

function takeGap(day: string, profId: string, slot: Slot) {
  gapFinder.value = null;
  date.value = day;
  booking.value = { profId, slot };
}

function onKey(e: KeyboardEvent) {
  const el = e.target as HTMLElement;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable) return;
  if (booking.value || detail.value || gapFinder.value || ui.paletteOpen) return;
  if (e.key === 'ArrowLeft') date.value = addDays(date.value, -1);
  else if (e.key === 'ArrowRight') date.value = addDays(date.value, 1);
  else if (e.key.toLowerCase() === 't') date.value = todayISO();
  else if (e.key.toLowerCase() === 'n') openBooking();
}

watch(date, (d) => {
  router.replace({ query: { ...route.query, fecha: d } });
  refresh();
});
watch(view, (v) => localStorage.setItem('bemo_agenda_view', v));

onMounted(async () => {
  document.addEventListener('keydown', onKey);
  await loadBase();
  await refresh();
  if (route.query.nuevo === '1') openBooking();
});
onUnmounted(() => document.removeEventListener('keydown', onKey));
</script>

<template>
  <AppShell width="wide">
    <PageHeader title="Agenda" :subtitle="`${relativeDay(date)} · ${totals.active} turnos · ${totals.free} huecos libres`">
      <template #actions>
        <button class="btn secondary sm" @click="findNextGap">
          <UiIcon name="search" size="15" /> Buscar hueco
        </button>
        <button class="btn secondary sm" @click="refresh" :disabled="loading" aria-label="Actualizar">
          <UiIcon name="refresh" size="15" />
        </button>
        <button v-if="canBook" class="btn sm" @click="openBooking()">
          <UiIcon name="plus" size="15" /> Agendar turno
        </button>
      </template>
    </PageHeader>

    <div class="row mb-lg no-print">
      <DatePager v-model="date" />
      <div class="spacer"></div>
      <div class="segmented">
        <button :aria-pressed="view === 'grid'" @click="view = 'grid'">
          <UiIcon name="columns" size="14" style="vertical-align:-2px" /> Columnas
        </button>
        <button :aria-pressed="view === 'list'" @click="view = 'list'">
          <UiIcon name="list" size="14" style="vertical-align:-2px" /> Lista
        </button>
      </div>
    </div>

    <div class="row mb-lg no-print">
      <div style="flex:1;min-width:220px;max-width:340px">
        <SearchInput v-model="search" placeholder="Buscar paciente, DNI o motivo…" />
      </div>
      <select v-model="statusFilter" style="width:auto">
        <option value="activos">Turnos activos</option>
        <option value="todos">Todos los estados</option>
        <option value="scheduled">Agendados</option>
        <option value="confirmed">Confirmados</option>
        <option value="completed">Atendidos</option>
        <option value="cancelled">Cancelados</option>
        <option value="no_show">No vinieron</option>
      </select>
      <div class="spacer"></div>
      <div class="row tight">
        <button
          v-for="p in professionals"
          :key="p.id"
          class="chip"
          :class="{ gray: hiddenProfs.has(p.id) }"
          style="cursor:pointer;padding:4px 10px"
          :title="hiddenProfs.has(p.id) ? 'Mostrar' : 'Ocultar'"
          @click="toggleProf(p.id)"
        >
          <UiAvatar :name="p.full_name" size="sm" style="width:18px;height:18px;font-size:9px" />
          {{ p.full_name }}
        </button>
      </div>
    </div>

    <div v-if="error" class="alert err"><UiIcon name="alert-circle" size="16" />{{ error }}</div>

    <div v-if="loading" class="card pad"><UiSkeleton :rows="6" avatar /></div>

    <UiEmpty
      v-else-if="!professionals.length"
      icon="user-plus"
      title="Todavía no hay profesionales"
      desc="Invitá a los profesionales del consultorio y cargá sus horarios para empezar a agendar."
    >
      <router-link v-if="auth.isAdmin" class="btn sm" to="/configuracion/equipo">Invitar al equipo</router-link>
    </UiEmpty>

    <UiEmpty
      v-else-if="!visibleProfs.length"
      icon="filter"
      title="Ocultaste a todos los profesionales"
      desc="Volvé a activar al menos uno para ver la agenda."
    >
      <button class="btn secondary sm" @click="hiddenProfs = new Set()">Mostrar todos</button>
    </UiEmpty>

    <DayGrid
      v-else-if="view === 'grid'"
      :date="date"
      :professionals="visibleProfs"
      :appointments="filtered"
      :free-slots="freeSlots"
      :can-book="canBook"
      @pick-slot="(profId, slot) => openBooking(profId, slot)"
      @open-appt="(a) => (detail = a)"
    />

    <div v-else class="card flush">
      <div class="table-wrap">
        <table v-if="filtered.length">
          <thead>
            <tr>
              <th style="width:110px">Hora</th>
              <th>Paciente</th>
              <th class="desktop-only">Profesional</th>
              <th class="desktop-only">Consultorio</th>
              <th class="desktop-only">Motivo</th>
              <th>Estado</th>
              <th class="actions"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in filtered" :key="a.id">
              <td class="strong">{{ fmtTime(a.starts_at) }}–{{ fmtTime(a.ends_at) }}</td>
              <td>
                <div class="row tight nowrap">
                  <UiAvatar :name="fullName(a)" size="sm" neutral />
                  <div style="min-width:0">
                    <div class="truncate">{{ fullName(a) }}</div>
                    <div class="muted text-xs">DNI {{ a.dni }}</div>
                  </div>
                </div>
              </td>
              <td class="muted desktop-only">{{ profName(a.professional_id) }}</td>
              <td class="muted desktop-only">{{ roomName(a.room_id) }}</td>
              <td class="muted desktop-only truncate" style="max-width:180px">{{ a.reason || '—' }}</td>
              <td><StatusChip :status="a.status" /></td>
              <td class="actions">
                <div class="row tight nowrap end no-print">
                  <a
                    v-if="waLink(a.phone)"
                    class="icon-btn"
                    :href="waLink(a.phone)!"
                    target="_blank"
                    rel="noopener"
                    title="Avisar por WhatsApp"
                  >
                    <UiIcon name="whatsapp" size="16" />
                  </a>
                  <button class="btn ghost sm" @click="detail = a">Ver</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <UiEmpty
          v-else
          icon="calendar"
          title="No hay turnos para mostrar"
          :desc="search ? 'Ningún turno coincide con la búsqueda.' : 'Este día está libre.'"
        />
      </div>
    </div>

    <p class="muted text-xs mt-lg no-print">
      Atajos: <kbd>←</kbd> <kbd>→</kbd> cambiar de día · <kbd>T</kbd> hoy · <kbd>N</kbd> nuevo turno ·
      <kbd>{{ MOD_K }}</kbd> buscar
    </p>

    <BookingWizard
      v-if="booking"
      :professionals="professionals"
      :rooms="rooms"
      :initial-professional-id="booking.profId || null"
      :initial-slot="booking.slot"
      :initial-date="date"
      @close="booking = null"
      @booked="onBooked"
    />

    <AppointmentModal
      v-if="detail"
      :appt="detail"
      :professionals="professionals"
      :rooms="rooms"
      @close="detail = null"
      @updated="detail = null; refresh()"
    />

    <UiModal
      v-if="gapFinder"
      title="Próximos huecos disponibles"
      subtitle="Los primeros horarios libres a partir del día que estás viendo"
      size="md"
      @close="gapFinder = null"
    >
      <UiSkeleton v-if="gapFinder.loading" :rows="3" />
      <UiEmpty
        v-else-if="!gapFinder.results.length"
        icon="calendar-x"
        title="Sin huecos en los próximos 7 días"
        desc="Revisá los horarios de atención de los profesionales."
      />
      <div v-else class="stack">
        <div v-for="r in gapFinder.results" :key="r.date + r.profId" class="panel">
          <div class="row tight mb-sm">
            <UiAvatar :name="profName(r.profId)" size="sm" />
            <span class="strong text-sm">{{ profName(r.profId) }}</span>
            <span class="chip gray">{{ relativeDay(r.date) }} · {{ fmtDayShort(r.date) }}</span>
          </div>
          <div class="slots-grid">
            <button
              v-for="s in r.slots.slice(0, 8)"
              :key="s.start"
              class="slot"
              @click="takeGap(r.date, r.profId, s)"
            >
              {{ fmtTime(s.start) }}
            </button>
          </div>
        </div>
      </div>
    </UiModal>
  </AppShell>
</template>
