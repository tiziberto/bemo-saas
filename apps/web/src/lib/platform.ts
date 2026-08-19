/**
 * Cómo se escribe el atajo según la plataforma.
 *
 * El atajo SIEMPRE funcionó en Windows y Linux (el handler acepta `metaKey || ctrlKey`),
 * pero la etiqueta estaba escrita a mano como "⌘K" en cuatro lugares distintos. Un usuario
 * de Windows veía un símbolo de Mac y ni probaba el atajo. Se resuelve una sola vez acá.
 */

/** `navigator.platform` está deprecado; se usa el hint moderno y se cae al viejo. */
function esMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  const hint = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform;
  const plataforma = hint || navigator.platform || navigator.userAgent || '';
  return /mac|iphone|ipad|ipod/i.test(plataforma);
}

export const IS_MAC = esMac();

/** Tecla modificadora sola: "⌘" o "Ctrl". */
export const MOD_KEY = IS_MAC ? '⌘' : 'Ctrl';

/** El atajo completo listo para mostrar: "⌘K" o "Ctrl K". */
export const MOD_K = IS_MAC ? '⌘K' : 'Ctrl K';
