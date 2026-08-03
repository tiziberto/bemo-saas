<script setup lang="ts">
import UiIcon from './UiIcon.vue';

defineProps<{
  label: string;
  value: string | number;
  icon?: string;
  foot?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}>();
</script>

<template>
  <div class="stat">
    <div class="stat-top">
      <UiIcon v-if="icon" :name="icon" size="15" />
      <span class="stat-label">{{ label }}</span>
    </div>
    <div
      class="stat-value"
      :style="{
        color:
          tone === 'success'
            ? 'var(--success)'
            : tone === 'warning'
              ? 'var(--warning)'
              : tone === 'danger'
                ? 'var(--danger)'
                : 'var(--ink)',
      }"
    >
      {{ value }}
    </div>
    <div v-if="foot" class="stat-foot">{{ foot }}</div>
  </div>
</template>
