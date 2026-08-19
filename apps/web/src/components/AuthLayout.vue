<script setup lang="ts">
import { RouterLink } from 'vue-router';
import BemoLogo from './ui/BemoLogo.vue';
import UiIcon from './ui/UiIcon.vue';

const POINTS = [
  { icon: 'calendar-check', text: 'Agenda del día con los huecos libres a la vista' },
  { icon: 'shield', text: 'Historia clínica privada de cada profesional, auditada' },
  { icon: 'ban', text: 'Sin choques accidentales: el sobreturno se carga a propósito' },
];
</script>

<template>
  <div class="auth-wrap">
    <aside class="auth-side">
      <RouterLink to="/" class="auth-brand" aria-label="Volver al inicio">
        <BemoLogo :tam="40" con-nombre />
      </RouterLink>

      <div>
        <p class="auth-claim">La agenda del consultorio, sin planillas.</p>
        <div class="auth-points">
          <div v-for="p in POINTS" :key="p.text" class="auth-point">
            <UiIcon :name="p.icon" size="17" />
            <span>{{ p.text }}</span>
          </div>
        </div>
      </div>

      <p class="muted text-xs">
        Datos de salud tratados según la Ley 25.326 de Protección de Datos Personales.
      </p>
    </aside>

    <main class="auth-main">
      <RouterLink to="/" class="auth-brand mobile-only mb-lg" aria-label="Volver al inicio">
        <BemoLogo :tam="40" con-nombre />
      </RouterLink>
      <div class="auth-card">
        <slot />
      </div>
    </main>
  </div>
</template>
