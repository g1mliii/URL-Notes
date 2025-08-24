'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabaseClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { User } from '@/lib/types'

interface AuthContextType {
  user: any | null
  session: any | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: any }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null)
  const [session, setSession] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  const { setUser: setStoreUser, setAuthenticated } = useAppStore()

  // Helper function to convert Supabase user to our User type
  const convertToAppUser = (supabaseUser: any): User | null => {
    if (!supabaseUser) return null
    
    return {
      id: supabaseUser.id,
      email: supabaseUser.email || '',
      subscription_tier: 'free', // Default to free tier
      storage_used_bytes: 0,
      created_at: supabaseUser.created_at || new Date().toISOString(),
      updated_at: supabaseUser.updated_at || new Date().toISOString()
    }
  }

  useEffect(() => {
    // Initialize the Supabase client
    const initAuth = async () => {
      await supabaseClient.init()
      
      // Check if user is authenticated
      const currentUser = supabaseClient.getCurrentUser()
      setUser(currentUser)
      setStoreUser(convertToAppUser(currentUser))
      setAuthenticated(!!currentUser)
      setIsLoading(false)
    }

    initAuth()
  }, [setStoreUser, setAuthenticated])

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabaseClient.signInWithEmail(email, password)
    if (data && !error) {
      setUser(supabaseClient.getCurrentUser())
      setStoreUser(convertToAppUser(supabaseClient.getCurrentUser()))
      setAuthenticated(true)
    }
    return { error }
  }

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabaseClient.signUpWithEmail(email, password)
    if (data && !error) {
      setUser(supabaseClient.getCurrentUser())
      setStoreUser(convertToAppUser(supabaseClient.getCurrentUser()))
      setAuthenticated(true)
    }
    return { error }
  }

  const signOut = async () => {
    await supabaseClient.signOut()
    setUser(null)
    setStoreUser(null)
    setAuthenticated(false)
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabaseClient.resetPassword(email)
    return { error }
  }

  const updatePassword = async (password: string) => {
    // TODO: Implement password update in supabaseClient
    return { error: 'Password update not yet implemented' }
  }

  const value = {
    user,
    session,
    isLoading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
