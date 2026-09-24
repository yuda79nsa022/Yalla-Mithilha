import { router } from 'expo-router';

/**
 * Pops back to the actual previous screen when there is one. A direct link
 * or a page refresh starts a brand-new navigation stack, though, so a plain
 * `router.back()` there has nothing to pop and silently does nothing —
 * this falls back to a sensible screen instead of leaving the back button
 * dead.
 */
export function goBack(fallback: string = '/home') {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback);
  }
}
