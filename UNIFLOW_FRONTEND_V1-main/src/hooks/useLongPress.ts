import { useCallback, useRef } from 'react';

export interface UseLongPressOptions {
  onLongPress: () => void;
  onShortPress?: () => void;
  /** Default 1500ms */
  durationMs?: number;
  /** Cancel long-press if pointer moves beyond this distance (px) from start */
  moveThresholdPx?: number;
}

export interface LongPressPointerHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
}

/**
 * Pointer-based long press: fires onLongPress after duration if the pointer
 * stays within moveThreshold. If released earlier without long press, fires onShortPress.
 * Use instead of click when you need both tap and long-press on the same control.
 */
export function useLongPress({
  onLongPress,
  onShortPress,
  durationMs = 1500,
  moveThresholdPx = 12
}: UseLongPressOptions): LongPressPointerHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const longPressFiredRef = useRef(false);
  const movedTooMuchRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      longPressFiredRef.current = false;
      movedTooMuchRef.current = false;
      startRef.current = { x: e.clientX, y: e.clientY };
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        longPressFiredRef.current = true;
        onLongPress();
      }, durationMs);
    },
    [clearTimer, durationMs, onLongPress]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startRef.current || longPressFiredRef.current) return;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      if (dx * dx + dy * dy > moveThresholdPx * moveThresholdPx) {
        movedTooMuchRef.current = true;
        clearTimer();
      }
    },
    [clearTimer, moveThresholdPx]
  );

  const endGesture = useCallback(() => {
    clearTimer();
    startRef.current = null;
  }, [clearTimer]);

  const onPointerUp = useCallback(
    (_e: React.PointerEvent) => {
      const wasLongPress = longPressFiredRef.current;
      const cancelledByMove = movedTooMuchRef.current;
      endGesture();
      if (wasLongPress) return;
      if (!cancelledByMove && onShortPress) {
        onShortPress();
      }
    },
    [endGesture, onShortPress]
  );

  const onPointerCancel = useCallback(
    (_e: React.PointerEvent) => {
      endGesture();
    },
    [endGesture]
  );

  const onPointerLeave = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') {
        clearTimer();
        startRef.current = null;
      }
    },
    [clearTimer]
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onPointerLeave
  };
}
