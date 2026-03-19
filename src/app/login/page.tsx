import LoginForm from './LoginForm'

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-100 bg-white p-10 shadow-sm">
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-3 flex h-10 w-10 items-center justify-center text-xs font-black tracking-widest text-white"
            style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
          >
            LFD
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">Lift For Dan</h1>
          <p className="mt-2 text-sm text-zinc-400">Login or create an account to start tracking lifts.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
