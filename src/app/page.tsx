'use client' // This tells Next.js this is a browser-side file

import { createClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'

export default function Home() {
  const [connectionStatus, setConnectionStatus] = useState('Checking...')

  useEffect(() => {
    async function checkConnection() {
      const supabase = createClient()
      
      // Try to fetch the current user (it will be null, but it tests the API)
      const { error } = await supabase.auth.getUser()
      
      if (error && error.message.includes('Fetch')) {
        setConnectionStatus('❌ Connection Failed. Check your .env.local keys.')
      } else {
        setConnectionStatus('✅ Connected to Supabase!')
      }
    }
    
    checkConnection()
  }, [])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white p-6">
      <div className="border border-zinc-800 p-8 rounded-xl bg-zinc-900 shadow-2xl">
        <h1 className="text-4xl font-extrabold tracking-tighter mb-4">
          IRON<span className="text-blue-500">TRACK</span> PRO
        </h1>
        <p className="text-zinc-400 font-mono text-sm">
          Status: <span className="text-white">{connectionStatus}</span>
        </p>
      </div>
    </main>
  )
}