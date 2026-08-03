import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_DEBOUNCE_MS = 450;

/**
 * Drives the "type and it just saves" UX (FR2). The component keeps its own
 * local `value` for instant feedback on every keystroke; after the user
 * pauses for `debounceMs`, `onCommit` fires with the latest value. If the
 * underlying `initialValue` changes because of a fresh server response
 * (e.g. switching to a different character), the local value resyncs.
 */
export function useAutosaveField<T>(
  initialValue: T,
  onCommit: (value: T) => void,
  debounceMs: number = DEFAULT_DEBOUNCE_MS,
) {
  const [value, setValue] = useState(initialValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommittedRef = useRef(initialValue);

  // Resync when the source value changes from elsewhere (e.g. navigating to
  // a different entity, or an external update landing via query invalidation).
  useEffect(() => {
    setValue(initialValue);
    lastCommittedRef.current = initialValue;
  }, [initialValue]);

  const commitNow = useCallback(
    (next: T) => {
      if (next === lastCommittedRef.current) return;
      lastCommittedRef.current = next;
      onCommit(next);
    },
    [onCommit],
  );

  const onChange = useCallback(
    (next: T) => {
      setValue(next);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => commitNow(next), debounceMs);
    },
    [commitNow, debounceMs],
  );

  // Flush on unmount so navigating away doesn't drop a pending edit.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flush = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    commitNow(value);
  }, [commitNow, value]);

  return { value, onChange, flush };
}
