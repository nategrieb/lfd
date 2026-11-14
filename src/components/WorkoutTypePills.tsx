import { TYPE_PILL, cleanTypes } from '@/lib/workout-types'

/** Small read-only pills for a workout's types; renders nothing when it has none. */
export default function WorkoutTypePills({ types, className = '' }: { types: readonly string[] | null | undefined; className?: string }) {
  const list = cleanTypes(types)
  if (list.length === 0) return null
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      {list.map((type) => (
        <span key={type} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${TYPE_PILL[type]}`}>
          {type}
        </span>
      ))}
    </span>
  )
}
