"use client";

import dynamic from "next/dynamic";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";

import { Toaster } from "@/components/ui/Toaster";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/store/toast-store";

type QueryProviderProps = {
  children: ReactNode;
};

const ReactQueryDevtools = dynamic(
  () => import("@tanstack/react-query-devtools").then((mod) => mod.ReactQueryDevtools),
  { ssr: false }
);

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // Toute action qui echoue sans message prevu affiche la cause en haut de l'ecran.
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            if (!mutation.options.onError) toast.error(getApiErrorMessage(error, "Action impossible. Réessayez."));
          },
        }),
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
      {process.env.NODE_ENV !== "production" ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
}
