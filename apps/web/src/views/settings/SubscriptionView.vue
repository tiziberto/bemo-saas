<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppShell from '../../components/AppShell.vue';
import ChangePlanModal from '../../components/billing/ChangePlanModal.vue';
import PlanCard from '../../components/billing/PlanCard.vue';
import PlanCompareTable from '../../components/billing/PlanCompareTable.vue';
import SubscriptionStatusCard from '../../components/billing/SubscriptionStatusCard.vue';
import PageHeader from '../../components/ui/PageHeader.vue';
import StatCard from '../../components/ui/StatCard.vue';
import UiEmpty from '../../components/ui/UiEmpty.vue';
import UiIcon from '../../components/ui/UiIcon.vue';
import UiSkeleton from '../../components/ui/UiSkeleton.vue';
import { CATALOG } from '../../lib/billing/catalog';
import type { BillingCycle, PlanId } from '../../lib/billing/types';
import { fmtMoney, fmtMoneySigned } from '../../lib/format';
import { useSubscription } from '../../stores/subscription';
import { useUi } from '../../stores/ui';

const store = useSubscription();
const ui = useUi();

/** Ciclo que se está mirando en el comparador (no es el contratado). */
const previewCycle = ref<BillingCycle>('monthly');
const showChange = ref(false);

const seatsFoot = computed(() => {
  if (store.seats.source === 'fallback') return 'Estimado: no pudimos leer el equipo completo';
  if (store.seats.professionals === 0) return 'Todavía no cargaste profesionales';
  return store.seats.receptionists === 1
    ? '1 recepción incluida'
    : `${store.seats.receptionists} personas en recepción`;
});

async function confirmChange(planId: PlanId, cycle: BillingCycle) {
  await store.changePlan(planId, cycle);
  showChange.value = false;
  ui.success('Plan actualizado', 'Es una demostración: no se generó ningún cobro.');
}

async function pickPlan(planId: PlanId) {
  const ok = await ui.confirm({
    title: `¿Pasar al plan ${CATALOG.plans.find((p) => p.id === planId)!.name}?`,
    desc: `Nuevo abono: ${fmtMoney(store.quoteFor(planId, previewCycle.value).monthlyTotal)} por mes con ${store.seats.professionals || 1} profesional(es). Todavía no está conectado el cobro.`,
    confirmLabel: 'Cambiar de plan',
  });
  if (ok) await confirmChange(planId, previewCycle.value);
}

async function cancelRenewal() {
  const ok = await ui.confirm({
    title: '¿Cancelar la renovación?',
    desc: 'Vas a poder seguir usando bemo hasta el final del período. Después la clínica queda sin plan activo.',
    confirmLabel: 'Cancelar renovación',
    cancelLabel: 'Volver',
    danger: true,
  });
  if (ok) {
    await store.cancelRenewal();
    ui.info('Renovación cancelada', 'Podés reactivarla cuando quieras.');
  }
}

onMounted(() => {
  store.load();
  previewCycle.value = store.sub?.cycle ?? 'monthly';
});
</script>

<template>
  <AppShell width="wide">
    <PageHeader
      title="Suscripción"
      subtitle="Tu plan, el precio según el equipo y cuánto falta para el próximo cobro"
    >
      <template #actions>
        <button class="btn sm" :disabled="!store.sub" @click="showChange = true">
          <UiIcon name="credit-card" size="15" /> Cambiar de plan
        </button>
      </template>
    </PageHeader>

    <div v-if="store.isDemo" class="alert info">
      <UiIcon name="info" size="16" />
      <div>
        Los precios y el cálculo son reales. El cobro todavía no está conectado: cambiar de plan
        acá no genera ningún pago.
      </div>
    </div>

    <div v-if="store.loading && !store.sub" class="card pad"><UiSkeleton :rows="4" /></div>

    <div v-else-if="store.error" class="alert err">
      <UiIcon name="alert-circle" size="16" />{{ store.error }}
    </div>

    <template v-else-if="store.sub && store.plan && store.period">
      <SubscriptionStatusCard
        class="mb-xl"
        :plan="store.plan"
        :period="store.period"
        :quote="store.quote"
        :canceling="store.sub.cancelAtPeriodEnd"
        :saving="store.saving"
        @change="showChange = true"
        @cancel="cancelRenewal"
      />

      <div class="grid3 mb-xl">
        <StatCard
          label="Profesionales"
          :value="store.quote?.billableSeats ?? 1"
          icon="users"
          :foot="seatsFoot"
        />
        <StatCard
          label="Por profesional"
          :value="fmtMoney(store.plan.unitPriceMonthly)"
          icon="user"
          foot="IVA incluido"
        />
        <StatCard
          label="Total por mes"
          :value="fmtMoney(store.quote?.monthlyTotal ?? 0)"
          icon="credit-card"
          :foot="
            store.quote?.volumeDiscountPct
              ? `Con ${store.quote.volumeDiscountPct}% por volumen`
              : 'Sin descuentos'
          "
        />
      </div>

      <!-- Cómo se llega a ese número: la aritmética completa, verificable a mano -->
      <div class="card flush mb-xl">
        <div class="card-head">
          <UiIcon name="file-text" size="17" style="color:var(--muted)" />
          <h2>Cómo se calcula</h2>
        </div>
        <div class="table-wrap">
          <table>
            <tbody>
              <tr v-for="line in store.quote?.lines ?? []" :key="line.key">
                <td>
                  <div class="text-sm">{{ line.label }}</div>
                  <div v-if="line.detail" class="muted text-xs">{{ line.detail }}</div>
                </td>
                <td
                  class="num strong"
                  :style="line.kind === 'discount' ? 'color:var(--success)' : ''"
                >
                  {{ fmtMoneySigned(line.amount) }}
                </td>
              </tr>
              <tr>
                <td class="strong">Total por mes</td>
                <td class="num strong">{{ fmtMoney(store.quote?.monthlyTotal ?? 0) }}</td>
              </tr>
              <tr v-if="store.sub.cycle === 'annual'">
                <td class="muted text-sm">Se cobra una vez al año (10 meses)</td>
                <td class="num text-sm">{{ fmtMoney(store.quote?.chargeTotal ?? 0) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="card-foot muted text-xs">
          Precios con IVA incluido. Se cuentan los usuarios activos con rol profesional: quien es
          admin y profesional cuenta una sola vez.
        </div>
      </div>

      <!-- Planes -->
      <div class="row mb-md">
        <h2>Planes</h2>
        <div class="spacer"></div>
        <div class="segmented">
          <button
            v-for="c in CATALOG.cycles"
            :key="c.id"
            :aria-pressed="previewCycle === c.id"
            @click="previewCycle = c.id"
          >
            {{ c.label }}
          </button>
        </div>
        <span v-if="previewCycle === 'annual'" class="chip success">2 meses sin cargo</span>
      </div>

      <div class="grid3 mb-xl">
        <PlanCard
          v-for="p in CATALOG.plans"
          :key="p.id"
          :plan="p"
          :quote="store.quoteFor(p.id, previewCycle)"
          :cycle="previewCycle"
          :current="p.id === store.sub.planId && previewCycle === store.sub.cycle"
          @choose="pickPlan(p.id)"
        />
      </div>

      <div class="card flush mb-xl">
        <div class="card-head">
          <h2>Comparar en detalle</h2>
          <span class="muted text-xs" style="margin-left:auto">
            Lo marcado como “en desarrollo” todavía no está disponible
          </span>
        </div>
        <PlanCompareTable :current-plan-id="store.sub.planId" />
      </div>

      <div class="grid2 mb-xl" style="align-items:start">
        <div class="card pad-sm">
          <div class="row tight mb-sm">
            <UiIcon name="credit-card" size="17" style="color:var(--muted)" />
            <h3>Forma de pago</h3>
          </div>
          <p class="muted text-sm">
            Cuando activemos Mercado Pago vas a poder pagar con tarjeta, débito automático o
            transferencia.
          </p>
          <button class="btn secondary sm mt-md" disabled>Conectar Mercado Pago</button>
          <p class="hint">Disponible en una próxima versión.</p>
        </div>

        <div class="card flush">
          <div class="card-head"><h3>Historial de pagos</h3></div>
          <UiEmpty
            icon="file-text"
            title="Todavía no hay pagos"
            desc="Cuando se active el cobro vas a ver acá cada comprobante con su fecha e importe."
          />
        </div>
      </div>

      <div class="card pad-sm">
        <h3 class="mb-md">Preguntas frecuentes</h3>
        <div class="stack">
          <div>
            <div class="strong text-sm">¿Cómo se cuentan los profesionales?</div>
            <p class="muted text-sm">
              Se cobra por cada usuario activo con rol profesional. Un admin que también atiende
              cuenta una sola vez, y un admin que no atiende no se cobra. La recepción no paga:
              cada plan incluye su cupo.
            </p>
          </div>
          <div>
            <div class="strong text-sm">¿Y si sumo un profesional a mitad de mes?</div>
            <p class="muted text-sm">
              Se cobra la parte proporcional en el período siguiente. Si alguien deja la clínica,
              el abono baja desde el mes que viene.
            </p>
          </div>
          <div>
            <div class="strong text-sm">¿Qué pasa cuando termina la prueba?</div>
            <p class="muted text-sm">
              Nada se borra. Elegís un plan y seguís donde estabas; la agenda y las historias
              clínicas quedan intactas.
            </p>
          </div>
          <div>
            <div class="strong text-sm">¿Los precios se actualizan?</div>
            <p class="muted text-sm">
              La lista se revisa cada tres meses y te avisamos con 30 días de anticipación. Si
              pagás el año por adelantado, el precio queda fijo esos 12 meses.
            </p>
          </div>
        </div>
      </div>
    </template>

    <ChangePlanModal
      v-if="showChange && store.sub && store.quote"
      :current-plan-id="store.sub.planId"
      :current-cycle="store.sub.cycle"
      :current-quote="store.quote"
      :quote-for="store.quoteFor"
      :saving="store.saving"
      @close="showChange = false"
      @confirm="confirmChange"
    />
  </AppShell>
</template>
