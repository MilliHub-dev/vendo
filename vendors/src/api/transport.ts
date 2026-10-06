export type Tokens = { access_token: string; refresh_token: string; expires_in: number };
export type SessionAccess = { get(): { token: string | null; refreshToken: string | null; accountId?: string | null }; save(tokens: Tokens): void; clear(): void };
export class ApiError extends Error { constructor(message: string, public status: number, public code: string) { super(message); } }
export function createTransport(baseUrl: string, session: SessionAccess, fetcher: typeof fetch = fetch) {
  const base = baseUrl.replace(/\/$/, '');
  let refreshing: Promise<void> | null = null;
  async function raw<T>(path: string, method: string, body?: unknown, token?: string | null, key?: string): Promise<T> {
    const response = await fetcher(`${base}${path}`, { method, cache: 'no-store', headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...(key ? { 'idempotency-key': key } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(data?.error?.message ?? `Request failed (${response.status}).`, response.status, data?.error?.code ?? 'REQUEST_FAILED');
    return data as T;
  }
  return async function request<T>(path: string, method = 'GET', body?: unknown, auth = true, key?: string): Promise<T> {
    const initial = session.get(), token = initial.token;
    const sameAccount = () => session.get().accountId === initial.accountId;
    const checkAccount = () => { if (!sameAccount()) throw new ApiError("The signed-in account changed. Please try again.", 401, "SESSION_CHANGED"); };
    if (auth && !token) throw new ApiError('Sign in to continue.', 401, 'UNAUTHORIZED');
    try { const result=await raw<T>(path, method, body, auth ? token : null, key); if(auth)checkAccount(); return result; }
    catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401 || !auth) throw error;
      checkAccount();
      if (session.get().token !== token && session.get().token) return raw<T>(path, method, body, session.get().token, key);
      if (!refreshing) refreshing = (async () => {
        const refresh = session.get().refreshToken;
        if (!refresh) { session.clear(); throw error; }
        try { const next=await raw<Tokens>('/v1/auth/refresh', 'POST', { refresh_token: refresh });checkAccount();if(session.get().refreshToken!==refresh)throw new ApiError('The session changed. Try again.',401,'SESSION_CHANGED');session.save(next); }
        catch (failure) { if (failure instanceof ApiError && failure.code !== 'SESSION_CHANGED' && sameAccount() && [400,401,403].includes(failure.status)) session.clear(); throw failure; }
      })().finally(() => { refreshing = null; });
      await refreshing;
      checkAccount();
      try { const result=await raw<T>(path, method, body, session.get().token, key);checkAccount();return result; }
      catch (failure) { if (failure instanceof ApiError && failure.code !== 'SESSION_CHANGED' && sameAccount() && failure.status === 401) session.clear(); throw failure; }
    }
  };
}
