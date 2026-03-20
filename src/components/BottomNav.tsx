'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Props = {
  activeWorkoutId?: string | null
}

export default function BottomNav({ activeWorkoutId }: Props) {
  const pathname = usePathname()

  const recordHref = activeWorkoutId ? `/workout/${activeWorkoutId}` : '/start'
  const feedActive    = pathname === '/'
  const recordActive  = pathname.startsWith('/workout') || pathname === '/start'
  const historyActive = pathname === '/history' || pathname.startsWith('/programs') || pathname.startsWith('/scheduled')
  const searchActive  = pathname.startsWith('/search') || pathname.startsWith('/people')
  const youActive     = pathname === '/profile' || pathname.startsWith('/lifts') || pathname.startsWith('/settings')

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-100 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-lg items-center justify-around px-1 py-2">

        {/* Feed */}
        <Link href="/" prefetch={false}
          className={`flex flex-col items-center gap-0.5 rounded-xl px-4 py-2 text-xs font-medium transition-colors ${
            feedActive ? 'text-green-700' : 'text-zinc-400 active:text-zinc-600'
          }`}
        >
          <HomeIcon className="h-6 w-6" filled={feedActive} />
          <span>Feed</span>
        </Link>

        {/* History */}
        <Link href="/history" prefetch={false}
          className={`flex flex-col items-center gap-0.5 rounded-xl px-4 py-2 text-xs font-medium transition-colors ${
            historyActive ? 'text-green-700' : 'text-zinc-400 active:text-zinc-600'
          }`}
        >
          <CalendarIcon className="h-6 w-6" filled={historyActive} />
          <span>History</span>
        </Link>

        {/* Lift — centre primary action */}
        <Link href={recordHref} prefetch={false}
          className={`flex flex-col items-center gap-0.5 rounded-xl px-4 py-2 text-xs font-medium transition-colors ${
            recordActive ? 'text-green-700' : 'text-zinc-400 active:text-zinc-600'
          }`}
        >
          <div className="relative">
            <DumbbellIcon className="h-6 w-6" filled={recordActive} />
            {activeWorkoutId && (
              <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-600 opacity-75" />
                <span className="relative h-2 w-2 rounded-full bg-green-600" />
              </span>
            )}
          </div>
          <span>{activeWorkoutId ? 'Active' : 'Lift'}</span>
        </Link>

        {/* Search */}
        <Link href="/search" prefetch={false}
          className={`flex flex-col items-center gap-0.5 rounded-xl px-4 py-2 text-xs font-medium transition-colors ${
            searchActive ? 'text-green-700' : 'text-zinc-400 active:text-zinc-600'
          }`}
        >
          <SearchIcon className="h-6 w-6" filled={searchActive} />
          <span>Search</span>
        </Link>

        {/* You */}
        <Link href="/profile" prefetch={false}
          className={`flex flex-col items-center gap-0.5 rounded-xl px-4 py-2 text-xs font-medium transition-colors ${
            youActive ? 'text-green-700' : 'text-zinc-400 active:text-zinc-600'
          }`}
        >
          <UserIcon className="h-6 w-6" filled={youActive} />
          <span>You</span>
        </Link>

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

function CalendarIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.5}>
      {filled
        ? <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z" clipRule="evenodd" />
        : <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      }
    </svg>
  )
}

function SearchIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.5}>
      {filled
        ? <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 100 13.5 6.75 6.75 0 000-13.5zM2.25 10.5a8.25 8.25 0 1114.59 5.28l4.69 4.69a.75.75 0 11-1.06 1.06l-4.69-4.69A8.25 8.25 0 012.25 10.5z" clipRule="evenodd" />
        : <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
      }
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
