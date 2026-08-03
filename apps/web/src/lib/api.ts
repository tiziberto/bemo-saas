// Cliente HTTP mínimo contra /v1 con Bearer token y manejo del contrato de error
// (RFC 9457: { title, detail, code }).
const BASE = '/v1';
const TOKEN_KEY = 'bemo_token';

export interface ApiError extends Error {
  status: number;
  code?: string;
}

/** Se dispara cuando la sesión ya no se puede recuperar. */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export function qs(params: Record<string, string | number | undefined | null>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (!entries.length) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
}

/** Rutas donde un 401 significa "credenciales mal", no "token vencido". */
const NO_RETRY = ['/auth/login', '/auth/refresh', '/auth/register-clinic', '/auth/accept-invite'];

/**
 * Renovación del access token. Es single-flight a propósito: si cinco requests
 * fallan a la vez con 401, se renueva UNA sola vez y las cinco esperan a esa.
 * El refresh token viaja en la cookie httpOnly, no lo tocamos desde acá.
 */
let refreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(BASE + '/auth/refresh', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: '{}',
        });
        if (!res.ok) return false;
        const data = await res.json();
        if (!data?.accessToken) return false;
        localStorage.setItem(TOKEN_KEY, data.accessToken);
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const send = async (): Promise<Response> => {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    return fetch(BASE + path, {
      method: opts.method ?? 'GET',
      headers,
      signal: opts.signal,
      // La cookie httpOnly del refresh token viaja sola; nunca la tocamos desde JS.
      credentials: 'include',
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  };

  let res: Response;
  try {
    res = await send();
    // Token vencido: se renueva y se reintenta una sola vez, sin que el usuario
    // se entere. Antes esto cortaba la sesión a los 15 minutos, en medio de la
    // consulta.
    if (res.status === 401 && !NO_RETRY.includes(path)) {
      if (await refreshSession()) res = await send();
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    const err = new Error('No se pudo conectar con el servidor') as ApiError;
    err.status = 0;
    err.code = 'NETWORK';
    throw err;
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    // Sigue sin autorizar después de renovar: la sesión murió de verdad.
    if (res.status === 401 && !NO_RETRY.includes(path) && onUnauthorized) {
      onUnauthorized();
    }
    const err = new Error(
      data?.detail || data?.message || data?.title || `Error ${res.status}`,
    ) as ApiError;
    err.status = res.status;
    err.code = data?.code;
    throw err;
  }
  return data as T;
}

/**
 * Sube un archivo (multipart). No pasa por `api()` porque ahí el body siempre
 * es JSON: acá el navegador arma el boundary solo, así que no se toca el
 * content-type a mano.
 */
export async function apiUpload<T = unknown>(path: string, form: FormData): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    credentials: 'include',
    body: form,
  });
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const err = new Error(
      data?.detail || data?.title || `Error ${res.status}`,
    ) as ApiError;
    err.status = res.status;
    err.code = data?.code;
    throw err;
  }
  return data as T;
}

/**
 * Descarga un archivo protegido. El contenido nunca está en una URL pública:
 * viaja con el token y se abre desde un blob local.
 */
export async function apiBlob(path: string): Promise<Blob> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(BASE + path, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  if (!res.ok) {
    const err = new Error('No se pudo abrir el archivo') as ApiError;
    err.status = res.status;
    throw err;
  }
  return res.blob();
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Mensaje presentable de cualquier error atrapado. */
export function errMessage(e: unknown, fallback = 'Ocurrió un error'): string {
  return e instanceof Error && e.message ? e.message : fallback;
}
