import { useEffect, useRef } from 'react';
import { DeviceMotion } from 'expo-sensors';

export interface TiltHandlers {
  onForward: () => void;
  onBackward: () => void;
}

/**
 * Heads-up style tilt control.
 *
 * The phone rests on the performer's forehead, so what matters is pitch (beta).
 * We require the device to return to a neutral band between gestures,
 * otherwise a single slow tilt fires a dozen times. If the sensor is missing
 * or permission is refused the hook simply does nothing and the on-screen
 * buttons remain the primary control — they are never hidden.
 */
export function useTilt(enabled: boolean, handlers: TiltHandlers): void {
  const armed = useRef(true);
  const callbacks = useRef(handlers);
  callbacks.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    let subscription: { remove: () => void } | undefined;
    let cancelled = false;

    (async () => {
      const available = await DeviceMotion.isAvailableAsync().catch(() => false);
      if (!available || cancelled) return;

      DeviceMotion.setUpdateInterval(120);
      subscription = DeviceMotion.addListener(({ rotation }) => {
        if (!rotation) return;
        const pitch = rotation.beta;

        if (Math.abs(pitch) < 0.35) {
          armed.current = true;
          return;
        }
        if (!armed.current) return;

        if (pitch > 0.85) {
          armed.current = false;
          callbacks.current.onForward();
        } else if (pitch < -0.85) {
          armed.current = false;
          callbacks.current.onBackward();
        }
      });
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);
}
