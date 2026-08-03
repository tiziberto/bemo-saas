<script setup lang="ts">
import { computed } from 'vue';
import { CATALOG } from '../../lib/billing/catalog';
import { receptionLabel } from '../../lib/billing/quote';
import type { BillingCycle, Plan, Quote } from '../../lib/billing/types';
import { fmtMoney } from '../../lib/format';
import UiIcon from '../ui/UiIcon.vue';

const props = defineProps<{
  plan: Plan;
  quote: Quote;
  cycle: BillingCycle;
  current: boolean;
}>();
const emit = defineEmits<{ choose: [] }>();

/** Lo que ESTE plan agrega y se destaca en la tarjeta (máx. 3). */
const highlights = computed(() =>
  CATALOG.features.filter((f) => f.highlightIn === props.plan.id).slice(0, 3),
);
</script>

<template>
  <div
    class="card pad-sm"
    :style="current ? 'border-color:var(--teal);box-shadow:var(--sh-2)' : ''"
    style="display:flex;flex-direction:column;gap:var(--s-md)"
  >
    <div class="row tight">
      <h3>{{ plan.name }}</h3>
      <span v-if="current" class="chip">Tu plan</span>
      <span v-else-if="plan.badge" class="chip gray">{{ plan.badge }}</span>
    </div>

    <p class="muted text-sm" style="min-height:38px">{{ plan.tagline }}</p>

    <div>
      <div class="row tight" style="align-items:baseline;gap:6px">
        <span
          style="font-family:'General Sans',sans-serif;font-size:26px;font-weight:600;letter-spacing:-0.02em"
        >
          {{ fmtMoney(plan.unitPriceMonthly) }}
        </span>
        <span class="muted text-xs">por profesional / mes</span>
      </div>
      <div class="muted text-xs" style="margin-top:4px">
        {{ fmtMoney(quote.monthlyTotal) }} por mes para {{ quote.billableSeats }}
        profesional{{ quote.billableSeats === 1 ? '' : 'es' }}
        <template v-if="quote.volumeDiscountPct"> · −{{ quote.volumeDiscountPct }}%</template>
      </div>
      <div v-if="cycle === 'annual'" class="text-xs" style="color:var(--success);margin-top:2px">
        {{ fmtMoney(quote.chargeTotal) }} al año · ahorrás {{ fmtMoney(quote.annualSavings) }}
      </div>
    </div>

    <ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px">
      <li class="row tight nowrap" style="align-items:flex-start;gap:7px">
        <UiIcon name="users" size="15" style="color:var(--muted);margin-top:2px" />
        <span class="text-sm">{{ receptionLabel(plan) }}</span>
      </li>
      <li
        v-for="f in highlights"
        :key="f.key"
        class="row tight nowrap"
        style="align-items:flex-start;gap:7px"
      >
        <UiIcon name="check" size="15" style="color:var(--teal);margin-top:2px" />
        <span class="text-sm">
          {{ f.label }}
          <span v-if="f.status === 'soon'" class="muted-2 text-xs">· en desarrollo</span>
        </span>
      </li>
    </ul>

    <div class="spacer"></div>

    <!-- Un solo botón sólido por fila: el plan destacado. El resto, secundarios. -->
    <button
      class="btn w-full"
      :class="current || !plan.badge ? 'secondary' : ''"
      :disabled="current"
      @click="emit('choose')"
    >
      {{ current ? 'Plan actual' : `Elegir ${plan.name}` }}
    </button>
  </div>
</template>
