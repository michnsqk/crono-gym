import { useCallback, useEffect, useState } from "react";

const ADVANCED_MODE_KEY = "cronos_advanced_mode_v1";
const ADVANCED_MODE_EVENT = "cronos:advanced-mode-changed";

export function readAdvancedMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ADVANCED_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeAdvancedMode(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ADVANCED_MODE_KEY, enabled ? "1" : "0");
    window.dispatchEvent(new CustomEvent(ADVANCED_MODE_EVENT, { detail: enabled }));
  } catch {
    // Ignore storage quota errors
  }
}

export function useAdvancedMode(): [boolean, (next: boolean) => void] {
  const [advanced, setAdvanced] = useState<boolean>(() => readAdvancedMode());

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      if (typeof detail === "boolean") setAdvanced(detail);
      else setAdvanced(readAdvancedMode());
    };
    window.addEventListener(ADVANCED_MODE_EVENT, onChange);
    return () => window.removeEventListener(ADVANCED_MODE_EVENT, onChange);
  }, []);

  const update = useCallback((next: boolean) => {
    setAdvanced(next);
    writeAdvancedMode(next);
  }, []);

  return [advanced, update];
}
