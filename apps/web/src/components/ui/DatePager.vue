<script setup lang="ts">
import { computed } from 'vue';
import { addDays, fmtDayLong, relativeDay, todayISO } from '../../lib/format';
import UiIcon from './UiIcon.vue';

const model = defineModel<string>({ required: true });
const props = withDefaults(defineProps<{ step?: number }>(), { step: 1 });

const isToday = computed(() => model.value === todayISO());
const label = computed(() => {
  const rel = relativeDay(model.value);
  const long = fmtDayLong(model.value);
  const text = rel === long ? long : `${rel} · ${long}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
});

function move(dir: number) {
  model.value = addDays(model.value, dir * props.step);
}
</script>

<template>
  <div class="row tight nowrap">
    <div class="segmented" style="padding:2px">
      <button aria-label="Anterior" @click="move(-1)" style="padding:5px 8px">
        <UiIcon name="chevron-left" size="16" />
      </button>
      <button aria-label="Siguiente" @click="move(1)" style="padding:5px 8px">
        <UiIcon name="chevron-right" size="16" />
      </button>
    </div>
    <button class="btn secondary sm" :disabled="isToday" @click="model = todayISO()">
      Hoy
    </button>
    <div class="col" style="min-width:0">
      <label class="hidden" for="date-pager">Fecha</label>
      <input id="date-pager" type="date" v-model="model" style="width:150px" />
    </div>
    <span class="muted text-sm truncate desktop-only">{{ label }}</span>
  </div>
</template>
