export function SkeletonCard() {
  return (
    <div className="lp-panel p-5 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-3/4 mb-3" />
      <div className="h-3 bg-slate-100 rounded w-1/2 mb-4" />
      <div className="h-2 bg-slate-100 rounded w-full mb-2" />
      <div className="h-2 bg-slate-100 rounded w-full" />
    </div>
  )
}

export function SkeletonPage() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 bg-slate-200 rounded w-1/3" />
      <div className="h-4 bg-slate-100 rounded w-2/3" />
      <div className="grid grid-cols-3 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}
