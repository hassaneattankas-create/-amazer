"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

// La recherche vit sur l'accueil : on garde le mot cherché (?q=) pour les liens partagés.
// Redirection côté navigateur : compatible avec l'export statique de l'application mobile.
function SearchRedirect() {
  const router = useRouter();
  const q = useSearchParams().get("q");
  useEffect(() => {
    router.replace(q ? `/?q=${encodeURIComponent(q)}` : "/");
  }, [q, router]);
  return null;
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchRedirect />
    </Suspense>
  );
}
