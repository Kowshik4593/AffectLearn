'use client'

import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { apiService } from '../lib/api'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  initialized: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
  ensureUserRecord: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  initialized: false,

  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw error
    }

    set({ user: data.user, session: data.session })
    
    // Ensure user record exists in public.users table
    if (data.session && data.user) {
      try {
        await get().ensureUserRecord()
      } catch (userError) {
        console.warn('Failed to sync user record, but signin successful:', userError)
      }
    }
  },

  signUp: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      throw error
    }

    set({ user: data.user, session: data.session })
    
    // Ensure user record is created in public.users table
    if (data.session && data.user) {
      try {
        await get().ensureUserRecord()
      } catch (userError) {
        console.warn('Failed to create user record, but signup successful:', userError)
        // Don't throw error here as auth was successful
      }
    }
  },

  signInWithGoogle: async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/chat`
      }
    })

    if (error) {
      throw error
    }
  },

  signOut: async () => {
    console.log('Starting sign out process...')
    
    try {
      // Step 1: Clear local state immediately
      set({ user: null, session: null, loading: false })
      console.log('Local state cleared')
      
      // Step 2: Sign out from Supabase
      console.log('Calling Supabase signOut...')
      const { error } = await supabase.auth.signOut({
        scope: 'global' // Sign out from all sessions
      })
      
      if (error) {
        console.error('Supabase signOut error:', error)
        // Continue with cleanup even if Supabase signOut fails
      } else {
        console.log('Supabase signOut successful')
      }
      
      // Step 3: Clear any persisted session data
      if (typeof window !== 'undefined') {
        try {
          // Clear all possible auth-related storage
          const keysToRemove = []
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key && (key.includes('supabase') || key.includes('auth'))) {
              keysToRemove.push(key)
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key))
          
          sessionStorage.clear()
          console.log('Storage cleared')
        } catch (storageError) {
          console.warn('Error clearing storage:', storageError)
        }
      }
      
      // Step 4: Wait a bit for state changes to propagate
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Step 5: Force redirect to login
      console.log('Redirecting to login...')
      if (typeof window !== 'undefined') {
        // Use replace to prevent back button issues
        window.location.replace('/login')
      }
      
    } catch (error) {
      console.error('Sign out error:', error)
      
      // Fallback: Even if there's an error, clear everything and redirect
      set({ user: null, session: null, loading: false })
      
      if (typeof window !== 'undefined') {
        try {
          localStorage.clear()
          sessionStorage.clear()
        } catch (storageError) {
          console.warn('Error clearing storage in fallback:', storageError)
        }
        
        // Force redirect even if sign out fails
        window.location.replace('/login')
      }
    }
  },

  initialize: async () => {
    const { initialized } = get()
    if (initialized) {
      console.log('AuthStore: Already initialized, skipping...')
      return // Already initialized
    }
    
    console.log('AuthStore: Starting initialization...')
    set({ loading: true, initialized: true })
    
    try {
      console.log('AuthStore: Getting initial session...')
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('AuthStore: Error getting initial session:', error)
        // Clear any potentially corrupted session
        set({ user: null, session: null, loading: false })
        return
      }
      
      console.log('AuthStore: Got initial session:', { 
        hasSession: !!session, 
        hasUser: !!session?.user,
        userId: session?.user?.id,
        email: session?.user?.email
      })
      
      // Only set user if we have a valid, non-expired session
      if (session && session.user && session.expires_at && session.expires_at > Date.now() / 1000) {
        set({ user: session.user, session, loading: false })
        
        // Ensure user record exists
        try {
          await get().ensureUserRecord()
        } catch (userError) {
          console.warn('Failed to sync user record, but session is valid:', userError)
        }
      } else {
        console.log('AuthStore: Session invalid or expired, clearing state')
        set({ user: null, session: null, loading: false })
      }

      // Listen for auth changes only once
      console.log('AuthStore: Setting up auth state change listener...')
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('AuthStore: Auth state changed:', event, { 
          hasSession: !!session, 
          hasUser: !!session?.user,
          userId: session?.user?.id,
          email: session?.user?.email
        })
        
        // Handle different auth events
        switch (event) {
          case 'SIGNED_OUT':
            console.log('AuthStore: User signed out, clearing state')
            set({ user: null, session: null, loading: false })
            // Force redirect to login if not already there
            if (typeof window !== 'undefined' && !window.location.pathname.includes('/login') && !window.location.pathname.includes('/')) {
              console.log('AuthStore: Redirecting to login after sign out')
              window.location.href = '/login'
            }
            break
            
          case 'SIGNED_IN':
          case 'TOKEN_REFRESHED':
            console.log('AuthStore: User signed in/token refreshed')
            // Validate session before setting
            if (session && session.user && session.expires_at && session.expires_at > Date.now() / 1000) {
              set({ user: session.user, session, loading: false })
              
              console.log('AuthStore: User signed in, ensuring user record...')
              // Don't await this - let it run in background to avoid blocking
              get().ensureUserRecord().catch(err => {
                console.warn('Background user record sync failed:', err)
              })
            } else {
              console.log('AuthStore: Invalid session received, clearing state')
              set({ user: null, session: null, loading: false })
            }
            break
            
          default:
            console.log('AuthStore: Other auth event:', event)
            // Validate session for any other event
            if (session && session.user && session.expires_at && session.expires_at > Date.now() / 1000) {
              set({ user: session.user, session, loading: false })
            } else {
              set({ user: null, session: null, loading: false })
            }
            break
        }
      })
      
      console.log('AuthStore: Auth listener subscription created:', subscription)
      
    } catch (error) {
      console.error('AuthStore: Initialization failed:', error)
      set({ user: null, session: null, loading: false })
    }
  },

  ensureUserRecord: async () => {
    const { user, session } = get()
    if (!user || !session) return

    try {
      // First, try to get user profile
      await apiService.getUserProfile()
      console.log('User record exists in database')
    } catch (error: any) {
      // If user not found, try to create the user record
      if (error.response?.status === 404) {
        try {
          console.log('User not found in database, creating user record...')
          await apiService.createUser(user.email || '')
          console.log('User record created successfully')
        } catch (createError: any) {
          console.warn('Failed to create user record:', createError)
          // Don't throw - allow user to continue even if sync fails
        }
      } else if (error.response?.status === 401) {
        console.warn('Authentication error - token might be invalid')
        // Token issue - don't try to create user
      } else {
        console.warn('Unexpected error checking user profile:', error)
      }
    }
  },
}))
