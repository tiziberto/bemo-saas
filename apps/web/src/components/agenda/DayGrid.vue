<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import {
  durationMinutes,
  fmtTime,
  fullName,
  minutesOfDay,
  minutesToLabel,
  todayISO,
} from '../../lib/format';
import type { Appointment, Professional, Slot } from '../../lib/types';
import UiAvatar from '../ui/UiAvatar.vue';
import UiIcon from '../ui/UiIcon.vue';

const props = defineProps<{
  date: string;
  professionals: Professional[];
  appointments: Appointment[];
  freeSlots: Record<string, Slot[]>;
  canBook: boolean;
}>();
const emit = defineEmits<{
  pickSlot: [profId: string, slot: Slot];
  openAppt: [appt: Appointment];
}>();

const HOUR_H = 76; // px por hora — densidad cómoda-compacta (DESIGN.md)
const PX = HOUR_H / 60;
const PAD = 10; // aire arriba para que la primera etiqueta de hora no se corte

/** La ventana visible se ajusta a lo que hay: horarios + turnos, con 8–19 de piso. */
const range = computed(() => {
  const mins: number[] = [];
  for (const a of props.appointments) {
    mins.push(minutesOfDay(a.starts_at), minutesOfDay(a.ends_at));
  }
  for (const list of Object.values(props.freeSlots)) {
    for (const s of list) mins.push(minutesOfDay(s.start), minutesOfDay(s.end));
  }
  const min = mins.length ? Math.min(...mins, 8 * 60) : 8 * 60;
  const max = mins.length ? Math.max(...mins, 19 * 60) : 19 * 60;
  return {
    start: Math.floor(min / 60) * 60,
    end: Math.ceil(max / 60) * 60,
  };
});

const height = computed(() => (range.value.end - range.value.start) * PX + PAD * 2);
const hours = computed(() => {
  const out: number[] = [];
  for (let m = range.value.start; m <= range.value.end; m += 60) out.push(m);
  return out;
});

const gridStyle = computed(() => ({
  gridTemplateColumns: `56px repeat(${Math.max(props.professionals.length, 1)}, minmax(170px, 1fr))`,
}));

function top(iso: string): number {
  return PAD + (minutesOfDay(iso) - range.value.start) * PX;
}

function apptHeight(a: Appointment) {
  return Math.max(durationMinutes(a.starts_at, a.ends_at) * PX - 3, 22);
}
function apptStyle(a: Appointment) {
  return { top: `${top(a.starts_at)}px`, height: `${apptHeight(a)}px` };
}
/** Los turnos cortos van en una línea: si no, el nombre queda cortado. */
function apptClass(a: Appointment) {
  const h = apptHeight(a);
  return [a.status, { compact: h < 46, short: h < 66 }];
}

function slotStyle(s: Slot) {
  const h = Math.max(durationMinutes(s.start, s.end) * PX - 3, 18);
  return { top: `${top(s.start)}px`, height: `${h}px` };
}

function apptsOf(profId: string) {
  return props.appointments.filter((a) => a.professional_id === profId);
}
function slotsOf(profId: string) {
  return props.canBook ? (props.freeSlots[profId] ?? []) : [];
}
function activeCount(profId: string) {
  return apptsOf(profId).filter((a) => a.status !== 'cancelled').length;
}

// Línea de "ahora": sólo tiene sentido si estamos mirando el día de hoy.
const nowMin = ref(currentMinutes());
let timer: number | undefined;
function currentMinutes() {
  const d = new Date();
  return minutesOfDay(d.toISOString());
}
onMounted(() => {
  timer = window.setInterval(() => (nowMin.value = currentMinutes()), 60000);
});
onUnmounted(() => clearInterval(timer));

const showNow = computed(
  () =>
    props.date === todayISO() &&
    nowMin.value >= range.value.start &&
    nowMin.value <= range.value.end,
);
const nowTop = computed(() => PAD + (nowMin.value - range.value.start) * PX);
</script>

<template>
  <div class="agenda">
    <div class="agenda-head" :style="gridStyle">
      <div class="col-head">
        <span class="text-xs muted">{{ minutesToLabel(range.start) }}–{{ minutesToLabel(range.end) }}</span>
      </div>
      <div v-for="p in professionals" :key="p.id" class="col-head">
        <UiAvatar :name="p.full_name" size="sm" />
        <div style="min-width:0">
          <div class="col-name truncate">{{ p.full_name }}</div>
          <div class="col-meta">
            {{ activeCount(p.id) }} turno{{ activeCount(p.id) === 1 ? '' : 's' }} ·
            {{ slotsOf(p.id).length }} libre{{ slotsOf(p.id).length === 1 ? '' : 's' }}
          </div>
        </div>
      </div>
    </div>

    <div class="agenda-body" :style="gridStyle">
      <div class="time-col" :style="{ height: height + 'px', position: 'relative' }">
        <span
          v-for="h in hours"
          :key="h"
          class="time-label"
          :style="{ top: PAD + (h - range.start) * (HOUR_H / 60) + 'px' }"
        >
          {{ minutesToLabel(h) }}
        </span>
      </div>

      <div
        v-for="p in professionals"
        :key="p.id"
        class="day-col lines"
        :style="{
          height: height + 'px',
          '--hour-h': HOUR_H + 'px',
          backgroundPosition: `0 ${PAD}px`,
        }"
      >
        <button
          v-for="s in slotsOf(p.id)"
          :key="s.start"
          class="slot-free"
          :style="slotStyle(s)"
          :title="`Agendar ${fmtTime(s.start)}`"
          @click="emit('pickSlot', p.id, s)"
        >
          <span class="plus row tight nowrap" style="gap:3px">
            <UiIcon name="plus" size="12" />{{ fmtTime(s.start) }}
          </span>
        </button>

        <button
          v-for="a in apptsOf(p.id)"
          :key="a.id"
          class="appt"
          :class="apptClass(a)"
          :style="apptStyle(a)"
          @click="emit('openAppt', a)"
        >
          <div class="appt-time">{{ fmtTime(a.starts_at) }}–{{ fmtTime(a.ends_at) }}</div>
          <div class="appt-name">{{ fullName(a) }}</div>
          <div v-if="a.reason" class="appt-reason">{{ a.reason }}</div>
        </button>

        <div v-if="showNow" class="now-line" :style="{ top: nowTop + 'px' }"></div>
      </div>
    </div>
  </div>
</template>
