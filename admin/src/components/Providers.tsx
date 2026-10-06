"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useSession } from "@/store/session";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 15000, retry: 1 } } }));
  const id = useSession((s) => s.admin?.id);
  const previous = useRef(id);
  useEffect(() => {
    // An account signed out or was replaced by another: drop everything it loaded.
    // Going from "nobody" to an account is left alone: that is either a fresh sign-in (nothing cached)
    // or the saved session appearing just after the page loads, and clearing then discards requests
    // the screens have already started, leaving a reloaded page stuck on its spinner.
    if (previous.current !== undefined && previous.current !== id) client.removeQueries();
    previous.current = id;
  }, [id, client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
