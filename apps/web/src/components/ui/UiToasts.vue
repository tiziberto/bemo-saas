<script setup lang="ts">
import { useUi } from '../../stores/ui';
import UiIcon from './UiIcon.vue';

const ui = useUi();
const ICON: Record<string, string> = {
  success: 'check-circle',
  error: 'alert-circle',
  warning: 'alert-triangle',
  info: 'info',
};
</script>

<template>
  <div class="toasts" role="status" aria-live="polite">
    <div v-for="t in ui.toasts" :key="t.id" class="toast" :class="t.kind">
      <UiIcon :name="ICON[t.kind]" />
      <div class="toast-body">
        <div class="toast-title">{{ t.title }}</div>
        <div v-if="t.desc" class="toast-desc">{{ t.desc }}</div>
      </div>
      <button class="icon-btn" style="width:22px;height:22px;margin-left:auto" aria-label="Cerrar aviso" @click="ui.dismiss(t.id)">
        <UiIcon name="x" size="14" />
      </button>
    </div>
  </div>
</template>
