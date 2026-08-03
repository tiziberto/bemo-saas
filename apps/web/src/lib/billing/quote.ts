import { fmtMoney } from '../format';
import type {
  BillingCycle,
  Catalog,
  CycleOption,
  Plan,
  PlanId,
  Quote,
  QuoteLine,
  SeatCount,
} from './types';

/**
 * Cálculo de precio. Función pura: sin Vue, sin fechas, sin storage.
 *
 * ORDEN DE OPERACIONES — el backend tiene que replicarlo palabra por palabra,
 * o el total que ve el cliente en pantalla no va a coincidir con el que se cobra:
 *
 *   1. asientos facturables = max(profesionales, plan.minSeats)
 *   2. base                 = precio unitario × asientos facturables
 *   3. recepción extra      = (recepcionistas − incluidas) × precio, si el plan las vende
 *   4. subtotal             = base + recepción extra
 *   5. descuento            = −round(subtotal × pct / 100)   ← ÚNICO redondeo
 *   6. total mensual        = subtotal + descuento
 *   7. total del ciclo      = total mensual × meses cobrados (mensual 1, anual 10)
 *
 * Todo en pesos enteros. Un solo Math.round: si se redondea el unitario y el
 * subtotal y el total, el desglose deja de cerrar con el total y se nota.
 */

export function planById(catalog: Catalog, id: PlanId): Plan {
  const plan = catalog.plans.find((p) => p.id === id);
  if (!plan) throw new Error(`Plan desconocido: ${id}`);
  return plan;
}

export function cycleById(catalog: Catalog, id: BillingCycle): CycleOption {
  const cycle = catalog.cycles.find((c) => c.id === id);
  if (!cycle) throw new Error(`Ciclo desconocido: ${id}`);
  return cycle;
}

/** El tier más alto que alcanza esa cantidad de asientos. */
export function volumeDiscountPct(catalog: Catalog, seats: number): number {
  return catalog.volumeTiers
    .filter((t) => seats >= t.minSeats)
    .reduce((pct, t) => Math.max(pct, t.discountPct), 0);
}

/** Etiqueta del tramo de volumen vigente, para explicarlo en la UI. */
export function volumeTierLabel(catalog: Catalog, seats: number): string | null {
  const pct = volumeDiscountPct(catalog, seats);
  if (!pct) return null;
  const tiers = [...catalog.volumeTiers].sort((a, b) => a.minSeats - b.minSeats);
  const current = tiers.filter((t) => seats >= t.minSeats).pop()!;
  const next = tiers.find((t) => t.minSeats > current.minSeats);
  return next
    ? `${current.minSeats} a ${next.minSeats - 1} profesionales`
    : `${current.minSeats} profesionales o más`;
}

export function quote(
  catalog: Catalog,
  planId: PlanId,
  cycle: BillingCycle,
  seats: SeatCount,
): Quote {
  const plan = planById(catalog, planId);
  const cycleOpt = cycleById(catalog, cycle);

  const billableSeats = Math.max(seats.professionals, plan.minSeats);
  const lines: QuoteLine[] = [];

  const base = plan.unitPriceMonthly * billableSeats;
  lines.push({
    key: 'base',
    label: `Plan ${plan.name} · ${billableSeats} profesional${billableSeats === 1 ? '' : 'es'}`,
    detail: `${fmtMoney(plan.unitPriceMonthly)} por profesional`,
    amount: base,
    kind: 'base',
  });

  let addon = 0;
  if (plan.includedReceptionists !== 'unlimited' && plan.extraReceptionistPrice) {
    const extra = Math.max(0, seats.receptionists - plan.includedReceptionists);
    if (extra > 0) {
      addon = extra * plan.extraReceptionistPrice;
      lines.push({
        key: 'reception',
        label: `${extra} recepción adicional${extra === 1 ? '' : 'es'}`,
        amount: addon,
        kind: 'addon',
      });
    }
  }

  const subtotal = base + addon;
  const pct = volumeDiscountPct(catalog, billableSeats);
  const discount = pct ? -Math.round((subtotal * pct) / 100) : 0;
  if (discount) {
    lines.push({
      key: 'volume',
      label: `Descuento por volumen · ${pct}%`,
      detail: volumeTierLabel(catalog, billableSeats) ?? undefined,
      amount: discount,
      kind: 'discount',
    });
  }

  const monthlyTotal = subtotal + discount;
  const chargeTotal = monthlyTotal * cycleOpt.monthsCharged;
  const annualSavings =
    cycleOpt.months > 1 ? monthlyTotal * cycleOpt.months - chargeTotal : 0;

  return {
    planId,
    cycle,
    seats,
    billableSeats,
    unitPrice: plan.unitPriceMonthly,
    lines,
    monthlyTotal,
    chargeTotal,
    volumeDiscountPct: pct,
    annualSavings,
    currency: catalog.currency,
  };
}

/** Diferencia mensual entre dos presupuestos; lo usa el modal de cambio de plan. */
export function quoteDelta(
  from: Quote,
  to: Quote,
): { amount: number; direction: 'up' | 'down' | 'same' } {
  const amount = to.monthlyTotal - from.monthlyTotal;
  return {
    amount,
    direction: amount > 0 ? 'up' : amount < 0 ? 'down' : 'same',
  };
}

/** "1 recepcionista" · "2 recepcionistas" · "Recepcionistas ilimitadas" */
export function receptionLabel(plan: Plan): string {
  if (plan.includedReceptionists === 'unlimited') return 'Recepcionistas ilimitadas';
  return plan.includedReceptionists === 1
    ? '1 recepcionista'
    : `${plan.includedReceptionists} recepcionistas`;
}

/** Versión corta para una celda de tabla: "1" · "2" · "Ilimitadas". */
export function receptionShort(plan: Plan): string {
  return plan.includedReceptionists === 'unlimited'
    ? 'Ilimitadas'
    : String(plan.includedReceptionists);
}
