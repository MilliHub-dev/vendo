import { loadTokens, saveTokens } from './tokens';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://api.vendoltd.com').replace(/\/+$/, '');
const TIMEOUT_MS = 25_000;

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 0) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** Called when the session can't be renewed, so the app can go back to the sign-in screens. */
let onAuthLost: () => void = () => {};
export const setAuthLostHandler = (handler: () => void) => (onAuthLost = handler);

/** Random ID so the server can recognise a repeated request and not act on it twice. */
export const idempotencyKey = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => ((c === 'x' ? Math.random() * 16 : (Math.random() * 4) | 8) | 0).toString(16));

type Options = { body?: unknown; query?: Record<string, string | number | undefined>; auth?: boolean; idempotent?: boolean | string };

async function send(method: string, path: string, { body, query, idempotent }: Options, token: string | null): Promise<Response> {
  const params = Object.entries(query ?? {}).filter(([, v]) => v !== undefined && v !== '');
  const url = `${API_URL}${path}${params.length ? `?${params.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}` : ''}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(idempotent ? { 'Idempotency-Key': typeof idempotent === 'string' ? idempotent : idempotencyKey() } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('NETWORK', 'Can’t reach Vendo. Check your internet connection and try again.');
  } finally {
    clearTimeout(timer);
  }
}

let refreshing: Promise<string | null> | null = null;
/** Swaps the refresh token for a new pair. Shared, so several failed requests only refresh once. */
function refresh(): Promise<string | null> {
  refreshing ??= (async () => {
    const tokens = await loadTokens();
    if (!tokens) return null;
    const res = await send('POST', '/v1/auth/refresh', { body: { refresh_token: tokens.refresh } }, null).catch(() => null);
    if (!res) return tokens.access; // offline: keep the session and let the caller report the network error
    if (!res.ok) {
      await saveTokens(null);
      onAuthLost();
      return null;
    }
    const json = (await res.json()) as { access_token: string; refresh_token: string };
    await saveTokens({ access: json.access_token, refresh: json.refresh_token });
    return json.access_token;
  })().finally(() => (refreshing = null));
  return refreshing;
}

export async function request<T>(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, options: Options = {}): Promise<T> {
  const auth = options.auth !== false;
  // one key for the first try and the retry, so a retried request is never applied twice
  const opts = { ...options, idempotent: options.idempotent === true ? idempotencyKey() : options.idempotent };
  let token = auth ? ((await loadTokens())?.access ?? null) : null;
  if (auth && !token) throw new ApiError('UNAUTHORIZED', 'Please sign in again.', 401);
  let res = await send(method, path, opts, token);
  if (res.status === 401 && auth) {
    token = await refresh();
    if (!token) throw new ApiError('UNAUTHORIZED', 'Your session has ended. Please sign in again.', 401);
    res = await send(method, path, opts, token);
  }
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
  if (!res.ok) throw new ApiError(json?.error?.code ?? 'ERROR', json?.error?.message ?? 'Something went wrong. Please try again.', res.status);
  return json as T;
}
