<script setup lang="ts">
import UiIcon from './UiIcon.vue';

const model = defineModel<string>({ default: '' });
withDefaults(defineProps<{ placeholder?: string }>(), {
  placeholder: 'Buscar…',
});
</script>

<template>
  <div class="input-icon" style="min-width:0">
    <UiIcon name="search" size="16" />
    <input
      v-model="model"
      type="search"
      :placeholder="placeholder"
      autocomplete="off"
      spellcheck="false"
    />
    <button
      v-if="model"
      class="icon-btn clear"
      style="width:24px;height:24px"
      aria-label="Limpiar búsqueda"
      @click="model = ''"
    >
      <UiIcon name="x" size="14" />
    </button>
  </div>
</template>
