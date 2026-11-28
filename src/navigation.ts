export type AppPage = 'home' | 'create' | 'view' | 'create-community' | 'join-community' | 'community' | 'account' | 'recover';

export type AppRoute = { page: AppPage; slug?: string };

export function resolveAppRoute(pathname: string): AppRoute {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return { page: 'home' };
  if (parts[0] === 'set' && parts[1]) return { page: 'view', slug: parts[1] };
  if (parts[0] === 'community' && parts[1] === 'new') return { page: 'create-community' };
  if (parts[0] === 'community' && parts[1] === 'join') return { page: 'join-community' };
  if (parts[0] === 'community' && parts[1]) return { page: 'community', slug: parts[1] };
  if (parts[0] === 'account') return { page: 'account' };
  if (parts[0] === 'recover' && parts[1] === 'verify') return { page: 'recover' };
  if (parts[0] === 'arrange') return { page: 'create' };
  return { page: 'home' };
}
