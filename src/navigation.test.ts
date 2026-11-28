import { describe, expect, it } from 'vitest';
import { resolveAppRoute } from './navigation';

describe('resolveAppRoute', () => {
  it('resolves the home route and unknown paths safely', () => {
    expect(resolveAppRoute('/')).toEqual({ page: 'home' });
    expect(resolveAppRoute('/not-a-route')).toEqual({ page: 'home' });
  });

  it('resolves standalone arrangement routes', () => {
    expect(resolveAppRoute('/arrange')).toEqual({ page: 'create' });
    expect(resolveAppRoute('/set/abc123')).toEqual({ page: 'view', slug: 'abc123' });
  });

  it('resolves community routes without treating reserved paths as slugs', () => {
    expect(resolveAppRoute('/community/new')).toEqual({ page: 'create-community' });
    expect(resolveAppRoute('/community/join')).toEqual({ page: 'join-community' });
    expect(resolveAppRoute('/community/friday-crew')).toEqual({ page: 'community', slug: 'friday-crew' });
  });

  it('resolves account and recovery routes', () => {
    expect(resolveAppRoute('/account')).toEqual({ page: 'account' });
    expect(resolveAppRoute('/recover/verify')).toEqual({ page: 'recover' });
  });
});
