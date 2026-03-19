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
      <div className="rounded-xl border border-green-700/20 bg-green-50 px-6 py-8 text-center">
        <p className="text-lg font-semibold text-green-800">Check your email</p>
        <p className="mt-2 text-sm text-zinc-500">
          We sent a confirmation link to your inbox. Click it to activate your account.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-green-700"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-green-700"
        />
      </div>

      {error ? (
        <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>
      ) : null}

      <button
        type="submit"
        className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
        disabled={isPending}
      >
        {isPending ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
      </button>

      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{mode === 'login' ? "Don't have an account?" : 'Already have an account?'}</span>
        <button
          type="button"
          className="font-medium text-green-700 hover:text-green-800"
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
