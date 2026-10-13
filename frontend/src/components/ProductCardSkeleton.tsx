type ProductCardSkeletonProps = {
  /** `tile` : case de grille produit (carree) ; `panel` : bloc de chargement generique. */
  variant?: "tile" | "panel";
};

export function ProductCardSkeleton({ variant = "panel" }: ProductCardSkeletonProps) {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-card" aria-hidden="true">
      <div
        className={`w-full animate-pulse bg-surface-2 ${variant === "tile" ? "aspect-square" : "aspect-[4/3] max-h-64"}`}
      />
      <div className="space-y-2 p-3">
        <div className="h-4 w-20 animate-pulse rounded-field bg-surface-2" />
        <div className="h-3 w-11/12 animate-pulse rounded-field bg-surface-2" />
        <div className="h-3 w-8/12 animate-pulse rounded-field bg-surface-2" />
      </div>
    </div>
  );
}
