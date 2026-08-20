// Formateo de fechas/horas/nombres. Todo se muestra en la zona de la clínica.
export const TZ = 'America/Argentina/Buenos_Aires';
export const LOCALE = 'es-AR';

// 24 horas siempre: en una agenda clínica "3" tiene que ser inequívoco.
const timeFmt = new Intl.DateTimeFormat(LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: TZ,
});
// Para fechas sueltas (YYYY-MM-DD) no se convierte de zona: ya son "el día".
const dayLongFmt = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const dayShortFmt = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const dateFmt = new Intl.DateTimeFormat(LOCALE);
const instantDayLongFmt = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: TZ,
});

/** "09:30" a partir de un ISO con timezone. */
export function fmtTime(iso: string | Date): string {
  return timeFmt.format(new Date(iso));
}

/** "lunes, 3 de agosto" */
export function fmtDayLong(value: string | Date): string {
  return isDateOnly(value)
    ? dayLongFmt.format(toDate(value))
    : instantDayLongFmt.format(new Date(value));
}

/** "domingo, 2 de agosto" → "Domingo, 2 de agosto". */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "lun, 3 ago" */
export function fmtDayShort(value: string | Date): string {
  return dayShortFmt.format(toDate(value));
}

/** "03/08/2026" */
export function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return isDateOnly(value)
    ? dateFmt.format(toDate(value))
    : new Intl.DateTimeFormat(LOCALE, { timeZone: TZ }).format(new Date(value));
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})(T00:00:00(\.000)?Z)?$/;

function isDateOnly(value: string | Date): boolean {
  return typeof value === 'string' && DATE_ONLY.test(value);
}

/**
 * Las columnas `date` de Postgres llegan como medianoche UTC
 * (`2026-08-02T00:00:00.000Z`): si las convertimos a la zona de la clínica
 * retroceden un día. Por eso las tratamos como fecha suelta, no como instante.
 */
function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const dateOnly = DATE_ONLY.exec(value);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12);
  }
  return new Date(value);
}

/** Fecha de hoy en la zona de la clínica, como `YYYY-MM-DD`. */
export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Suma meses con clamp de fin de mes: 31/01 + 1 mes = 28/02 (o 29 en bisiesto). */
export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Días calendario entre dos fechas sueltas. Positivo si `to` está en el futuro. */
export function daysBetween(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split('-').map(Number);
  const [ty, tm, td] = toISO.split('-').map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86400000);
}

/** "Quedan 11 días" · "Queda 1 día" · "Vence hoy" · "Venció hace 3 días" */
export function pluralDays(n: number): string {
  if (n === 0) return 'Vence hoy';
  if (n === 1) return 'Queda 1 día';
  if (n > 1) return `Quedan ${n} días`;
  const ago = Math.abs(n);
  return ago === 1 ? 'Venció hace 1 día' : `Venció hace ${ago} días`;
}

/** "Hoy" / "Mañana" / "Ayer" / "lun, 3 ago" — para encabezados de agenda. */
export function relativeDay(isoDate: string): string {
  const today = todayISO();
  if (isoDate === today) return 'Hoy';
  if (isoDate === addDays(today, 1)) return 'Mañana';
  if (isoDate === addDays(today, -1)) return 'Ayer';
  return fmtDayShort(isoDate);
}

/** Minutos desde medianoche (en la zona de la clínica) de un instante ISO. */
export function minutesOfDay(iso: string | Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TZ,
  }).formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

/** 570 → "09:30" */
export function minutesToLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * `2026-08-03` + `09:30` → ISO con el offset real de la clínica
 * (`2026-08-03T09:30:00-03:00`). Evita mandar horas en UTC del navegador.
 */
export function isoFromClinicLocal(dateISO: string, hhmm: string): string {
  const probe = new Date(`${dateISO}T${hhmm}:00Z`);
  const offsetPart = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    timeZoneName: 'longOffset',
  })
    .formatToParts(probe)
    .find((p) => p.type === 'timeZoneName')?.value;
  const offset = (offsetPart ?? 'GMT-03:00').replace('GMT', '') || '-03:00';
  return `${dateISO}T${hhmm}:00${offset}`;
}

// Plata: pesos enteros, sin centavos. En una factura de $88.000 los centavos son ruido.
const moneyFmt = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** 88000 → "$ 88.000" */
export function fmtMoney(ars: number): string {
  return moneyFmt.format(ars);
}

/** −7040 → "−$ 7.040" (el signo va afuera, se lee mejor en una columna de importes). */
export function fmtMoneySigned(ars: number): string {
  return ars < 0 ? `−${moneyFmt.format(Math.abs(ars))}` : moneyFmt.format(ars);
}

/** 1536 → "1,5 kB" · 2400000 → "2,4 MB" */
export function fmtBytes(bytes: number | string): string {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1).replace('.', ',')} kB`;
  return `${(kb / 1024).toFixed(1).replace('.', ',')} MB`;
}

/** 240 → "4 h" · 90 → "1 h 30" · 45 → "45 min" */
export function fmtMinutes(mins: number): string {
  if (!mins) return '0';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m}` : `${h} h`;
}

export function durationMinutes(startIso: string, endIso: string): number {
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
}

const TITLES = /^(dr|dra|lic|od|ph|prof|sr|sra|srta)\.?$/i;

export function initials(name?: string | null): string {
  if (!name) return '—';
  // "Dra. Ana Gómez" → AG, no DG: el título no identifica a la persona.
  const all = name.trim().split(/\s+/).filter(Boolean);
  const parts = all.filter((p) => !TITLES.test(p));
  if (!parts.length) return all[0]?.slice(0, 2) || '—';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return parts[0][0] + parts[parts.length - 1][0];
}

export function fullName(p: { first_name?: string; last_name?: string }): string {
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Sin nombre';
}

/** Teléfono argentino → link de WhatsApp (asume +54 si viene sin código). */
export function waLink(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;
  const intl = digits.startsWith('54') ? digits : `54${digits.replace(/^0/, '')}`;
  return `https://wa.me/${intl}`;
}

export const APPOINTMENT_STATUS: Record<
  string,
  { label: string; chip: string; icon: string }
> = {
  scheduled: { label: 'Agendado', chip: '', icon: 'calendar' },
  confirmed: { label: 'Confirmado', chip: 'success', icon: 'check-circle' },
  waiting: { label: 'En espera', chip: 'warning', icon: 'clock' },
  in_progress: { label: 'Atendiendo', chip: 'success', icon: 'user' },
  completed: { label: 'Atendido', chip: 'gray', icon: 'check' },
  cancelled: { label: 'Cancelado', chip: 'gray', icon: 'ban' },
  no_show: { label: 'No vino', chip: 'danger', icon: 'alert-triangle' },
};

export const ENTRY_TYPE: Record<string, { label: string; icon: string }> = {
  note: { label: 'Nota', icon: 'file-text' },
  diagnosis: { label: 'Diagnóstico', icon: 'clipboard' },
  treatment: { label: 'Tratamiento', icon: 'activity' },
  prescription: { label: 'Receta', icon: 'file-text' },
};

export const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  professional: 'Profesional',
  receptionist: 'Recepción',
};

export const WEEKDAYS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];
export const WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/**
 * Duraciones ofrecidas al configurar un horario y al dar un turno. Antes cada
 * pantalla tenía su propia lista corta —una llegaba a 1 hora y la otra a 1:30—
 * y no había forma de cargar un estudio largo o una cirugía.
 */
export const DURACIONES: { valor: number; texto: string }[] = [
  { valor: 15, texto: '15 minutos' },
  { valor: 20, texto: '20 minutos' },
  { valor: 30, texto: '30 minutos' },
  { valor: 45, texto: '45 minutos' },
  { valor: 60, texto: '1 hora' },
  { valor: 90, texto: '1 hora 30' },
  { valor: 120, texto: '2 horas' },
  { valor: 150, texto: '2 horas 30' },
  { valor: 180, texto: '3 horas' },
  { valor: 240, texto: '4 horas' },
  { valor: 300, texto: '5 horas' },
  { valor: 360, texto: '6 horas' },
];

/**
 * "hace 12 min" a partir de una marca de tiempo. Se usa para la espera del
 * paciente, así que se queda en minutos y horas: nadie mide una sala de espera
 * en segundos ni en días.
 */
export function haceCuanto(desde: string | null | undefined, ahora = Date.now()): string {
  if (!desde) return '';
  const min = Math.max(0, Math.floor((ahora - new Date(desde).getTime()) / 60000));
  if (min < 1) return 'recién llegó';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `hace ${h} h ${resto} min` : `hace ${h} h`;
}
