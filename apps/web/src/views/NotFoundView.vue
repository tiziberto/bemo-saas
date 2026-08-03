<script setup lang="ts">
import AppShell from '../components/AppShell.vue';
import UiEmpty from '../components/ui/UiEmpty.vue';
</script>

<template>
  <AppShell>
    <div class="card pad" style="margin-top:48px">
      <UiEmpty
        icon="search"
        title="Esta página no existe"
        desc="El link puede estar viejo o mal escrito. Volvé al panel del día para seguir trabajando."
      >
        <router-link class="btn sm" to="/hoy">Ir al panel</router-link>
      </UiEmpty>
    </div>
  </AppShell>
</template>
