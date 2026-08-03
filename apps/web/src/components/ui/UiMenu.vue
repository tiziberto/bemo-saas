<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

// Menú desplegable genérico: el slot `trigger` abre, el slot por defecto es el panel.
withDefaults(defineProps<{ align?: 'left' | 'right'; width?: string }>(), {
  align: 'right',
  width: '230px',
});

const open = ref(false);
const root = ref<HTMLElement | null>(null);

function onDocClick(e: MouseEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) {
    open.value = false;
  }
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false;
}
onMounted(() => {
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onKey);
});
onUnmounted(() => {
  document.removeEventListener('click', onDocClick);
  document.removeEventListener('keydown', onKey);
});
</script>

<template>
  <div ref="root" style="position:relative">
    <div @click="open = !open">
      <slot name="trigger" :open="open" />
    </div>
    <div
      v-if="open"
      class="menu"
      :style="{
        width,
        top: 'calc(100% + 6px)',
        left: align === 'left' ? '0' : 'auto',
        right: align === 'right' ? '0' : 'auto',
      }"
      @click="open = false"
    >
      <slot />
    </div>
  </div>
</template>
