'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

/** A card you can drag to reorder by its handle. The handle is passed to the card so it can sit in the header. */
export default function SortableCard({ id, children }: { id: string; children: (handle: React.ReactNode, dragging: boolean) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder"
      title="Drag to reorder"
      style={{ touchAction: 'none' }}
      className="flex h-9 w-7 shrink-0 cursor-grab items-center justify-center rounded-md text-zinc-300 hover:text-zinc-500 active:cursor-grabbing"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
        <path d="M7 4a1.25 1.25 0 110 2.5A1.25 1.25 0 017 4zm6 0a1.25 1.25 0 110 2.5A1.25 1.25 0 0113 4zM7 8.75a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5zm6 0a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5zM7 13.5a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5zm6 0a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5z" />
      </svg>
    </button>
  )

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 30 : undefined, position: 'relative' }}
      className={isDragging ? 'opacity-90 shadow-xl' : undefined}
    >
      {children(handle, isDragging)}
    </div>
  )
}
