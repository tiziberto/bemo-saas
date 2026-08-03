import { defineStore } from 'pinia';
import { api } from '../lib/api';
import { clearBillingState } from '../lib/billing/source';
import { initials } from '../lib/format';

interface User {
  id: string;
  clinicId: string;
  email: string;
  roles: string[];
}
interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

const KEYS = {
  token: 'bemo_token',
  refresh: 'bemo_refresh',
  user: 'bemo_user',
  profile: 'bemo_profile',
};

interface Profile {
  fullName?: string;
  clinicName?: string;
}

export const useAuth = defineStore('auth', {
  state: () => ({
    user: JSON.parse(localStorage.getItem(KEYS.user) || 'null') as User | null,
    profile: JSON.parse(localStorage.getItem(KEYS.profile) || '{}') as Profile,
  }),
  getters: {
    isAuthenticated: (s) => !!localStorage.getItem(KEYS.token) && !!s.user,
    isAdmin: (s) => s.user?.roles.includes('admin') ?? false,
    isProfessional: (s) => s.user?.roles.includes('professional') ?? false,
    isReceptionist: (s) => s.user?.roles.includes('receptionist') ?? false,
    /** Nombre a mostrar: el real si lo conocemos, si no el usuario del email. */
    displayName: (s) => {
      if (s.profile.fullName) return s.profile.fullName;
      const local = s.user?.email?.split('@')[0];
      if (!local) return 'Usuario';
      return local.charAt(0).toUpperCase() + local.slice(1);
    },
    avatarText(): string {
      return initials(this.displayName);
    },
    clinicName: (s) => s.profile.clinicName || 'Mi consultorio',
  },
  actions: {
    persist(r: AuthResponse) {
      localStorage.setItem(KEYS.token, r.accessToken);
      // El refresh token NO se guarda: viaja en una cookie httpOnly que el
      // navegador manda solo. En localStorage quedaba expuesto a cualquier XSS.
      localStorage.removeItem(KEYS.refresh);
      localStorage.setItem(KEYS.user, JSON.stringify(r.user));
      this.user = r.user;
    },
    setProfile(patch: Profile) {
      this.profile = { ...this.profile, ...patch };
      localStorage.setItem(KEYS.profile, JSON.stringify(this.profile));
    },
    async login(email: string, password: string) {
      this.persist(
        await api<AuthResponse>('/auth/login', {
          method: 'POST',
          body: { email, password },
        }),
      );
      await this.hydrateProfile();
    },
    async registerClinic(payload: {
      clinicName: string;
      fullName: string;
      email: string;
      password: string;
    }) {
      this.persist(
        await api<AuthResponse>('/auth/register-clinic', {
          method: 'POST',
          body: payload,
        }),
      );
      this.setProfile({ fullName: payload.fullName, clinicName: payload.clinicName });
    },
    async acceptInvite(payload: { token: string; fullName: string; password: string }) {
      this.persist(
        await api<AuthResponse>('/auth/accept-invite', {
          method: 'POST',
          body: payload,
        }),
      );
      this.setProfile({ fullName: payload.fullName });
    },
    /**
     * `/auth/me` sólo devuelve el claim del token (sin nombre). Mientras tanto
     * derivamos el nombre del listado de profesionales, que es público al tenant.
     */
    async hydrateProfile() {
      if (this.profile.fullName || !this.user) return;
      try {
        const profs = await api<{ id: string; full_name: string }[]>(
          '/users/professionals',
        );
        const me = profs.find((p) => p.id === this.user!.id);
        if (me) this.setProfile({ fullName: me.full_name });
      } catch {
        /* no es crítico */
      }
    },
    logout() {
      // Primero el estado local: cerrar sesión no puede depender de la red, y
      // si se limpia después de un await, el guard del router todavía ve el
      // token viejo y rebota la navegación al login.
      localStorage.removeItem(KEYS.token);
      localStorage.removeItem(KEYS.refresh);
      localStorage.removeItem(KEYS.user);
      localStorage.removeItem(KEYS.profile);
      // Si no, el estado de suscripción de una clínica se filtra a la siguiente
      // que entre desde el mismo navegador.
      clearBillingState();
      this.user = null;
      this.profile = {};
      // Y recién ahí se revoca el refresh token del servidor (viaja en la
      // cookie httpOnly). Sin esto seguía siendo válido 7 días.
      void api('/auth/logout', { method: 'POST', body: {} }).catch(() => undefined);
    },
  },
});
