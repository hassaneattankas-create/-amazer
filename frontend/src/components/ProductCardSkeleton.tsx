export function ProductCardSkeleton() {
  return (
    <article className="premium-card overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
      <div className="aspect-[4/3] w-full animate-pulse bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100" />
      <div className="space-y-3 p-4">
        <div className="space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-11/12 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-8/12 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="h-9 animate-pulse rounded-lg bg-slate-200" />
      </div>
    </article>
  );
}
