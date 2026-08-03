<script setup lang="ts">
import { computed } from 'vue';
import { initials } from '../../lib/format';

const props = withDefaults(
  defineProps<{ name?: string | null; size?: 'sm' | 'md' | 'lg'; neutral?: boolean }>(),
  { size: 'md', neutral: false },
);
const text = computed(() => initials(props.name));
</script>

<template>
  <span class="avatar" :class="[size === 'md' ? '' : size, { neutral }]" :title="name || ''">{{ text }}</span>
</template>
