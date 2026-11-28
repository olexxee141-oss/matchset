const API_BASE_URL = (import.meta.env.DEV ? (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000') : '').replace(/\/+$/, '');

export const api = async <T,>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const body = await response.text();
  let data: unknown;
  try {
    data = body ? JSON.parse(body) : {};
  } catch {
    const preview = body.replace(/\s+/g, ' ').slice(0, 180);
    const configurationHint = API_BASE_URL ? '' : ' Check that the Vercel /api rewrite points to the Render backend.';
    throw new Error(`API returned non-JSON (HTTP ${response.status}).${configurationHint} Response: ${preview || '(empty response)'}`);
  }
  if (!response.ok) {
    const message = typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
      ? data.error
      : `Request failed (HTTP ${response.status}).`;
    throw new Error(message);
  }
  return data as T;
};

