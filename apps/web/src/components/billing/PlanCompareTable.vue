<script setup lang="ts">
import { computed } from 'vue';
import { CATALOG, FEATURE_GROUP_LABEL } from '../../lib/billing/catalog';
import { receptionShort } from '../../lib/billing/quote';
import type { PlanId } from '../../lib/billing/types';
import UiIcon from '../ui/UiIcon.vue';

defineProps<{ currentPlanId: PlanId | null }>();

const plans = CATALOG.plans;

/** Features agrupadas, en el orden canónico del catálogo. */
const groups = computed(() => {
  const out: { key: string; label: string; items: typeof CATALOG.features }[] = [];
  for (const f of CATALOG.features) {
    const last = out[out.length - 1];
    if (last && last.key === f.group) last.items.push(f);
    else out.push({ key: f.group, label: FEATURE_GROUP_LABEL[f.group] ?? f.group, items: [f] });
  }
  return out;
});

function has(planId: PlanId, featureKey: string): boolean {
  return plans.find((p) => p.id === planId)!.featureKeys.includes(featureKey);
}
</script>

<template>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th style="min-width:240px">Qué incluye</th>
          <th v-for="p in plans" :key="p.id" style="text-align:center;min-width:110px">
            {{ p.name }}
          </th>
        </tr>
      </thead>
      <tbody>
        <template v-for="g in groups" :key="g.key">
          <tr>
            <td :colspan="plans.length + 1" style="background:var(--surface-2)">
              <span class="eyebrow">{{ g.label }}</span>
            </td>
          </tr>
          <tr v-for="f in g.items" :key="f.key">
            <td>
              <div class="text-sm">
                {{ f.label }}
                <span v-if="f.status === 'soon'" class="chip gray" style="margin-left:6px">
                  En desarrollo
                </span>
              </div>
              <div v-if="f.detail" class="muted text-xs" style="margin-top:2px">{{ f.detail }}</div>
            </td>
            <td
              v-for="p in plans"
              :key="p.id"
              style="text-align:center"
              :style="p.id === currentPlanId ? 'background:var(--teal-tint)' : ''"
            >
              <UiIcon
                v-if="has(p.id, f.key)"
                name="check"
                size="16"
                style="color:var(--success)"
                :aria-label="`Incluido en ${p.name}`"
              />
              <span v-else class="muted-2" :aria-label="`No incluido en ${p.name}`">—</span>
            </td>
          </tr>
        </template>

        <tr>
          <td class="strong text-sm">Recepción</td>
          <td
            v-for="p in plans"
            :key="p.id"
            class="text-sm"
            style="text-align:center"
            :style="p.id === currentPlanId ? 'background:var(--teal-tint)' : ''"
          >
            {{ receptionShort(p) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
