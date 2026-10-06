import { ApiError, request, setAuthLostHandler } from '../request';
import { loadTokens, saveTokens } from '../tokens';

jest.mock('../tokens', () => {
  let tokens: { access: string; refresh: string } | null = null;
  return { loadTokens: jest.fn(async () => tokens), saveTokens: jest.fn(async (t) => void (tokens = t)) };
});

const json = (status: number, body: unknown) => ({ status, ok: status >= 200 && status < 300, json: async () => body }) as Response;
const fetchMock = jest.fn();
beforeEach(async () => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  await saveTokens({ access: 'old-access', refresh: 'refresh-1' });
});
const headers = (call: number) => (fetchMock.mock.calls[call][1] as RequestInit).headers as Record<string, string>;

describe('request', () => {
  it('sends the bearer token and returns the body', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { balance_kobo: 500 }));
    await expect(request('GET', '/v1/riders/me')).resolves.toEqual({ balance_kobo: 500 });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.vendoltd.com/v1/riders/me');
    expect(headers(0).Authorization).toBe('Bearer old-access');
  });

  it('turns the server’s error body into an ApiError with its message', async () => {
    fetchMock.mockResolvedValueOnce(json(409, { error: { code: 'ITEM_UNAVAILABLE', message: 'A cart item is unavailable.' } }));
    await expect(request('POST', '/v1/orders/quote', { body: {} })).rejects.toMatchObject({ code: 'ITEM_UNAVAILABLE', message: 'A cart item is unavailable.', status: 409 });
  });

  it('renews an expired session once and retries with the same idempotency key', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { error: { code: 'AUTH_FAILED', message: 'expired' } }))
      .mockResolvedValueOnce(json(200, { access_token: 'new-access', refresh_token: 'refresh-2' }))
      .mockResolvedValueOnce(json(201, { id: 'order-1' }));
    await expect(request('POST', '/v1/orders', { body: { quote_id: 'q' }, idempotent: true })).resolves.toEqual({ id: 'order-1' });
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.vendoltd.com/v1/auth/refresh');
    expect(headers(2).Authorization).toBe('Bearer new-access');
    expect(headers(2)['Idempotency-Key']).toBe(headers(0)['Idempotency-Key']); // so the order can't be created twice
    expect(await loadTokens()).toEqual({ access: 'new-access', refresh: 'refresh-2' });
  });

  it('signs the customer out when the session can’t be renewed', async () => {
    const lost = jest.fn();
    setAuthLostHandler(lost);
    fetchMock.mockResolvedValueOnce(json(401, {})).mockResolvedValueOnce(json(401, {}));
    await expect(request('GET', '/v1/me')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(lost).toHaveBeenCalledTimes(1);
    expect(await loadTokens()).toBeNull();
  });

  it('reports no connection in plain words, and never calls the server without a session', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(request('GET', '/v1/cities', { auth: false })).rejects.toThrow('Can’t reach Vendo');
    await saveTokens(null);
    fetchMock.mockClear();
    await expect(request('GET', '/v1/me')).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
