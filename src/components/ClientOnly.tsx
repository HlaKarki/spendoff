import { useEffect, useState, type ReactNode } from "react";

/** Renders children only after mount. The Spendoff app is fetch/cookie-driven, so we
 *  render client-side and skip SSR data fetching (relative API URLs don't resolve on the server). */
export function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
}

export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
