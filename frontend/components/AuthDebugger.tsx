'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'

export default function AuthDebugger() {
  const { user, session } = useAuthStore()
  const [supabaseSession, setSupabaseSession] = useState<any>(null)
  const [authState, setAuthState] = useState<string>('unknown')

  useEffect(() => {
    // Check Supabase session directly
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        console.log('AuthDebugger: Direct Supabase session check:', { session, error })
        setSupabaseSession(session)
      } catch (error) {
        console.error('AuthDebugger: Error checking session:', error)
      }
    }

    checkSession()

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('AuthDebugger: Auth state change:', event, session)
      setAuthState(event)
      setSupabaseSession(session)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleForceSignOut = async () => {
    console.log('AuthDebugger: Force sign out')
    try {
      await supabase.auth.signOut()
      console.log('AuthDebugger: Force sign out completed')
    } catch (error) {
      console.error('AuthDebugger: Force sign out error:', error)
    }
  }

  const handleClearStorage = () => {
    console.log('AuthDebugger: Clearing all storage')
    if (typeof window !== 'undefined') {
      localStorage.clear()
      sessionStorage.clear()
      console.log('AuthDebugger: Storage cleared')
    }
  }

  return (
    <div className="fixed bottom-4 left-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-w-sm">
      <h3 className="text-sm font-bold mb-2">Auth Debug Info</h3>
      <div className="text-xs space-y-1">
        <div>Store User: {user ? user.email : 'null'}</div>
        <div>Store Session: {session ? 'exists' : 'null'}</div>
        <div>Supabase Session: {supabaseSession ? supabaseSession.user?.email || 'exists' : 'null'}</div>
        <div>Last Auth Event: {authState}</div>
        <div className="pt-2 space-y-1">
          <button
            onClick={handleForceSignOut}
            className="block w-full text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
          >
            Force Sign Out
          </button>
          <button
            onClick={handleClearStorage}
            className="block w-full text-xs bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600"
          >
            Clear Storage
          </button>
        </div>
      </div>
    </div>
  )
}
