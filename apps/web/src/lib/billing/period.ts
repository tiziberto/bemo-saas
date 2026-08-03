import { addMonths, daysBetween, fmtDate, todayISO } from '../format';
import { cycleById } from './quote';
import type { Catalog, Subscription } from './types';

/**
 * Traduce una suscripción a "cuánto tiempo queda" para la UI. Toda la lógica de
 * prueba / activa / por vencer / vencida vive acá, en un solo lugar y sin Vue.
 *
 * Las fechas son sueltas (`YYYY-MM-DD`) y se comparan como tales: mezclarlas con
 * instantes ISO da un off-by-one de un día justo en el número que más se mira.
 */

export type PeriodKind = 'trial' | 'renewal' | 'canceling' | 'grace' | 'ended';
export type Tone = 'default' | 'success' | 'warning' | 'danger';

export interface PeriodView {
  kind: PeriodKind;
  daysLeft: number;
  endsOn: string;
  /** Número grande + su unidad: "11" / "días de prueba". */
  count: string;
  unit: string;
  headline: string;
  sub: string;
  tone: Tone;
  chip: { text: string; cls: '' | 'gray' | 'success' | 'warning' | 'danger' };
  /** 0–100 del período consumido; null si no se puede calcular. */
  progressPct: number | null;
}

function pct(elapsed: number, total: number): number | null {
  if (!Number.isFinite(total) || total <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

/** El día 0 no dice "Hoy días de prueba": lleva su propia leyenda. */
function unitFor(
  days: number,
  noun: string,
  zeroUnit: string,
): { count: string; unit: string } {
  if (days === 0) return { count: 'Hoy', unit: zeroUnit };
  if (days < 0) return { count: '—', unit: noun };
  return { count: String(days), unit: days === 1 ? noun.replace('días', 'día') : noun };
}

export function periodView(
  sub: Subscription,
  catalog: Catalog,
  today = todayISO(),
): PeriodView {
  const cycleMonths = cycleById(catalog, sub.cycle).months;

  // Prueba viva. Un `trialing` sin fecha es un dato roto: lo tratamos como activa.
  if (sub.status === 'trialing' && sub.trialEndsAt) {
    const daysLeft = daysBetween(today, sub.trialEndsAt);
    if (daysLeft >= 0) {
      const tone: Tone = daysLeft <= 2 ? 'danger' : daysLeft <= 7 ? 'warning' : 'default';
      const total = daysBetween(sub.startedAt, sub.trialEndsAt);
      return {
        kind: 'trial',
        daysLeft,
        endsOn: sub.trialEndsAt,
        ...unitFor(daysLeft, 'días de prueba', 'termina la prueba'),
        headline:
          daysLeft === 0
            ? 'Tu prueba termina hoy'
            : daysLeft === 1
              ? 'Queda 1 día de prueba'
              : `Quedan ${daysLeft} días de prueba`,
        sub: `Gratis hasta el ${fmtDate(sub.trialEndsAt)}. No cargaste ninguna tarjeta.`,
        tone,
        chip: { text: 'Prueba gratis', cls: '' },
        progressPct: pct(daysBetween(sub.startedAt, today), total),
      };
    }
    const ago = Math.abs(daysLeft);
    return {
      kind: 'ended',
      daysLeft,
      endsOn: sub.trialEndsAt,
      count: '—',
      unit: 'prueba terminada',
      headline: ago === 1 ? 'La prueba venció ayer' : `La prueba venció hace ${ago} días`,
      sub: `Terminó el ${fmtDate(sub.trialEndsAt)}. Elegí un plan para seguir usando bemo.`,
      tone: 'danger',
      chip: { text: 'Prueba vencida', cls: 'danger' },
      progressPct: 100,
    };
  }

  if (sub.status === 'past_due') {
    return {
      kind: 'grace',
      daysLeft: daysBetween(today, sub.currentPeriodEnd),
      endsOn: sub.currentPeriodEnd,
      count: '!',
      unit: 'pago pendiente',
      headline: 'Hay un pago pendiente',
      sub: 'Regularizalo para que la clínica siga trabajando normalmente.',
      tone: 'danger',
      chip: { text: 'Pago pendiente', cls: 'danger' },
      progressPct: null,
    };
  }

  if (sub.status === 'canceled' || sub.status === 'expired') {
    return {
      kind: 'ended',
      daysLeft: daysBetween(today, sub.currentPeriodEnd),
      endsOn: sub.currentPeriodEnd,
      count: '—',
      unit: 'sin plan activo',
      headline: 'La suscripción terminó',
      sub: `Terminó el ${fmtDate(sub.currentPeriodEnd)}. Podés reactivarla cuando quieras.`,
      tone: 'danger',
      chip: { text: 'Sin plan', cls: 'gray' },
      progressPct: 100,
    };
  }

  // Activa (con o sin cancelación programada).
  const daysLeft = daysBetween(today, sub.currentPeriodEnd);
  const periodStart = addMonths(sub.currentPeriodEnd, -cycleMonths);
  const total = daysBetween(periodStart, sub.currentPeriodEnd);
  const progress = pct(daysBetween(periodStart, today), total);

  if (sub.cancelAtPeriodEnd) {
    return {
      kind: 'canceling',
      daysLeft,
      endsOn: sub.currentPeriodEnd,
      ...unitFor(daysLeft, 'días de acceso', 'último día'),
      headline:
        daysLeft === 0
          ? 'Hoy es tu último día'
          : daysLeft === 1
            ? 'Te queda 1 día de acceso'
            : `Te quedan ${daysLeft} días de acceso`,
      sub: `Cancelaste la renovación: el plan termina el ${fmtDate(sub.currentPeriodEnd)}.`,
      tone: 'warning',
      chip: { text: 'Se cancela', cls: 'warning' },
      progressPct: progress,
    };
  }

  return {
    kind: 'renewal',
    daysLeft,
    endsOn: sub.currentPeriodEnd,
    ...unitFor(daysLeft, 'días para el cobro', 'se cobra hoy'),
    headline:
      daysLeft === 0
        ? 'Se cobra hoy'
        : daysLeft === 1
          ? 'Se cobra mañana'
          : `Próximo cobro en ${daysLeft} días`,
    sub: `Se renueva el ${fmtDate(sub.currentPeriodEnd)}.`,
    tone: daysLeft <= 3 ? 'warning' : 'success',
    chip: { text: 'Activa', cls: 'success' },
    progressPct: progress,
  };
}
