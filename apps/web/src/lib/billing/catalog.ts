import type { Catalog, PlanFeature } from './types';

/**
 * Catálogo de planes. Es DATO, no lógica: el día que exista la API esto lo
 * devuelve `GET /v1/billing/catalog` con la misma forma.
 *
 * Precios en ARS con IVA incluido (el segmento es mayormente monotributista:
 * el IVA no es crédito fiscal, es precio). El precio de lista está anclado en
 * USD y se revisa por trimestre — la política está en docs/pricing.md.
 *
 * La escalera es de automatización: ordenás → el paciente se agenda solo →
 * el consultorio se maneja solo.
 */

const FEATURES: PlanFeature[] = [
  // --- Gestión del consultorio (plan Agenda) ---
  {
    key: 'agenda',
    label: 'Agenda multiprofesional',
    detail: 'Columnas por profesional, huecos libres a la vista y sobreturnos bloqueados por la base de datos.',
    group: 'core',
    status: 'available',
    highlightIn: 'agenda',
  },
  {
    key: 'patients',
    label: 'Fichas e historia clínica privada',
    detail: 'Cada profesional ve su historia. Las entradas no se reescriben ni se borran.',
    group: 'core',
    status: 'available',
    highlightIn: 'agenda',
  },
  {
    key: 'share',
    label: 'Compartir un paciente en lectura',
    detail: 'Con consentimiento registrado y auditoría de cada acceso.',
    group: 'core',
    status: 'available',
  },
  {
    key: 'import',
    label: 'Importar pacientes desde Excel o CSV',
    detail: 'Traés tu planilla actual sin volver a cargar todo a mano.',
    group: 'core',
    status: 'available',
  },
  {
    key: 'setup',
    label: 'Consultorios, horarios y roles',
    detail: 'Semana tipo por profesional y permisos por rol.',
    group: 'core',
    status: 'available',
  },
  {
    key: 'today',
    label: 'Panel del día',
    detail: 'Turnos, confirmados, huecos y ausencias de la jornada.',
    group: 'core',
    status: 'available',
  },
  {
    key: 'audit',
    label: 'Auditoría de accesos (Ley 25.326)',
    detail: 'Cada lectura de historia, cada acceso denegado y cada login quedan registrados.',
    group: 'core',
    status: 'available',
  },
  {
    key: 'attachments',
    label: 'Adjuntos: radiografías y estudios',
    detail: 'Archivos guardados en la ficha del paciente, con acceso auditado.',
    group: 'core',
    status: 'available',
    highlightIn: 'agenda',
  },
  {
    key: 'reports',
    label: 'Reportes: no-show, ocupación y pacientes nuevos',
    detail: 'La foto del mes por profesional, para decidir con números.',
    group: 'core',
    status: 'available',
  },

  // --- Portal del paciente (plan Portal) ---
  {
    key: 'booking-online',
    label: 'Reserva online 24/7',
    detail: 'El paciente elige entre tus huecos reales sin llamar por teléfono.',
    group: 'portal',
    status: 'soon',
    highlightIn: 'portal',
  },
  {
    key: 'patient-portal',
    label: 'El paciente consulta sus turnos e indicaciones',
    detail: 'Acceso propio, sin ver la historia clínica del profesional.',
    group: 'portal',
    status: 'soon',
    highlightIn: 'portal',
  },
  {
    key: 'self-manage',
    label: 'Cancela y reprograma solo, con tus reglas',
    detail: 'Definís hasta cuántas horas antes puede mover el turno.',
    group: 'portal',
    status: 'soon',
    highlightIn: 'portal',
  },

  // --- Automatización e IA (plan Automático) ---
  {
    key: 'wa-reminders',
    label: 'Recordatorios por WhatsApp con confirmación',
    detail: 'Sale solo 24 h antes; cuando el paciente confirma, el turno cambia de estado.',
    group: 'auto',
    status: 'soon',
    highlightIn: 'auto',
  },
  {
    key: 'wa-booking',
    label: 'Agendar por WhatsApp con asistente de IA',
    detail: 'El paciente escribe "necesito turno el jueves" y reserva sobre tus huecos reales.',
    group: 'auto',
    status: 'soon',
    highlightIn: 'auto',
  },
  {
    key: 'waitlist',
    label: 'Lista de espera inteligente',
    detail: 'Cuando se libera un turno lo ofrece por orden y lo asigna al primero que acepta.',
    group: 'auto',
    status: 'soon',
    highlightIn: 'auto',
  },
  {
    key: 'ai-notes',
    label: 'Borrador de la entrada clínica con IA',
    detail: 'Dictás la consulta y queda el borrador listo para revisar y guardar.',
    group: 'auto',
    status: 'soon',
  },
  {
    key: 'winback',
    label: 'Aviso de pacientes que dejaron de venir',
    detail: 'Te marca a quién conviene escribirle y te arma el mensaje.',
    group: 'auto',
    status: 'soon',
  },
  {
    key: 'priority-support',
    label: 'Soporte prioritario',
    detail: 'Respuesta el mismo día hábil, por WhatsApp.',
    group: 'auto',
    status: 'available',
  },
];

const CORE_KEYS = FEATURES.filter((f) => f.group === 'core').map((f) => f.key);
const PORTAL_KEYS = FEATURES.filter((f) => f.group === 'portal').map((f) => f.key);
const AUTO_KEYS = FEATURES.filter((f) => f.group === 'auto').map((f) => f.key);

export const FEATURE_GROUP_LABEL: Record<string, string> = {
  core: 'Gestión del consultorio',
  portal: 'Portal del paciente',
  auto: 'Automatización e IA',
};

export const CATALOG: Catalog = {
  version: 'ar-2026-08',
  currency: 'ARS',
  taxIncluded: true,
  trialDays: 30,

  plans: [
    {
      id: 'agenda',
      name: 'Agenda',
      tagline: 'Para el consultorio que hoy vive en Excel.',
      unitPriceMonthly: 22000,
      includedReceptionists: 1,
      extraReceptionistPrice: null,
      minSeats: 1,
      featureKeys: CORE_KEYS,
    },
    {
      id: 'portal',
      name: 'Portal',
      tagline: 'Para el que se pasa el día atendiendo el teléfono.',
      unitPriceMonthly: 35000,
      includedReceptionists: 2,
      extraReceptionistPrice: null,
      minSeats: 1,
      featureKeys: [...CORE_KEYS, ...PORTAL_KEYS],
      badge: 'Más elegido',
    },
    {
      id: 'auto',
      name: 'Automático',
      tagline: 'Para el que quiere dejar de perseguir pacientes.',
      unitPriceMonthly: 52000,
      includedReceptionists: 'unlimited',
      extraReceptionistPrice: null,
      minSeats: 1,
      featureKeys: [...CORE_KEYS, ...PORTAL_KEYS, ...AUTO_KEYS],
    },
  ],

  features: FEATURES,

  // Sobre el subtotal. La clínica chica paga lista; la grande siente que la premian.
  volumeTiers: [
    { minSeats: 1, discountPct: 0 },
    { minSeats: 3, discountPct: 8 },
    { minSeats: 6, discountPct: 12 },
    { minSeats: 10, discountPct: 18 },
  ],

  cycles: [
    { id: 'monthly', label: 'Mensual', months: 1, monthsCharged: 1 },
    {
      id: 'annual',
      label: 'Anual',
      months: 12,
      monthsCharged: 10,
      note: '2 meses sin cargo',
    },
  ],
};
