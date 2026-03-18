import LoginForm from './LoginForm'

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/80 p-10 shadow-2xl backdrop-blur">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Lift For Dan</h1>
          <p className="mt-2 text-sm text-zinc-400">Login or create an account to start tracking lifts.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
