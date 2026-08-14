import { useEffect, useState } from "react";

/**
 * Trails `value` by `delayMs`. For inputs that feed a query key: without this,
 * every keystroke in a filter field is its own network request.
 */
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
