'use client'

import { useState, useTransition } from 'react'
import { login, signup } from './actions'

export default function LoginForm() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const formData = new FormData(event.currentTarget)

    startTransition(async () => {
      const result = mode === 'login' ? await login(formData) : await signup(formData)

      if (!result.success) {
        setError(result.message)
        return
      }

      if (result.needsConfirmation) {
        setConfirmed(true)
        return
      }

      window.location.href = '/'
    })
  }

  if (confirmed) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-6 py-8 text-center">
        <p className="text-lg font-semibold text-amber-400">Check your email</p>
        <p className="mt-2 text-sm text-zinc-400">
          We sent a confirmation link to your inbox. Click it to activate your account.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-zinc-200">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-zinc-200">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error ? (
        <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>
      ) : null}

      <button
        type="submit"
        className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
      >
        {isPending ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
      </button>

      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>{mode === 'login' ? "Don't have an account?" : 'Already have an account?'}</span>
        <button
          type="button"
          className="font-medium text-white hover:text-blue-200"
          onClick={() => {
            setError(null)
            setMode(mode === 'login' ? 'signup' : 'login')
          }}
        >
          {mode === 'login' ? 'Sign up' : 'Sign in'}
        </button>
      </div>
    </form>
  )
}

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-zinc-200">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-zinc-200">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error ? (
        <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>
      ) : null}

      <button
        type="submit"
        className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
      >
        {isPending ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
      </button>

      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>{mode === 'login' ? "Don't have an account?" : 'Already have an account?'}</span>
        <button
          type="button"
          className="font-medium text-white hover:text-blue-200"
          onClick={() => {
            setError(null)
            setMode(mode === 'login' ? 'signup' : 'login')
          }}
        >
          {mode === 'login' ? 'Sign up' : 'Sign in'}
        </button>
      </div>
    </form>
  )
}
