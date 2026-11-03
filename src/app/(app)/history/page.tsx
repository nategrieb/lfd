import { redirect } from 'next/navigation'

// History and You were two pages for the same person; they are one now.
export default function HistoryPage() {
  redirect('/profile')
}
