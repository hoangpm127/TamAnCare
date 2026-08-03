import { useState } from "react";

export function useExpandToggle(defaultExpanded: boolean) {
  const [overridden, setOverridden] = useState<Set<string>>(new Set());

  function isExpanded(key: string) {
    return overridden.has(key) ? !defaultExpanded : defaultExpanded;
  }

  function toggle(key: string) {
    setOverridden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return { isExpanded, toggle };
}
