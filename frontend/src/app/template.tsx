/**
 * Transition d'entree de page en CSS pur : le contenu rendu par le serveur est visible
 * immediatement, meme avant le chargement du JavaScript (reseau mobile lent).
 * L'ancienne version (framer-motion, opacite 0 jusqu'a l'hydratation) laissait l'ecran blanc.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
