import { addDays, addMonths, todayISO } from '../format';
import { CATALOG } from './catalog';
import type {
  BillingSource,
  Catalog,
  ChangePlanInput,
  Subscription,
} from './types';

/**
 * Fuente de datos de suscripción.
 *
 * Hoy hay una sola implementación (`mock`) que guarda el estado en localStorage.
 * El día que exista `GET /v1/billing/subscription`, se escribe `apiBillingSource`
 * y se cambia UNA línea en `getBillingSource()`: ni la vista ni el store se tocan.
 *
 * El mock persiste sólo plan, ciclo, estado y fechas. El precio NUNCA se guarda:
 * si el admin suma un profesional, el total se recalcula solo.
 */

export const BILLING_KEY_PREFIX = 'bemo_billing:';
const SCHEMA = 1;

interface Stored {
  v: number;
  sub: Subscription;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function seed(): Subscription {
  const start = todayISO();
  const trialEnd = addDays(start, CATALOG.trialDays);
  return {
    planId: 'agenda',
    cycle: 'monthly',
    status: 'trialing',
    startedAt: start,
    trialEndsAt: trialEnd,
    currentPeriodEnd: trialEnd,
    cancelAtPeriodEnd: false,
    seatsBilled: null,
    demo: true,
  };
}

function isValid(sub: unknown): sub is Subscription {
  const s = sub as Subscription;
  return (
    !!s &&
    typeof s.planId === 'string' &&
    CATALOG.plans.some((p) => p.id === s.planId) &&
    CATALOG.cycles.some((c) => c.id === s.cycle) &&
    typeof s.currentPeriodEnd === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(s.currentPeriodEnd)
  );
}

/**
 * Avanza los períodos vencidos de una suscripción activa. Sin esto, abrir la demo
 * dentro de dos meses muestra "venció hace 61 días" y parece un bug del producto.
 */
function rollForward(sub: Subscription, today: string): Subscription {
  if (sub.status !== 'active' || sub.cancelAtPeriodEnd) return sub;
  const months = CATALOG.cycles.find((c) => c.id === sub.cycle)?.months ?? 1;
  let end = sub.currentPeriodEnd;
  for (let i = 0; i < 60 && end < today; i++) {
    end = addMonths(end, months);
  }
  return end === sub.currentPeriodEnd ? sub : { ...sub, currentPeriodEnd: end };
}

export function mockBillingSource(clinicId: string): BillingSource {
  // Clave por clínica: dos cuentas en el mismo navegador no comparten la demo.
  const key = `${BILLING_KEY_PREFIX}${clinicId}`;

  function read(): Subscription {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as Stored;
        if (parsed?.v === SCHEMA && isValid(parsed.sub)) {
          return rollForward(parsed.sub, todayISO());
        }
      }
    } catch {
      /* dato viejo o corrupto: se vuelve a sembrar */
    }
    const fresh = seed();
    write(fresh);
    return fresh;
  }

  function write(sub: Subscription): Subscription {
    try {
      localStorage.setItem(key, JSON.stringify({ v: SCHEMA, sub } satisfies Stored));
    } catch {
      /* modo privado / storage lleno: la pantalla sigue funcionando en memoria */
    }
    return sub;
  }

  return {
    kind: 'mock',
    getCatalog: async () => CATALOG,
    getSubscription: async () => read(),

    async changePlan({ planId, cycle }: ChangePlanInput) {
      await sleep(450); // para que el spinner del botón exista de verdad
      const current = read();
      // Cambiar de plan durante la prueba NO la termina: sería castigar al que explora.
      const next: Subscription = {
        ...current,
        planId,
        cycle,
        cancelAtPeriodEnd: false,
        currentPeriodEnd:
          current.status === 'trialing'
            ? current.currentPeriodEnd
            : addMonths(
                todayISO(),
                CATALOG.cycles.find((c) => c.id === cycle)?.months ?? 1,
              ),
      };
      return write(next);
    },

    async cancel() {
      await sleep(300);
      return write({ ...read(), cancelAtPeriodEnd: true });
    },
  };
}

/** Stub del día que exista la API. Se implementa cuando haya endpoints. */
export function apiBillingSource(): BillingSource {
  const notReady = () => {
    throw new Error('La API de suscripciones todavía no existe');
  };
  return {
    kind: 'api',
    getCatalog: notReady as unknown as () => Promise<Catalog>,
    getSubscription: notReady as unknown as () => Promise<Subscription>,
    changePlan: notReady as unknown as () => Promise<Subscription>,
    cancel: notReady as unknown as () => Promise<Subscription>,
  };
}

/** Único punto de switcheo entre demo y API real. */
export function getBillingSource(clinicId: string): BillingSource {
  return mockBillingSource(clinicId);
}

/** Limpia el estado de demostración de todas las clínicas (lo llama el logout). */
export function clearBillingState() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(BILLING_KEY_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* nada que limpiar */
  }
}
