import { redirect } from "next/navigation";

// La recherche vit sur l'accueil : on garde le mot cherche (?q=) pour les liens partages.
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  redirect(q ? `/?q=${encodeURIComponent(q)}` : "/");
}
