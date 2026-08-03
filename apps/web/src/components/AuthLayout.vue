<script setup lang="ts">
import UiIcon from './ui/UiIcon.vue';

const POINTS = [
  { icon: 'calendar-check', text: 'Agenda del día con los huecos libres a la vista' },
  { icon: 'shield', text: 'Historia clínica privada de cada profesional, auditada' },
  { icon: 'ban', text: 'Imposible sobreturnear: lo bloquea la base de datos' },
];
</script>

<template>
  <div class="auth-wrap">
    <aside class="auth-side">
      <div class="row tight">
        <span class="logo-lg">b</span>
        <span style="font-family:'General Sans',sans-serif;font-weight:600;font-size:19px">bemo</span>
      </div>

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
      <div class="auth-card">
        <slot />
      </div>
    </main>
  </div>
</template>
