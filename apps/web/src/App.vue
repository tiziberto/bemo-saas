<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

type Health = { status: string; db: string; ts: string };

const loading = ref(true);
const health = ref<Health | null>(null);
const error = ref<string | null>(null);

const statusClass = computed(() => {
  if (loading.value) return 'is-loading';
  if (error.value || health.value?.db !== 'up') return 'is-down';
  return 'is-ok';
});

async function check() {
  loading.value = true;
  error.value = null;
  try {
    const res = await fetch('/v1/health');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    health.value = (await res.json()) as Health;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error desconocido';
    health.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(check);
</script>

<template>
  <main class="shell">
    <div class="card">
      <div class="brand">
        <span class="logo">b</span>
        <span class="name">bemo</span>
      </div>
      <p class="tagline">CRM para consultorios · Etapa 1 — Fundaciones</p>

      <div class="status" :class="statusClass">
        <template v-if="loading">Verificando API…</template>
        <template v-else-if="error">API no disponible — {{ error }}</template>
        <template v-else-if="health">
          API <strong>{{ health.status }}</strong> · base de datos
          <strong>{{ health.db }}</strong>
        </template>
      </div>

      <button class="btn" @click="check" :disabled="loading">Reintentar</button>
    </div>
  </main>
</template>

<style>
:root {
  --bg: #fbfbfa;
  --surface: #ffffff;
  --line: #e7e5e1;
  --ink: #14201f;
  --muted: #5b6766;
  --teal: #0e7c86;
  --teal-tint: #e1f1f2;
}
* { box-sizing: border-box; }
body { margin: 0; }
.shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: var(--bg);
  color: var(--ink);
  font-family: 'Geist', system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
  padding: 24px;
}
.card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 32px;
  width: 100%;
  max-width: 420px;
}
.brand { display: flex; align-items: center; gap: 10px; }
.logo {
  width: 32px; height: 32px; border-radius: 8px;
  background: var(--teal); color: #fff;
  display: grid; place-items: center;
  font-family: 'General Sans', sans-serif; font-weight: 600; font-size: 18px;
}
.name { font-family: 'General Sans', sans-serif; font-weight: 600; font-size: 22px; letter-spacing: -0.01em; }
.tagline { color: var(--muted); font-size: 14px; margin: 8px 0 24px; }
.status {
  border-radius: 8px; padding: 12px 14px; font-size: 14px;
  background: var(--teal-tint); color: var(--teal);
}
.status.is-down { background: #fbeaea; color: #b23a32; }
.status.is-loading { background: #f1efea; color: var(--muted); }
.status strong { font-weight: 600; }
.btn {
  margin-top: 20px; width: 100%;
  background: var(--teal); color: #fff; border: 0;
  border-radius: 8px; padding: 10px 14px; font-size: 14px; font-weight: 500;
  font-family: inherit; cursor: pointer;
  transition: background 150ms ease-out;
}
.btn:hover { background: #0b656d; }
.btn:disabled { opacity: 0.6; cursor: default; }
</style>
