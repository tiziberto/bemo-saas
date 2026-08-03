<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import CommandPalette from './components/ui/CommandPalette.vue';
import UiConfirm from './components/ui/UiConfirm.vue';
import UiToasts from './components/ui/UiToasts.vue';
import { setUnauthorizedHandler } from './lib/api';
import { useAuth } from './stores/auth';
import { useUi } from './stores/ui';

const ui = useUi();
const auth = useAuth();
const router = useRouter();

function onKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    if (!auth.isAuthenticated) return;
    e.preventDefault();
    ui.paletteOpen = !ui.paletteOpen;
  }
}

onMounted(() => {
  ui.initTheme();
  document.addEventListener('keydown', onKey);
  // Un 401 = sesión vencida: limpiamos y volvemos al login sin dejar la app rota.
  setUnauthorizedHandler(() => {
    if (!auth.isAuthenticated) return;
    auth.logout();
    ui.error('Tu sesión venció', 'Ingresá de nuevo para seguir.');
    router.push('/login');
  });
  auth.hydrateProfile();
});
onUnmounted(() => document.removeEventListener('keydown', onKey));
</script>

<template>
  <router-view />
  <CommandPalette v-if="ui.paletteOpen" />
  <UiConfirm />
  <UiToasts />
</template>
