<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import UiIcon from './UiIcon.vue';

withDefaults(
  defineProps<{ title: string; subtitle?: string; size?: 'sm' | 'md' | 'lg' }>(),
  { size: 'sm' },
);
const emit = defineEmits<{ close: [] }>();

const dialog = ref<HTMLElement | null>(null);

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close');
}
onMounted(() => {
  document.addEventListener('keydown', onKey);
  document.body.style.overflow = 'hidden';
  // Foco al primer control del formulario: se abre listo para tipear.
  requestAnimationFrame(() => {
    dialog.value
      ?.querySelector<HTMLElement>('input, select, textarea, button')
      ?.focus();
  });
});
onUnmounted(() => {
  document.removeEventListener('keydown', onKey);
  document.body.style.overflow = '';
});
</script>

<template>
  <div class="overlay" @mousedown.self="emit('close')">
    <div
      class="modal"
      :class="size"
      ref="dialog"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
    >
      <div class="modal-head">
        <div class="modal-title">
          <h2>{{ title }}</h2>
          <p v-if="subtitle" class="muted text-sm">{{ subtitle }}</p>
        </div>
        <button class="icon-btn" style="margin-left:auto" aria-label="Cerrar" @click="emit('close')">
          <UiIcon name="x" />
        </button>
      </div>
      <div class="modal-body"><slot /></div>
      <div v-if="$slots.footer" class="modal-foot"><slot name="footer" /></div>
    </div>
  </div>
</template>
