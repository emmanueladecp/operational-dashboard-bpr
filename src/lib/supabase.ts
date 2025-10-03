import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Store the token getter function
let getTokenFunction: (() => Promise<string | null>) | null = null

// Single Supabase client instance with custom fetch that uses Clerk token
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    async fetch(url, options = {}) {
      // Get token from the stored function if available
      if (getTokenFunction) {
        try {
          const clerkToken = await getTokenFunction()
          
          if (clerkToken) {
            // Inject Clerk token as Bearer token
            const headers = new Headers(options.headers)
            headers.set('Authorization', `Bearer ${clerkToken}`)
            
            return fetch(url, {
              ...options,
              headers,
            })
          }
        } catch (error) {
          console.error('Error getting Clerk token:', error)
        }
      }
      
      // Fallback to regular fetch without auth
      return fetch(url, options)
    },
  },
})

// Function to set the token getter (call this when session is available)
export function setClerkTokenGetter(getToken: () => Promise<string | null>) {
  getTokenFunction = getToken
}

// Function to clear the token getter (call on logout)
export function clearClerkTokenGetter() {
  getTokenFunction = null
}

// Export the single client instance
export const supabase = supabaseClient

// For backward compatibility - returns the same singleton
export function createClerkSupabaseClient(getToken: () => Promise<string | null>): SupabaseClient {
  setClerkTokenGetter(getToken)
  return supabaseClient
}

// For backward compatibility - clears the token getter
export function resetClerkSupabaseClient() {
  clearClerkTokenGetter()
}