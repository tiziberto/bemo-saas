import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  // Públicas
  { path: '/login', component: () => import('./views/LoginView.vue'), meta: { public: true, title: 'Ingresar' } },
  { path: '/register', component: () => import('./views/RegisterView.vue'), meta: { public: true, title: 'Registrar clínica' } },
  { path: '/invitacion', component: () => import('./views/AcceptInviteView.vue'), meta: { public: true, title: 'Sumarte al equipo' } },

  // Trabajo del día
  // La raíz es la landing pública. Quien ya tiene sesión no la ve: el guard de abajo
  // manda a /hoy cualquier ruta `public` con token, así que entra directo al panel.
  { path: '/', component: () => import('./views/LandingView.vue'), meta: { public: true, title: 'Agenda para consultorios' } },
  { path: '/hoy', component: () => import('./views/DashboardView.vue'), meta: { title: 'Hoy' } },
  { path: '/agenda', component: () => import('./views/AgendaView.vue'), meta: { title: 'Agenda' } },
  {
    path: '/reportes',
    component: () => import('./views/ReportsView.vue'),
    meta: { title: 'Reportes', roles: ['admin', 'professional'] },
  },
  {
    path: '/pacientes',
    component: () => import('./views/PatientsView.vue'),
    meta: { title: 'Pacientes', roles: ['professional'] },
  },

  // Configuración — una sección por función, no un cajón de sastre
  { path: '/configuracion', redirect: '/configuracion/equipo' },
  {
    path: '/configuracion/equipo',
    component: () => import('./views/settings/TeamView.vue'),
    meta: { title: 'Equipo', roles: ['admin'] },
  },
  {
    path: '/configuracion/consultorios',
    component: () => import('./views/settings/RoomsView.vue'),
    meta: { title: 'Consultorios', roles: ['admin'] },
  },
  {
    path: '/configuracion/horarios',
    component: () => import('./views/settings/AvailabilityView.vue'),
    meta: { title: 'Horarios de atención', roles: ['admin', 'professional'] },
  },
  {
    path: '/configuracion/clinica',
    component: () => import('./views/settings/ClinicView.vue'),
    meta: { title: 'Clínica', roles: ['admin'] },
  },
  {
    path: '/configuracion/suscripcion',
    component: () => import('./views/settings/SubscriptionView.vue'),
    meta: { title: 'Suscripción', roles: ['admin'] },
  },

  { path: '/:pathMatch(.*)*', component: () => import('./views/NotFoundView.vue'), meta: { title: 'No encontrado' } },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, _from, guardado) {
    // Los anclas de la landing (#agenda, #precios…) cambian la URL, y eso cuenta
    // como navegación: con un `top: 0` fijo el router scrolleaba al principio y
    // parecía que el link no hacía nada. `top` compensa la barra pegajosa, que si
    // no tapa el título de la sección.
    if (to.hash) return { el: to.hash, top: 72, behavior: 'smooth' };
    return guardado ?? { top: 0 };
  },
});

function currentRoles(): string[] {
  try {
    return JSON.parse(localStorage.getItem('bemo_user') || 'null')?.roles ?? [];
  } catch {
    return [];
  }
}

router.beforeEach((to) => {
  const hasToken = !!localStorage.getItem('bemo_token');
  if (!to.meta.public && !hasToken) return { path: '/login', query: { next: to.fullPath } };
  if (to.meta.public && hasToken) return '/hoy';

  const required = to.meta.roles as string[] | undefined;
  if (required?.length) {
    const roles = currentRoles();
    if (!required.some((r) => roles.includes(r))) return '/hoy';
  }
  return true;
});

router.afterEach((to) => {
  const title = to.meta.title as string | undefined;
  document.title = title ? `${title} · bemo` : 'bemo';
});
