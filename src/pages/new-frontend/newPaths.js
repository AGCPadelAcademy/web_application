export const NEW_AUTH_CALLBACK_PATH = '/new/auth/callback';
export const NEW_RESET_PATH = '/new/reset-password';

export function safeNewPath(value, fallback = '/new') {
  if (typeof value !== 'string') return fallback;
  if (value !== '/new' && !value.startsWith('/new/')) return fallback;
  if (value.includes('\\') || value.includes('://') || value.includes('//')) return fallback;
  return value;
}

export function newAuthCallbackUrl() {
  return `${window.location.origin}${NEW_AUTH_CALLBACK_PATH}`;
}

export function newResetUrl() {
  return `${window.location.origin}${NEW_RESET_PATH}`;
}
