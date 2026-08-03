<script setup lang="ts">
import { computed } from 'vue';
import type { PeriodView } from '../../lib/billing/period';
import { receptionLabel } from '../../lib/billing/quote';
import type { Plan, Quote } from '../../lib/billing/types';
import { fmtMoney } from '../../lib/format';
import UiIcon from '../ui/UiIcon.vue';

const props = defineProps<{
  plan: Plan;
  period: PeriodView;
  quote: Quote | null;
  canceling: boolean;
  saving: boolean;
}>();
const emit = defineEmits<{ change: []; cancel: [] }>();

const fillClass = computed(() =>
  props.period.tone === 'danger' ? 'danger' : props.period.tone === 'warning' ? 'warning' : '',
);
</script>

<template>
  <div class="card pad">
    <div class="row nowrap" style="align-items:flex-start;gap:var(--s-lg)">
      <div style="min-width:0;flex:1">
        <div class="eyebrow">Tu plan</div>
        <div class="row tight" style="margin:4px 0 6px">
          <h2 style="font-size:20px">{{ plan.name }}</h2>
          <span class="chip" :class="period.chip.cls">
            <span class="dot"></span>{{ period.chip.text }}
          </span>
        </div>
        <p class="muted text-sm">{{ period.sub }}</p>
        <p class="muted-2 text-xs" style="margin-top:6px">
          {{ receptionLabel(plan) }} · {{ quote?.billableSeats ?? 1 }} profesional{{
            (quote?.billableSeats ?? 1) === 1 ? '' : 'es'
          }}
        </p>
      </div>

      <div style="text-align:right">
        <div
          style="font-family:'General Sans',sans-serif;font-size:38px;font-weight:600;line-height:1;letter-spacing:-0.02em;font-variant-numeric:tabular-nums"
          :style="{
            color:
              period.tone === 'danger'
                ? 'var(--danger)'
                : period.tone === 'warning'
                  ? 'var(--warning)'
                  : 'var(--ink)',
          }"
        >
          {{ period.count }}
        </div>
        <div class="muted text-xs" style="margin-top:4px">{{ period.unit }}</div>
      </div>
    </div>

    <div
      v-if="period.progressPct !== null"
      class="meter mt-lg"
      role="progressbar"
      :aria-valuenow="period.progressPct"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="period.headline"
    >
      <div class="meter-fill" :class="fillClass" :style="{ width: period.progressPct + '%' }"></div>
    </div>

    <hr class="divider" />

    <div class="row tight">
      <span class="text-sm muted">
        <template v-if="quote">
          {{ fmtMoney(quote.monthlyTotal) }} por mes
          <template v-if="quote.cycle === 'annual'">
            · se cobra {{ fmtMoney(quote.chargeTotal) }} una vez al año
          </template>
        </template>
      </span>
      <div class="spacer"></div>
      <button
        v-if="!canceling && period.kind !== 'ended'"
        class="btn ghost sm"
        :disabled="saving"
        @click="emit('cancel')"
      >
        Cancelar renovación
      </button>
      <button class="btn secondary sm" :disabled="saving" @click="emit('change')">
        <UiIcon name="refresh" size="15" /> Cambiar de plan
      </button>
    </div>
  </div>
</template>
