/** Shown the instant you tap to another screen, until that screen has arrived. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-lg px-5 py-8" aria-busy="true">
      <div className="mb-6 flex items-center gap-4">
        <div className="h-12 w-12 animate-pulse rounded-full bg-zinc-100" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-100" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-100" />
        </div>
      </div>
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-zinc-100" />
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl border border-zinc-100 bg-white" />
        ))}
      </div>
    </div>
  )
}
