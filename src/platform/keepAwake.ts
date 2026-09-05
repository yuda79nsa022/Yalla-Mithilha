import { useEffect, useId } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake as deactivate } from 'expo-keep-awake';

/**
 * `expo-keep-awake`'s own `useKeepAwake()` never catches a rejected
 * `activateKeepAwakeAsync` — which happens on any web origin without the
 * Wake Lock API (plain HTTP on something other than localhost, or a
 * browser that just doesn't support it — not something exotic), not only
 * some rare failure — so it crashes the whole screen with an unhandled
 * promise rejection. Keeping the screen awake is a nicety a round should
 * never crash over, so this swallows that failure instead.
 */
export function useKeepAwake(): void {
  const tag = useId();
  useEffect(() => {
    activateKeepAwakeAsync(tag).catch(() => undefined);
    return () => {
      deactivate(tag).catch(() => undefined);
    };
  }, [tag]);
}
