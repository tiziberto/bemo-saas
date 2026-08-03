<script setup lang="ts">
// Placeholder de carga: filas de líneas grises. Evita el salto de layout.
withDefaults(defineProps<{ rows?: number; avatar?: boolean }>(), {
  rows: 4,
  avatar: false,
});
</script>

<template>
  <div class="stack-sm" style="padding:4px 0">
    <div
      v-for="i in rows"
      :key="i"
      class="row tight nowrap"
      style="padding:8px 0"
    >
      <div v-if="avatar" class="sk circle" style="width:30px;height:30px;flex-shrink:0"></div>
      <div style="flex:1;min-width:0">
        <div class="sk" :style="{ width: 45 + ((i * 17) % 40) + '%' }"></div>
        <div class="sk" style="width:28%;height:10px;margin-top:6px;opacity:.7"></div>
      </div>
    </div>
  </div>
</template>
