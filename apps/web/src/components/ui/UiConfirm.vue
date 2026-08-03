<script setup lang="ts">
import { useUi } from '../../stores/ui';
import UiModal from './UiModal.vue';

const ui = useUi();
</script>

<template>
  <UiModal
    v-if="ui.confirmState"
    :title="ui.confirmState.title"
    @close="ui.resolveConfirm(false)"
  >
    <p class="muted" style="font-size:14px">{{ ui.confirmState.desc }}</p>
    <template #footer>
      <button class="btn secondary" @click="ui.resolveConfirm(false)">
        {{ ui.confirmState.cancelLabel || 'Cancelar' }}
      </button>
      <button
        class="btn"
        :class="{ 'solid-danger': ui.confirmState.danger }"
        @click="ui.resolveConfirm(true)"
      >
        {{ ui.confirmState.confirmLabel || 'Confirmar' }}
      </button>
    </template>
  </UiModal>
</template>
