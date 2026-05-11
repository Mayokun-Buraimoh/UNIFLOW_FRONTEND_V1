import { History } from 'history';
import { getDefaultStartPath } from './appPreferences';

export function getBackFallbackPath(pathname: string): string {
  if (pathname === '/login' || pathname === '/register') return '/signup';
  if (pathname === '/signup') return '/onboarding2';
  if (pathname === '/onboarding2') return '/onboarding';
  if (pathname === '/onboarding') return '/splash';
  return getDefaultStartPath();
}

export function navigateBackSafely(
  history: History,
  pathname: string,
  explicitFallbackPath?: string
): void {
  if (history.length > 1) {
    history.goBack();
    return;
  }

  const fallbackPath = explicitFallbackPath ?? getBackFallbackPath(pathname);
  history.replace(fallbackPath === pathname ? '/home' : fallbackPath);
}
