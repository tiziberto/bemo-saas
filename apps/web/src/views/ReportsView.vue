<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import AppShell from '../components/AppShell.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import StatCard from '../components/ui/StatCard.vue';
import UiAvatar from '../components/ui/UiAvatar.vue';
import UiEmpty from '../components/ui/UiEmpty.vue';
import UiIcon from '../components/ui/UiIcon.vue';
import UiSkeleton from '../components/ui/UiSkeleton.vue';
import { api, errMessage, qs } from '../lib/api';
import { addDays, addMonths, fmtDate, fmtMinutes, todayISO } from '../lib/format';
import type { DailyPoint, ProfessionalReport } from '../lib/types';
import { useAuth } from '../stores/auth';

const auth = useAuth();

const RANGES = [
  { id: '30d', label: 'Últimos 30 días', days: 30 },
  { id: '90d', label: 'Últimos 3 meses', days: 90 },
  { id: '365d', label: 'Último año', days: 365 },
] as const;

const range = ref<'30d' | '90d' | '365d' | 'custom'>('30d');
const from = ref(addDays(todayISO(), -29));
const to = ref(todayISO());
const rows = ref<ProfessionalReport[]>([]);
const daily = ref<DailyPoint[]>([]);
const loading = ref(true);
const error = ref('');

function pickRange(id: '30d' | '90d' | '365d') {
  range.value = id;
  const days = RANGES.find((r) => r.id === id)!.days;
  from.value = addDays(todayISO(), -(days - 1));
  to.value = todayISO();
}

const totals = computed(() => {
  const t = rows.value.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      completed: acc.completed + r.completed,
      no_show: acc.no_show + r.no_show,
      cancelled: acc.cancelled + r.cancelled,
      booked: acc.booked + r.booked_minutes,
      available: acc.available + r.available_minutes,
      nuevos: acc.nuevos + r.new_patients,
    }),
    { total: 0, completed: 0, no_show: 0, cancelled: 0, booked: 0, available: 0, nuevos: 0 },
  );
  const cerrados = t.completed + t.no_show;
  return {
    ...t,
    noShowRate: cerrados ? Math.round((t.no_show / cerrados) * 1000) / 10 : 0,
    occupancy: t.available ? Math.round((t.booked / t.available) * 1000) / 10 : 0,
  };
});

/** Altura relativa de cada barra de la serie diaria. */
const maxDaily = computed(() => Math.max(1, ...daily.value.map((d) => d.total)));

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [summary, series] = await Promise.all([
      api<ProfessionalReport[]>('/reports/summary' + qs({ from: from.value, to: to.value })),
      api<DailyPoint[]>('/reports/daily' + qs({ from: from.value, to: to.value })),
    ]);
    rows.value = summary;
    daily.value = series;
  } catch (e) {
    error.value = errMessage(e, 'No se pudieron cargar los reportes');
  } finally {
    loading.value = false;
  }
}

function exportCsv() {
  const head = [
    'Profesional',
    'Turnos',
    'Atendidos',
    'No vinieron',
    'Cancelados',
    '% no-show',
    'Minutos agendados',
    'Minutos disponibles',
    '% ocupación',
    'Pacientes nuevos',
  ];
  const lines = rows.value.map((r) =>
    [
      `"${r.full_name}"`,
      r.total,
      r.completed,
      r.no_show,
      r.cancelled,
      r.no_show_rate,
      r.booked_minutes,
      r.available_minutes,
      r.occupancy_rate,
      r.new_patients,
    ].join(','),
  );
  const csv = [head.join(','), ...lines].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `bemo-reporte-${from.value}_${to.value}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

watch([from, to], load);
onMounted(load);
</script>

<template>
  <AppShell width="wide">
    <PageHeader
      title="Reportes"
      :subtitle="`${fmtDate(from)} al ${fmtDate(to)}`"
    >
      <template #actions>
        <button class="btn secondary sm" :disabled="!rows.length" @click="exportCsv">
          <UiIcon name="download" size="15" /> Exportar CSV
        </button>
      </template>
    </PageHeader>

    <div class="row mb-lg no-print">
      <div class="segmented">
        <button
          v-for="r in RANGES"
          :key="r.id"
          :aria-pressed="range === r.id"
          @click="pickRange(r.id)"
        >
          {{ r.label }}
        </button>
      </div>
      <div class="spacer"></div>
      <div class="row tight">
        <label class="label" style="margin:0">Desde</label>
        <input type="date" v-model="from" style="width:150px" @change="range = 'custom'" />
        <label class="label" style="margin:0">Hasta</label>
        <input type="date" v-model="to" style="width:150px" @change="range = 'custom'" />
      </div>
    </div>

    <div v-if="error" class="alert err"><UiIcon name="alert-circle" size="16" />{{ error }}</div>

    <div v-if="loading" class="card pad"><UiSkeleton :rows="4" avatar /></div>

    <template v-else-if="rows.length">
      <div class="grid4 mb-xl">
        <StatCard
          label="Turnos del período"
          :value="totals.total"
          icon="calendar"
          :foot="`${totals.completed} atendidos`"
        />
        <StatCard
          label="Tasa de ausentismo"
          :value="`${totals.noShowRate}%`"
          icon="alert-triangle"
          :tone="totals.noShowRate > 15 ? 'danger' : totals.noShowRate > 8 ? 'warning' : 'success'"
          :foot="`${totals.no_show} no vinieron · ${totals.cancelled} cancelaron`"
        />
        <StatCard
          label="Ocupación"
          :value="`${totals.occupancy}%`"
          icon="clock"
          :foot="`${fmtMinutes(totals.booked)} de ${fmtMinutes(totals.available)}`"
        />
        <StatCard
          label="Pacientes nuevos"
          :value="totals.nuevos"
          icon="user-plus"
          foot="Altas del período"
        />
      </div>

      <!-- Serie diaria: la forma del período de un vistazo -->
      <div class="card pad-sm mb-xl">
        <div class="row tight mb-md">
          <UiIcon name="activity" size="17" style="color:var(--muted)" />
          <h2>Turnos por día</h2>
          <span class="muted text-xs" style="margin-left:auto">
            La franja más oscura son las ausencias
          </span>
        </div>
        <div
          style="display:flex;align-items:flex-end;gap:2px;height:120px"
          role="img"
          aria-label="Turnos por día del período"
        >
          <div
            v-for="d in daily"
            :key="d.date"
            :title="`${fmtDate(d.date)}: ${d.total} turnos · ${d.no_show} ausencias`"
            :style="{
              flex: '1 1 0',
              minWidth: '2px',
              height: Math.max(2, (d.total / maxDaily) * 100) + '%',
              background: 'var(--teal-tint)',
              borderTop: '2px solid var(--teal)',
              borderRadius: '2px 2px 0 0',
              position: 'relative',
              display: 'flex',
              alignItems: 'flex-end',
            }"
          >
            <div
              v-if="d.no_show"
              :style="{
                width: '100%',
                height: (d.no_show / Math.max(d.total, 1)) * 100 + '%',
                background: 'var(--danger)',
                opacity: 0.75,
                borderRadius: '2px',
              }"
            ></div>
          </div>
        </div>
      </div>

      <div class="card flush">
        <div class="card-head">
          <h2>Por profesional</h2>
          <span class="muted text-xs" style="margin-left:auto">
            El ausentismo se mide sobre los turnos que llegaron a término
          </span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Profesional</th>
                <th class="num">Turnos</th>
                <th class="num">Atendidos</th>
                <th class="num">No vinieron</th>
                <th class="num">% ausentismo</th>
                <th class="num">Ocupación</th>
                <th class="num">Nuevos</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in rows" :key="r.professional_id">
                <td>
                  <div class="row tight nowrap">
                    <UiAvatar :name="r.full_name" size="sm" />
                    <span class="truncate">{{ r.full_name }}</span>
                  </div>
                </td>
                <td class="num">{{ r.total }}</td>
                <td class="num">{{ r.completed }}</td>
                <td class="num">{{ r.no_show }}</td>
                <td class="num">
                  <span
                    class="chip"
                    :class="
                      r.no_show_rate > 15 ? 'danger' : r.no_show_rate > 8 ? 'warning' : 'gray'
                    "
                  >
                    {{ r.no_show_rate }}%
                  </span>
                </td>
                <td class="num">
                  <div class="row tight nowrap" style="justify-content:flex-end">
                    <div class="meter" style="width:56px">
                      <div
                        class="meter-fill"
                        :style="{ width: Math.min(100, r.occupancy_rate) + '%' }"
                      ></div>
                    </div>
                    <span class="text-sm">{{ r.occupancy_rate }}%</span>
                  </div>
                </td>
                <td class="num">{{ r.new_patients }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="card-foot muted text-xs">
          Ocupación = minutos agendados sobre los minutos de atención configurados en
          Horarios. Si un profesional no tiene horarios cargados, su ocupación es 0.
        </div>
      </div>
    </template>

    <UiEmpty
      v-else
      icon="activity"
      title="Todavía no hay números para mostrar"
      :desc="
        auth.isAdmin
          ? 'Cuando el consultorio tenga turnos en este período vas a ver acá la foto del mes.'
          : 'Cuando tengas turnos en este período vas a ver acá tus números.'
      "
    />
  </AppShell>
</template>
