const JWT_LIKE_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export function getStoredAuthToken(): string {
  if (typeof localStorage === 'undefined') return '';
  return (localStorage.getItem('uniflow_token') || '').trim();
}

/** Prevent sending placeholders / malformed values as Bearer tokens. */
export function getBearerAuthToken(): string | null {
  const token = getStoredAuthToken();
  if (!token) return null;
  if (token === 'admin_bypass_token') return null;
  if (!JWT_LIKE_PATTERN.test(token)) return null;
  return token;
}
