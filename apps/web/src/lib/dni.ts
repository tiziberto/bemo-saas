/**
 * Lectura del PDF417 del DNI argentino.
 *
 * El lector de mostrador se comporta como un teclado: apoyás el documento y
 * "tipea" la cadena entera de un saque, terminando en Enter. Acá sólo hay que
 * reconocerla y partirla — no hay cámara ni decodificador de por medio.
 *
 * Circulan dos formatos y los dos se usan:
 *
 *   Con número de trámite, separado por comillas (los DNI nuevos):
 *     00604432588"BERTORELLO"MASSIMO TIZIANO"M"45155972"A"13-11-2003"09-08-2019"239
 *
 *   Clásico, separado por arrobas:
 *     @DIAZ@ERIC OCTAVIO@M@12345678@A@01/02/1995@01/01/2030@01/01/2015
 *
 * Campos, en orden: [nº trámite] · apellido · nombres · sexo · DNI · ejemplar ·
 * nacimiento · emisión · [nº interno]. El de arrobas arranca con un separador
 * vacío y no trae número de trámite, así que el corrimiento no es el mismo.
 */

export interface DatosDni {
  dni: string;
  apellido: string;
  nombres: string;
  /** Como lo trae el documento. 'X' existe en el DNI argentino. */
  sexo: 'F' | 'M' | 'X' | null;
  /** AAAA-MM-DD, o null si el documento traía una fecha que no se pudo leer. */
  fechaNacimiento: string | null;
  /** Número de trámite, sólo en el formato con comillas. */
  tramite: string | null;
}

/** Un DNI argentino es de 7 u 8 dígitos. */
const DNI_RE = /^\d{7,8}$/;

/**
 * ¿Esto que llegó parece un escaneo y no algo tipeado a mano?
 *
 * Se usa para decidir si interpretar el contenido de un input: alguien que
 * escribe su DNI no produce nunca una cadena con estos separadores.
 */
export function pareceEscaneo(texto: string): boolean {
  const t = texto.trim();
  return (t.includes('@') && t.split('@').length >= 8)
    || (t.includes('"') && t.split('"').length >= 8);
}

/** Normaliza 13-11-2003 y 01/02/1995 a 2003-11-13. */
function aIso(fecha: string | undefined): string | null {
  if (!fecha) return null;
  const m = fecha.trim().match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (!m) return null;
  const [, dd, mm, aaaa] = m;
  const dia = Number(dd);
  const mes = Number(mm);
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
  return `${aaaa}-${mm}-${dd}`;
}

function sexoValido(v: string | undefined): 'F' | 'M' | 'X' | null {
  const s = (v ?? '').trim().toUpperCase();
  return s === 'F' || s === 'M' || s === 'X' ? s : null;
}

/** Title Case respetando los apellidos compuestos y las partículas. */
function capitalizar(texto: string): string {
  const particulas = new Set(['de', 'del', 'la', 'las', 'los', 'da', 'do', 'di', 'van', 'von', 'y']);
  return texto
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((palabra, i) =>
      i > 0 && particulas.has(palabra)
        ? palabra
        : palabra.charAt(0).toUpperCase() + palabra.slice(1),
    )
    .join(' ');
}

/**
 * Parsea la cadena del lector. Devuelve null si no es un escaneo reconocible,
 * para que quien llama pueda tratar el texto como lo que el usuario tipeó.
 */
export function parsearDni(texto: string): DatosDni | null {
  const t = (texto ?? '').trim();
  if (!t) return null;

  let campos: string[];
  let tramite: string | null = null;

  if (t.includes('"')) {
    campos = t.split('"');
    // 0 = trámite, 1 = apellido, 2 = nombres, 3 = sexo, 4 = DNI…
    tramite = campos[0]?.trim() || null;
    campos = campos.slice(1);
  } else if (t.includes('@')) {
    // Arranca con '@', así que el primer pedazo viene vacío.
    campos = t.split('@');
    if (campos[0] === '') campos = campos.slice(1);
  } else {
    return null;
  }

  const [apellido, nombres, sexo, dni, , nacimiento] = campos;
  const dniLimpio = (dni ?? '').trim().replace(/\D/g, '');
  // Sin un DNI válido no hay nada que hacer con el resto: es el único campo que
  // el sistema realmente necesita y el que identifica al paciente.
  if (!DNI_RE.test(dniLimpio)) return null;
  if (!apellido?.trim() || !nombres?.trim()) return null;

  return {
    dni: dniLimpio,
    apellido: capitalizar(apellido),
    nombres: capitalizar(nombres),
    sexo: sexoValido(sexo),
    fechaNacimiento: aIso(nacimiento),
    tramite,
  };
}
