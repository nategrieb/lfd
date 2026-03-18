'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/', label: 'Home', icon: HomeIcon },
  { href: '/workout', label: 'Workout', icon: DumbbellIcon },
  { href: '/history', label: 'History', icon: ClockIcon },
  { href: '/profile', label: 'Profile', icon: UserIcon },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-sm safe-bottom">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === '/'
              ? pathname === '/'
              : pathname.startsWith(href)

          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? 'text-blue-400'
                  : 'text-zinc-500 active:text-zinc-300'
              }`}
            >
              <Icon className="h-6 w-6" filled={isActive} />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function HomeIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  )
}

function DumbbellIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h.75a.75.75 0 01.75.75v9a.75.75 0 01-.75.75h-.75a.75.75 0 01-.75-.75v-9a.75.75 0 01.75-.75zM6 9.75h12M19.5 6.75h.75a.75.75 0 01.75.75v9a.75.75 0 01-.75.75h-.75a.75.75 0 01-.75-.75v-9a.75.75 0 01.75-.75zM6 14.25h12M1.5 9h1.5v6H1.5a.75.75 0 01-.75-.75v-4.5A.75.75 0 011.5 9zM21 9h1.5a.75.75 0 01.75.75v4.5a.75.75 0 01-.75.75H21V9z" />
    </svg>
  )
}

function ClockIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function UserIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  )
}
