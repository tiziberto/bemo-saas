<script setup lang="ts">
import { computed, ref } from 'vue';
import { CATALOG } from '../../lib/billing/catalog';
import { quoteDelta, receptionLabel } from '../../lib/billing/quote';
import type { BillingCycle, PlanId, Quote } from '../../lib/billing/types';
import { fmtMoney } from '../../lib/format';
import UiIcon from '../ui/UiIcon.vue';
import UiModal from '../ui/UiModal.vue';

const props = defineProps<{
  currentPlanId: PlanId;
  currentCycle: BillingCycle;
  currentQuote: Quote;
  quoteFor: (planId: PlanId, cycle: BillingCycle) => Quote;
  saving: boolean;
}>();
const emit = defineEmits<{ close: []; confirm: [planId: PlanId, cycle: BillingCycle] }>();

const planId = ref<PlanId>(props.currentPlanId);
const cycle = ref<BillingCycle>(props.currentCycle);

const next = computed(() => props.quoteFor(planId.value, cycle.value));
const delta = computed(() => quoteDelta(props.currentQuote, next.value));
const unchanged = computed(
  () => planId.value === props.currentPlanId && cycle.value === props.currentCycle,
);
const plan = computed(() => CATALOG.plans.find((p) => p.id === planId.value)!);
</script>

<template>
  <UiModal
    title="Cambiar de plan"
    subtitle="El precio se calcula con los profesionales que tenés hoy"
    size="md"
    @close="emit('close')"
  >
    <div class="stack-sm">
      <label
        v-for="p in CATALOG.plans"
        :key="p.id"
        class="panel row tight nowrap"
        style="cursor:pointer;align-items:flex-start"
        :style="planId === p.id ? 'border-color:var(--teal);background:var(--teal-tint)' : ''"
      >
        <input
          type="radio"
          :value="p.id"
          v-model="planId"
          style="width:16px;margin-top:3px;accent-color:var(--teal)"
        />
        <span style="min-width:0;flex:1">
          <span class="row tight">
            <span class="strong text-sm">{{ p.name }}</span>
            <span v-if="p.id === currentPlanId" class="chip gray">Actual</span>
          </span>
          <span class="muted text-xs" style="display:block">
            {{ p.tagline }} · {{ receptionLabel(p) }}
          </span>
        </span>
        <span class="text-sm strong" style="white-space:nowrap">
          {{ fmtMoney(quoteFor(p.id, cycle).monthlyTotal) }}
          <span class="muted text-xs">/mes</span>
        </span>
      </label>
    </div>

    <div class="row mt-lg">
      <span class="label" style="margin:0">Ciclo</span>
      <div class="segmented">
        <button
          v-for="c in CATALOG.cycles"
          :key="c.id"
          type="button"
          :aria-pressed="cycle === c.id"
          @click="cycle = c.id"
        >
          {{ c.label }}
        </button>
      </div>
      <span v-if="cycle === 'annual'" class="chip success">2 meses sin cargo</span>
    </div>

    <div class="panel mt-lg">
      <div class="row tight nowrap">
        <span class="text-sm muted">Ahora</span>
        <span class="text-sm" style="margin-left:auto">
          {{ fmtMoney(currentQuote.monthlyTotal) }} / mes
        </span>
      </div>
      <div class="row tight nowrap" style="margin-top:6px">
        <span class="text-sm muted">Con {{ plan.name }}</span>
        <span class="text-sm strong" style="margin-left:auto">
          {{ fmtMoney(next.monthlyTotal) }} / mes
        </span>
      </div>
      <hr class="divider" style="margin:10px 0" />
      <div class="row tight nowrap">
        <span class="text-sm strong">
          {{
            delta.direction === 'up'
              ? 'Pagarías más'
              : delta.direction === 'down'
                ? 'Pagarías menos'
                : 'Mismo precio'
          }}
        </span>
        <span
          class="text-sm strong"
          style="margin-left:auto"
          :style="{
            color:
              delta.direction === 'up'
                ? 'var(--ink)'
                : delta.direction === 'down'
                  ? 'var(--success)'
                  : 'var(--muted)',
          }"
        >
          {{ delta.direction === 'same' ? '—' : fmtMoney(Math.abs(delta.amount)) }}
          <span v-if="delta.direction !== 'same'" class="muted text-xs">/ mes</span>
        </span>
      </div>
      <div v-if="cycle === 'annual'" class="muted text-xs" style="margin-top:8px">
        Se cobraría {{ fmtMoney(next.chargeTotal) }} una vez al año.
      </div>
    </div>

    <p class="hint">
      Es una demostración: confirmar cambia el plan en pantalla, no genera ningún cobro.
    </p>

    <template #footer>
      <button class="btn secondary" @click="emit('close')">Cancelar</button>
      <button
        class="btn"
        :disabled="saving || unchanged"
        @click="emit('confirm', planId, cycle)"
      >
        <span v-if="saving" class="spinner"></span>
        <UiIcon v-else name="check" size="15" />
        {{ unchanged ? 'Es tu plan actual' : `Cambiar a ${plan.name}` }}
      </button>
    </template>
  </UiModal>
</template>
