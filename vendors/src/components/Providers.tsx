"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect, type ReactNode } from "react";

import { useSession } from "@/store/session";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } }));
  useEffect(() => useSession.subscribe((state, previous) => { if (state.user?.id !== previous.user?.id || (!state.token && previous.token)) client.clear(); }), [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
