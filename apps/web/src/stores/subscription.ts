import { defineStore } from 'pinia';
import { api } from '../lib/api';
import { CATALOG } from '../lib/billing/catalog';
import { periodView, type PeriodView } from '../lib/billing/period';
import { planById, quote } from '../lib/billing/quote';
import { getBillingSource } from '../lib/billing/source';
import type {
  BillingCycle,
  Catalog,
  Plan,
  PlanId,
  Quote,
  SeatCount,
  Subscription,
} from '../lib/billing/types';
import type { Professional, TeamUser } from '../lib/types';
import { useAuth } from './auth';

/**
 * Estado de la suscripción. La vista nunca toca localStorage ni conoce precios:
 * pide `quote` y listo. El día que haya API, cambia la fuente en source.ts.
 */
export const useSubscription = defineStore('subscription', {
  state: () => ({
    catalog: CATALOG as Catalog,
    sub: null as Subscription | null,
    seats: { professionals: 0, receptionists: 0, source: 'unknown' } as SeatCount,
    loading: false,
    saving: false,
    loaded: false,
    error: '',
  }),

  getters: {
    plan(state): Plan | null {
      return state.sub ? planById(state.catalog, state.sub.planId) : null;
    },
    period(state): PeriodView | null {
      return state.sub ? periodView(state.sub, state.catalog) : null;
    },
    /** Presupuesto del plan y ciclo actuales. */
    quote(state): Quote | null {
      if (!state.sub) return null;
      return quote(state.catalog, state.sub.planId, state.sub.cycle, state.seats);
    },
    /** Presupuesto de cualquier combinación; lo usan las tarjetas y el modal. */
    quoteFor(state) {
      return (planId: PlanId, cycle: BillingCycle): Quote =>
        quote(state.catalog, planId, cycle, state.seats);
    },
    isDemo(state): boolean {
      return state.sub?.demo ?? true;
    },
    /** Días de prueba restantes para el badge del menú; null si no está en prueba. */
    trialDaysLeft(): number | null {
      const p = this.period as PeriodView | null;
      return p?.kind === 'trial' ? p.daysLeft : null;
    },
  },

  actions: {
    /** Sincrónico y sin red: sirve para el badge del menú en cada navegación. */
    hydrateLocal() {
      const auth = useAuth();
      if (!auth.user) return;
      if (!this.sub) {
        getBillingSource(auth.user.clinicId)
          .getSubscription()
          .then((s) => (this.sub = s))
          .catch(() => undefined);
      }
    },

    async load(force = false) {
      if (this.loaded && !force) return;
      const auth = useAuth();
      if (!auth.user) return;
      this.loading = true;
      this.error = '';
      try {
        this.sub = await getBillingSource(auth.user.clinicId).getSubscription();
        await this.countSeats();
        this.loaded = true;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No se pudo cargar la suscripción';
      } finally {
        this.loading = false;
      }
    },

    /**
     * Cuenta los asientos reales de la clínica. `/users` es de admin y trae los
     * roles; si falla (rol desactualizado en el token) caemos a la lista pública
     * de profesionales antes que mostrar un error rojo por no contar la recepción.
     */
    async countSeats() {
      try {
        const users = await api<TeamUser[]>('/users');
        const active = users.filter((u) => u.is_active !== false);
        this.seats = {
          professionals: active.filter((u) => u.roles?.includes('professional')).length,
          receptionists: active.filter((u) => u.roles?.includes('receptionist')).length,
          source: 'api',
        };
      } catch {
        const profs = await api<Professional[]>('/users/professionals').catch(() => []);
        this.seats = {
          professionals: profs.length,
          receptionists: 1,
          source: 'fallback',
        };
      }
    },

    async changePlan(planId: PlanId, cycle: BillingCycle) {
      const auth = useAuth();
      if (!auth.user) return;
      this.saving = true;
      try {
        this.sub = await getBillingSource(auth.user.clinicId).changePlan({ planId, cycle });
      } finally {
        this.saving = false;
      }
    },

    async cancelRenewal() {
      const auth = useAuth();
      if (!auth.user) return;
      this.saving = true;
      try {
        this.sub = await getBillingSource(auth.user.clinicId).cancel();
      } finally {
        this.saving = false;
      }
    },

    reset() {
      this.sub = null;
      this.loaded = false;
      this.seats = { professionals: 0, receptionists: 0, source: 'unknown' };
    },
  },
});
