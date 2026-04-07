/**
 * FILE 5: lib/api-client.ts
 * API Client with retries, exponential backoff, and auth-expired trigger.
 */
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function request(url: string, method: string, body?: any, signal?: AbortSignal) {
  let attempt = 0;
  const maxRetries = 4;
  const delays = [1000, 2000, 4000, 8000];

  while (attempt <= maxRetries) {
    try {
      const response = await fetch(`${BASE_URL}${url}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('shop_os_token')}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal
      });

      if (response.status === 401) {
        window.dispatchEvent(new CustomEvent('cafe:auth:expired'));
        throw new Error('AUTH_UNAUTHORIZED');
      }

      if (attempt < maxRetries && [502, 503, 504].includes(response.status)) {
        throw new Error(`RETRYABLE:${response.status}`);
      }

      if (!response.ok) throw new Error(await response.text());
      return await response.json();
    } catch (err: any) {
      if (err.message === 'AUTH_UNAUTHORIZED') throw err;
      if (attempt < maxRetries) {
        console.warn(`Retry ${attempt + 1}/${maxRetries} after ${delays[attempt]}ms delay...`);
        await new Promise(r => setTimeout(r, delays[attempt]));
        attempt++;
      } else {
        throw err;
      }
    }
  }
}

export const api = {
  get: (url: string, opts?: { signal?: AbortSignal }) => request(url, 'GET', undefined, opts?.signal),
  post: (url: string, body: any) => request(url, 'POST', body),
  put: (url: string, body: any) => request(url, 'PUT', body),
  delete: (url: string) => request(url, 'DELETE'),
};
