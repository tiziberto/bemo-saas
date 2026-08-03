// Set de íconos (línea, 24x24, stroke). Se dibujan con <UiIcon name="…" />.
// Son constantes del código, no contenido remoto: seguro renderizarlas con v-html.
export const ICONS: Record<string, string> = {
  // Navegación
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
  calendar:
    '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 3v3.5M16 3v3.5"/>',
  users:
    '<path d="M16 20v-1.6a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/><circle cx="9" cy="7.5" r="3.2"/><path d="M22 20v-1.6a4 4 0 0 0-3-3.87"/><path d="M16.5 4.3a4 4 0 0 1 0 7.4"/>',
  user: '<path d="M19 20v-1.8a5 5 0 0 0-5-5h-4a5 5 0 0 0-5 5V20"/><circle cx="12" cy="7" r="3.6"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-1 1.46V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1.05-1.46 1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.6 1.6 0 0 0 4.6 15a1.6 1.6 0 0 0-1.46-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.33-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.6 1.6 0 0 0 9 4.6a1.6 1.6 0 0 0 1-1.46V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.46 1.6 1.6 0 0 0 1.77-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.6 1.6 0 0 0 19.4 9a1.6 1.6 0 0 0 1.46 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
  door: '<path d="M4 21h16"/><path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><circle cx="14.5" cy="12.5" r="1"/>',
  clipboard:
    '<rect x="7" y="4" width="10" height="3.5" rx="1"/><path d="M9 5.5H6a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6.5a1 1 0 0 0-1-1h-3"/><path d="M9 12h6M9 16h4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/>',
  activity: '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
  building:
    '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M8.5 7.5h1.5M14 7.5h1.5M8.5 11.5h1.5M14 11.5h1.5M10 21v-4.5h4V21"/>',

  // Acciones
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  trash: '<path d="M3.5 6.5h17M9 6.5V4.8A1.3 1.3 0 0 1 10.3 3.5h3.4A1.3 1.3 0 0 1 15 4.8v1.7"/><path d="M18.5 6.5 17.8 20a1.3 1.3 0 0 1-1.3 1.2h-9A1.3 1.3 0 0 1 6.2 20L5.5 6.5"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7.5 18.5l-4 1 1-4Z"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  share:
    '<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="m8.4 10.7 7.2-4.2M8.4 13.3l7.2 4.2"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7.5 8.5 12 4l4.5 4.5M12 4v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7.5 11.5 12 16l4.5-4.5M12 16V4"/>',
  printer:
    '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
  refresh:
    '<path d="M20.5 12a8.5 8.5 0 1 1-2.5-6"/><path d="M20.5 4.5V10H15"/>',
  filter: '<path d="M3.5 5.5h17l-6.5 8V20l-4 1.5v-8Z"/>',
  logout: '<path d="M15 17l5-5-5-5"/><path d="M20 12H9"/><path d="M12 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6"/>',
  menu: '<path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17"/>',
  sidebar: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9.5 4v16"/>',
  command:
    '<path d="M8.5 3A2.5 2.5 0 1 1 6 5.5V18.5A2.5 2.5 0 1 1 8.5 21H15.5A2.5 2.5 0 1 1 18 18.5V5.5A2.5 2.5 0 1 1 15.5 3Z"/>',

  // Flechas
  'chevron-left': '<path d="m15 5-7 7 7 7"/>',
  'chevron-right': '<path d="m9 5 7 7-7 7"/>',
  'chevron-down': '<path d="m6 9.5 6 6 6-6"/>',
  'chevron-up': '<path d="m6 14.5 6-6 6 6"/>',
  'arrow-right': '<path d="M4 12h15"/><path d="m13 6 6 6-6 6"/>',
  'arrow-left': '<path d="M20 12H5"/><path d="m11 6-6 6 6 6"/>',
  'more-horizontal':
    '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',

  // Estado / feedback
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5L16 9.5"/>',
  'alert-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V13M12 16.2v.1"/>',
  'alert-triangle':
    '<path d="M10.3 4.3 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z"/><path d="M12 9.5V14M12 17.2v.1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16.5V11M12 7.8v.1"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  shield: '<path d="M12 3 5 6v6c0 4.2 2.9 7.7 7 9 4.1-1.3 7-4.8 7-9V6Z"/><path d="m9 12 2 2 4-4"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8.5 10.5V7.8a3.5 3.5 0 1 1 7 0v2.7"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off':
    '<path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3.3 4"/><path d="M6.3 7.8A17 17 0 0 0 2.5 12S6 18 12 18a9.5 9.5 0 0 0 4-.85"/><path d="m3 3 18 18"/><path d="M9.9 10a3 3 0 0 0 4.1 4.2"/>',

  // Contacto / datos
  phone:
    '<path d="M6.2 3.5h3l1.5 3.8-2 1.4a12 12 0 0 0 5.6 5.6l1.4-2 3.8 1.5v3a1.8 1.8 0 0 1-2 1.8A16.5 16.5 0 0 1 4.4 5.5a1.8 1.8 0 0 1 1.8-2Z"/>',
  whatsapp:
    '<path d="M3.5 20.5 4.9 16A8.2 8.2 0 1 1 8 19.1Z"/><path d="M9 9.2c0 3 2.4 5.4 5.4 5.4l.9-1.5-1.9-.8-.8.8a4.6 4.6 0 0 1-2-2l.8-.8-.8-1.9Z"/>',
  mail: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/>',
  'file-text':
    '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
  'id-card':
    '<rect x="2.5" y="5" width="19" height="14" rx="2"/><circle cx="8.5" cy="11" r="2"/><path d="M5.5 16c.6-1.5 1.8-2.2 3-2.2s2.4.7 3 2.2M14.5 10h4M14.5 13.5h4"/>',

  // Tema
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',

  // Agenda
  'calendar-check':
    '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 3v3.5M16 3v3.5"/><path d="m9 14.5 2 2 4-4"/>',
  'calendar-x':
    '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 3v3.5M16 3v3.5"/><path d="m10 13.5 4 4M14 13.5l-4 4"/>',
  'user-plus':
    '<path d="M15 20v-1.8a5 5 0 0 0-5-5H7a5 5 0 0 0-5 5V20"/><circle cx="8.5" cy="7" r="3.6"/><path d="M19 8v6M22 11h-6"/>',
  columns:
    '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M9 4.5v15M15 4.5v15"/>',
  list: '<path d="M8 6.5h13M8 12h13M8 17.5h13M3.5 6.5h.1M3.5 12h.1M3.5 17.5h.1"/>',
  sparkle: '<path d="M12 3.5 13.8 9l5.5 1.8-5.5 1.8L12 18l-1.8-5.4L4.7 10.8 10.2 9Z"/>',

  // Suscripción
  'credit-card':
    '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 9.5h19M6 15h3"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><path d="M3.2 9.5h17.6M3.2 14.5h17.6"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18Z"/>',
  bell: '<path d="M18 8.8a6 6 0 1 0-12 0c0 5-2 6.2-2 6.2h16s-2-1.2-2-6.2Z"/><path d="M13.7 19a2 2 0 0 1-3.4 0"/>',
  bot: '<rect x="4" y="8" width="16" height="11" rx="2.5"/><path d="M12 4.5V8M8.5 13v1.5M15.5 13v1.5"/><circle cx="12" cy="3.5" r="1.2"/>',
};

export type IconName = keyof typeof ICONS;
