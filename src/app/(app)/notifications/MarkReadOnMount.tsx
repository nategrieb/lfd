'use client'

import { useEffect } from 'react'
import { markNotificationsRead } from './actions'

export default function MarkReadOnMount() {
  useEffect(() => {
    markNotificationsRead()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
