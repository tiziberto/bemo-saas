<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ROLE_LABEL } from '../lib/format';
import { useAuth } from '../stores/auth';
import { useSubscription } from '../stores/subscription';
import { useUi } from '../stores/ui';
import { MOD_K } from '../lib/platform';
import BemoLogo from './ui/BemoLogo.vue';
import UiAvatar from './ui/UiAvatar.vue';
import UiIcon from './ui/UiIcon.vue';
import UiMenu from './ui/UiMenu.vue';

withDefaults(defineProps<{ width?: 'default' | 'narrow' | 'wide' }>(), {
  width: 'default',
});

const auth = useAuth();
const ui = useUi();
const router = useRouter();
const route = useRoute();

interface NavItem {
  to: string;
  label: string;
  icon: string;
  show: boolean;
}

// Navegación agrupada por función: el trabajo del día arriba, la configuración abajo.
const dayToDay = computed<NavItem[]>(() => [
  { to: '/hoy', label: 'Hoy', icon: 'home', show: true },
  { to: '/agenda', label: 'Agenda', icon: 'calendar', show: true },
  { to: '/pacientes', label: 'Pacientes', icon: 'users', show: auth.isProfessional },
  {
    to: '/reportes',
    label: 'Reportes',
    icon: 'activity',
    show: auth.isAdmin || auth.isProfessional,
  },
]);

const admin = computed<NavItem[]>(() =>
  [
    { to: '/configuracion/equipo', label: 'Equipo', icon: 'user-plus', show: auth.isAdmin },
    { to: '/configuracion/consultorios', label: 'Consultorios', icon: 'door', show: auth.isAdmin },
    {
      to: '/configuracion/horarios',
      label: 'Horarios',
      icon: 'clock',
      show: auth.isAdmin || auth.isProfessional,
    },
    { to: '/configuracion/preinformes', label: 'Preinformes', icon: 'file-text', show: auth.isProfessional },
    { to: '/configuracion/clinica', label: 'Clínica', icon: 'building', show: auth.isAdmin },
    {
      to: '/configuracion/suscripcion',
      label: 'Suscripción',
      icon: 'credit-card',
      show: auth.isAdmin,
    },
  ].filter((i) => i.show),
);

// Días de prueba restantes en el menú. Sale del estado local, sin pegarle a la red.
const subscription = useSubscription();
const trialBadge = computed(() => {
  const days = subscription.trialDaysLeft;
  return days === null ? null : days === 0 ? 'Hoy' : `${days} d`;
});

const roles = computed(() =>
  (auth.user?.roles ?? []).map((r) => ROLE_LABEL[r] ?? r).join(' · '),
);

function logout() {
  auth.logout();
  router.push('/login');
  ui.info('Sesión cerrada');
}

// En mobile el sidebar es un drawer: navegar lo cierra.
watch(() => route.fullPath, () => (ui.sidebarOpen = false));

onMounted(() => {
  if (auth.isAdmin) subscription.hydrateLocal();
});
</script>

<template>
  <div class="shell">
    <div
      v-if="ui.sidebarOpen"
      class="overlay mobile-only"
      style="z-index:80;background:rgba(20,32,31,.35)"
      @click="ui.sidebarOpen = false"
    ></div>

    <aside class="sidebar" :class="{ collapsed: ui.sidebarCollapsed, open: ui.sidebarOpen }">
      <div class="brand">
        <BemoLogo :tam="26" />
        <span class="brand-text">bemo <em class="brand-sub">MED</em></span>
      </div>

      <nav class="nav">
        <div class="nav-group">
          <div class="nav-group-title">Consultorio</div>
          <template v-for="item in dayToDay" :key="item.to">
            <router-link v-if="item.show" :to="item.to" :title="item.label">
              <UiIcon :name="item.icon" size="17" />
              <span class="nav-label">{{ item.label }}</span>
            </router-link>
          </template>
        </div>

        <div v-if="admin.length" class="nav-group">
          <div class="nav-group-title">Configuración</div>
          <template v-for="item in admin" :key="item.to">
            <router-link v-if="item.show" :to="item.to" :title="item.label">
              <UiIcon :name="item.icon" size="17" />
              <span class="nav-label">{{ item.label }}</span>
              <span
                v-if="item.to === '/configuracion/suscripcion' && trialBadge"
                class="badge nav-label"
                title="Días de prueba restantes"
              >
                {{ trialBadge }}
              </span>
            </router-link>
          </template>
        </div>
      </nav>

      <div class="sidebar-foot">
        <button class="menu-item" @click="ui.paletteOpen = true">
          <UiIcon name="search" size="16" />
          <span class="sidebar-foot-text">Buscar</span>
          <span class="right sidebar-foot-text"><kbd>{{ MOD_K }}</kbd></span>
        </button>
        <button class="menu-item" @click="ui.toggleTheme()">
          <UiIcon :name="ui.isDark ? 'sun' : 'moon'" size="16" />
          <span class="sidebar-foot-text">{{ ui.isDark ? 'Modo claro' : 'Modo oscuro' }}</span>
        </button>
        <button class="menu-item desktop-only" @click="ui.toggleSidebar()">
          <UiIcon name="sidebar" size="16" />
          <span class="sidebar-foot-text">{{ ui.sidebarCollapsed ? 'Expandir' : 'Contraer' }}</span>
        </button>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <button
          class="icon-btn mobile-only"
          aria-label="Abrir menú"
          @click="ui.sidebarOpen = !ui.sidebarOpen"
        >
          <UiIcon name="menu" />
        </button>

        <!-- El de contraer estaba sólo al fondo del sidebar: nadie lo encontraba. -->
        <button
          class="icon-btn desktop-only"
          :aria-label="ui.sidebarCollapsed ? 'Expandir el menú' : 'Contraer el menú'"
          :aria-expanded="!ui.sidebarCollapsed"
          :title="ui.sidebarCollapsed ? 'Expandir el menú' : 'Contraer el menú'"
          @click="ui.toggleSidebar()"
        >
          <UiIcon name="sidebar" size="17" />
        </button>

        <div class="clinic">
          <UiIcon name="building" size="16" style="color:var(--muted-2)" />
          <span class="truncate">{{ auth.clinicName }}</span>
        </div>

        <div class="spacer"></div>

        <button class="btn secondary sm desktop-only" @click="ui.paletteOpen = true">
          <UiIcon name="search" size="15" />
          Buscar
          <kbd style="margin-left:4px">{{ MOD_K }}</kbd>
        </button>

        <UiMenu>
          <template #trigger>
            <button
              class="icon-btn"
              style="display:inline-flex;align-items:center;width:auto;padding:3px 6px 3px 3px;gap:6px"
              aria-label="Tu cuenta"
            >
              <UiAvatar :name="auth.displayName" size="sm" />
              <UiIcon name="chevron-down" size="14" />
            </button>
          </template>

          <div class="menu-head">
            <div class="strong text-sm">{{ auth.displayName }}</div>
            <div class="muted text-xs truncate">{{ auth.user?.email }}</div>
            <div class="mt-sm"><span class="chip gray">{{ roles }}</span></div>
          </div>
          <div class="menu-sep"></div>
          <button class="menu-item" @click="ui.setTheme('light')">
            <UiIcon name="sun" size="16" /> Modo claro
            <span v-if="ui.theme === 'light'" class="right">✓</span>
          </button>
          <button class="menu-item" @click="ui.setTheme('dark')">
            <UiIcon name="moon" size="16" /> Modo oscuro
            <span v-if="ui.theme === 'dark'" class="right">✓</span>
          </button>
          <button class="menu-item" @click="ui.setTheme('system')">
            <UiIcon name="activity" size="16" /> Según el sistema
            <span v-if="ui.theme === 'system'" class="right">✓</span>
          </button>
          <div class="menu-sep"></div>
          <button class="menu-item danger" @click="logout">
            <UiIcon name="logout" size="16" /> Cerrar sesión
          </button>
        </UiMenu>
      </header>

      <div class="content" :class="width === 'default' ? '' : width">
        <slot />
      </div>
    </div>
  </div>
</template>
