// Contrato del dominio de suscripciones. Sin imports a propósito: estos tipos son
// el acuerdo entre el catálogo, el cálculo de precio, la fuente de datos y la UI.
// El día que exista la API, cambia la fuente (source.ts) y nada más.

export type PlanId = 'agenda' | 'portal' | 'auto';
export type BillingCycle = 'monthly' | 'annual';
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired';

/** Grupos del comparador, en orden de aparición. */
export type FeatureGroup = 'core' | 'portal' | 'auto';

/**
 * Una capacidad del producto. Los planes la referencian por `key`, nunca repiten
 * el texto: se edita acá y cambia en tarjeta, comparador y modal a la vez.
 */
export interface PlanFeature {
  key: string;
  label: string;
  detail?: string;
  group: FeatureGroup;
  /** `soon` = todavía no construida. La UI lo dice en vez de mostrar un ✓ falso. */
  status: 'available' | 'soon';
  /** Se destaca en la tarjeta del plan (máx. 3 por plan). */
  highlightIn?: PlanId;
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** ARS enteros, por profesional, por mes, ciclo mensual, sin descuentos. */
  unitPriceMonthly: number;
  includedReceptionists: number | 'unlimited';
  /** null = no se venden recepcionistas sueltas; el límite se sube cambiando de plan. */
  extraReceptionistPrice: number | null;
  minSeats: number;
  featureKeys: string[];
  badge?: string;
}

export interface VolumeTier {
  minSeats: number;
  discountPct: number;
}

export interface CycleOption {
  id: BillingCycle;
  label: string;
  /** Meses que cubre el cobro. */
  months: number;
  /** Meses que se cobran (anual = 10: dos bonificados). */
  monthsCharged: number;
  note?: string;
}

export interface Catalog {
  version: string;
  currency: 'ARS';
  /** true → la UI escribe "IVA incluido" una vez y no calcula impuestos. */
  taxIncluded: boolean;
  trialDays: number;
  plans: Plan[];
  features: PlanFeature[];
  volumeTiers: VolumeTier[];
  cycles: CycleOption[];
}

export interface SeatCount {
  professionals: number;
  receptionists: number;
  /** `fallback` = no pudimos leer el equipo completo; la recepción es estimada. */
  source: 'api' | 'fallback' | 'unknown';
}

export interface QuoteLine {
  key: string;
  label: string;
  detail?: string;
  /** ARS enteros. Negativo = descuento. */
  amount: number;
  kind: 'base' | 'addon' | 'discount' | 'total';
}

export interface Quote {
  planId: PlanId;
  cycle: BillingCycle;
  seats: SeatCount;
  billableSeats: number;
  unitPrice: number;
  lines: QuoteLine[];
  /** Total por mes, con descuentos aplicados. */
  monthlyTotal: number;
  /** Lo que se cobraría en el ciclo elegido (mensual = monthlyTotal). */
  chargeTotal: number;
  volumeDiscountPct: number;
  /** Cuánto se ahorra al año contra pagar mes a mes. 0 si el ciclo es mensual. */
  annualSavings: number;
  currency: 'ARS';
}

export interface Subscription {
  planId: PlanId;
  cycle: BillingCycle;
  status: SubscriptionStatus;
  /** Fechas sueltas `YYYY-MM-DD`, nunca instantes: no se convierten de zona. */
  startedAt: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  /** null = los asientos se cuentan en vivo. */
  seatsBilled: number | null;
  /** El backend real lo manda en false y los avisos de demostración desaparecen. */
  demo: boolean;
}

export interface ChangePlanInput {
  planId: PlanId;
  cycle: BillingCycle;
}

export interface BillingSource {
  readonly kind: 'mock' | 'api';
  getCatalog(): Promise<Catalog>;
  getSubscription(): Promise<Subscription>;
  changePlan(input: ChangePlanInput): Promise<Subscription>;
  cancel(): Promise<Subscription>;
}
