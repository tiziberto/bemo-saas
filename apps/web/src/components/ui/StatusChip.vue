<script setup lang="ts">
import { computed } from 'vue';
import { APPOINTMENT_STATUS } from '../../lib/format';

const props = defineProps<{ status: string }>();
const meta = computed(
  () => APPOINTMENT_STATUS[props.status] ?? { label: props.status, chip: 'gray' },
);
</script>

<template>
  <span class="chip" :class="meta.chip"><span class="dot"></span>{{ meta.label }}</span>
</template>
