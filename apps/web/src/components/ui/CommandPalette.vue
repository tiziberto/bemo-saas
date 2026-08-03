<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../../lib/api';
import { fullName, todayISO, addDays } from '../../lib/format';
import { useAuth } from '../../stores/auth';
import { useUi } from '../../stores/ui';
import UiIcon from './UiIcon.vue';

const router = useRouter();
const auth = useAuth();
const ui = useUi();

interface Cmd {
  id: string;
  group: string;
  label: string;
  icon: string;
  hint?: string;
  run: () => void;
}

const q = ref('');
const cursor = ref(0);
const input = ref<HTMLInputElement | null>(null);
const patients = ref<{ id: string; first_name: string; last_name: string; dni: string }[]>([]);

const base = computed<Cmd[]>(() => {
  const items: Cmd[] = [
    { id: 'today', group: 'Ir a', label: 'Hoy', icon: 'home', hint: 'Panel del día', run: () => router.push('/hoy') },
    { id: 'agenda', group: 'Ir a', label: 'Agenda', icon: 'calendar', run: () => router.push('/agenda') },
  ];
  if (auth.isProfessional) {
    items.push({ id: 'pat', group: 'Ir a', label: 'Pacientes', icon: 'users', run: () => router.push('/pacientes') });
  }
  if (auth.isAdmin || auth.isProfessional) {
    items.push({ id: 'rep', group: 'Ir a', label: 'Reportes', icon: 'activity', hint: 'No-show y ocupación', run: () => router.push('/reportes') });
  }
  if (auth.isAdmin) {
    items.push(
      { id: 'team', group: 'Ir a', label: 'Equipo', icon: 'user-plus', run: () => router.push('/configuracion/equipo') },
      { id: 'rooms', group: 'Ir a', label: 'Consultorios', icon: 'door', run: () => router.push('/configuracion/consultorios') },
      { id: 'avail', group: 'Ir a', label: 'Horarios', icon: 'clock', run: () => router.push('/configuracion/horarios') },
      { id: 'sub', group: 'Ir a', label: 'Suscripción', icon: 'credit-card', hint: 'Plan y precios', run: () => router.push('/configuracion/suscripcion') },
    );
  }
  if (auth.isAdmin || auth.isReceptionist) {
    items.push({
      id: 'book',
      group: 'Acciones',
      label: 'Agendar turno',
      icon: 'plus',
      run: () => router.push({ path: '/agenda', query: { nuevo: '1' } }),
    });
  }
  if (auth.isProfessional) {
    items.push({
      id: 'newpat',
      group: 'Acciones',
      label: 'Nuevo paciente',
      icon: 'user-plus',
      run: () => router.push({ path: '/pacientes', query: { nuevo: '1' } }),
    });
  }
  items.push(
    {
      id: 'tomorrow',
      group: 'Acciones',
      label: 'Agenda de mañana',
      icon: 'arrow-right',
      run: () => router.push({ path: '/agenda', query: { fecha: addDays(todayISO(), 1) } }),
    },
    {
      id: 'theme',
      group: 'Preferencias',
      label: ui.isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro',
      icon: ui.isDark ? 'sun' : 'moon',
      run: () => ui.toggleTheme(),
    },
    { id: 'print', group: 'Preferencias', label: 'Imprimir esta vista', icon: 'printer', run: () => window.print() },
  );
  return items;
});

const patientCmds = computed<Cmd[]>(() =>
  patients.value.map((p) => ({
    id: `p-${p.id}`,
    group: 'Pacientes',
    label: fullName(p),
    icon: 'user',
    hint: `DNI ${p.dni}`,
    run: () => router.push({ path: '/pacientes', query: { id: p.id } }),
  })),
);

const results = computed(() => {
  const term = q.value.trim().toLowerCase();
  const all = [...base.value, ...(term ? patientCmds.value : [])];
  if (!term) return all.slice(0, 9);
  return all
    .filter((c) => (c.label + ' ' + (c.hint ?? '')).toLowerCase().includes(term))
    .slice(0, 12);
});

const grouped = computed(() => {
  const out: { group: string; items: Cmd[] }[] = [];
  for (const item of results.value) {
    const last = out[out.length - 1];
    if (last && last.group === item.group) last.items.push(item);
    else out.push({ group: item.group, items: [item] });
  }
  return out;
});

const flat = computed(() => results.value);

watch(q, () => (cursor.value = 0));

function run(cmd: Cmd) {
  ui.paletteOpen = false;
  cmd.run();
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    cursor.value = (cursor.value + 1) % Math.max(flat.value.length, 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    cursor.value = (cursor.value - 1 + flat.value.length) % Math.max(flat.value.length, 1);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const cmd = flat.value[cursor.value];
    if (cmd) run(cmd);
  } else if (e.key === 'Escape') {
    ui.paletteOpen = false;
  }
}

onMounted(async () => {
  requestAnimationFrame(() => input.value?.focus());
  if (auth.isProfessional) {
    try {
      patients.value = await api('/patients');
    } catch {
      /* la paleta sigue sirviendo para navegar */
    }
  }
});
</script>

<template>
  <div class="overlay" style="align-items:flex-start" @mousedown.self="ui.paletteOpen = false">
    <div class="palette" role="dialog" aria-modal="true" aria-label="Buscador de comandos">
      <div class="palette-input">
        <UiIcon name="search" size="18" style="color:var(--muted-2)" />
        <input
          ref="input"
          v-model="q"
          placeholder="Buscar pacientes, ir a una sección, ejecutar una acción…"
          @keydown="onKey"
        />
        <kbd>Esc</kbd>
      </div>

      <div class="palette-list">
        <template v-for="g in grouped" :key="g.group">
          <div class="palette-group">{{ g.group }}</div>
          <button
            v-for="item in g.items"
            :key="item.id"
            class="palette-item"
            :aria-selected="flat[cursor]?.id === item.id"
            @mousemove="cursor = flat.findIndex((c) => c.id === item.id)"
            @click="run(item)"
          >
            <UiIcon :name="item.icon" size="16" />
            <span>{{ item.label }}</span>
            <span v-if="item.hint" class="hint-r">{{ item.hint }}</span>
          </button>
        </template>
        <div v-if="!results.length" class="empty" style="padding:28px 16px">
          <div class="empty-title">Sin resultados</div>
          <p class="empty-desc">Probá con el nombre o el DNI del paciente.</p>
        </div>
      </div>

      <div class="palette-foot">
        <span><kbd>↑</kbd> <kbd>↓</kbd> navegar</span>
        <span><kbd>↵</kbd> abrir</span>
        <span class="spacer"></span>
        <span><kbd>⌘</kbd><kbd>K</kbd> abrir/cerrar</span>
      </div>
    </div>
  </div>
</template>
