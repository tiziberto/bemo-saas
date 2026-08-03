<script setup lang="ts">
import { computed } from 'vue';
import { ICONS } from '../../lib/icons';

const props = withDefaults(defineProps<{ name: string; size?: number | string }>(), {
  size: 18,
});
const path = computed(() => ICONS[props.name] ?? '');
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="path"
  />
</template>
