import BottomNav from '@/components/BottomNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-white">
      <div className="flex-1 pb-20">{children}</div>
      <BottomNav />
    </div>
  )
}
