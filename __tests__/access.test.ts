import { isPublicPath, safeNextPath, signInHref } from '../src/services/access';

describe('isPublicPath', () => {
  it('lets a guest open only the public screens', () => {
    for (const path of ['/', '/home', '/account', '/language', '/privacy', '/reveal', '/home/']) {
      expect(isPublicPath(path)).toBe(true);
    }
  });

  it('needs a signed-in player everywhere else, bookmarks included', () => {
    for (const path of ['/buy', '/usage', '/settings', '/change-password', '/charades/draft', '/charades/checkout', '/charades/play', '/buy/']) {
      expect(isPublicPath(path)).toBe(false);
    }
  });
});

describe('safeNextPath', () => {
  it('keeps this app’s own screens, query and all', () => {
    expect(safeNextPath('/buy')).toBe('/buy');
    expect(safeNextPath('/charades/checkout?payment=abc&result=paid')).toBe('/charades/checkout?payment=abc&result=paid');
  });

  it('never sends anyone off-site after signing in', () => {
    for (const next of ['//evil.example', '/\\evil.example', 'https://evil.example', 'evil.example', '/\nfoo', undefined, 42, '']) {
      expect(safeNextPath(next)).toBeNull();
    }
  });

  it('never loops back to the sign-in screen', () => {
    expect(safeNextPath('/account')).toBeNull();
    expect(safeNextPath('/account?next=%2Fbuy')).toBeNull();
  });
});

describe('signInHref', () => {
  it('carries the page, and its query, to come back to', () => {
    expect(signInHref('/buy')).toBe('/account?next=%2Fbuy');
    expect(signInHref('/charades/checkout', 'payment=abc&result=paid')).toBe(
      '/account?next=%2Fcharades%2Fcheckout%3Fpayment%3Dabc%26result%3Dpaid'
    );
  });
});
