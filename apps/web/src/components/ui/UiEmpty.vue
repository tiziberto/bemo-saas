<script setup lang="ts">
import UiIcon from './UiIcon.vue';

withDefaults(
  defineProps<{ icon?: string; title: string; desc?: string }>(),
  { icon: 'info' },
);
</script>

<template>
  <div class="empty">
    <div class="empty-icon"><UiIcon :name="icon" size="20" /></div>
    <div class="empty-title">{{ title }}</div>
    <p v-if="desc" class="empty-desc">{{ desc }}</p>
    <div v-if="$slots.default" class="empty-action"><slot /></div>
  </div>
</template>
