import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

// Example user state interface
interface User {
  id: string
  name: string
  email: string
  username?: string
  role?: string
}

// Main app state interface
interface AppState {
  // User state
  user: User | null
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  logout: () => void

  // UI state
  theme: 'light' | 'dark' | 'system'
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  
  // Loading states
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
}

// Create the store with devtools and persist middleware
export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        user: null,
        isAuthenticated: false,
        theme: 'system',
        isLoading: false,

        // Actions
        setUser: (user) =>
          set({ user, isAuthenticated: !!user }, false, 'setUser'),
        
        logout: () => {
          set({ user: null, isAuthenticated: false }, false, 'logout')
          // Clear localStorage on logout
          localStorage.removeItem('app-storage')
        },
        
        setTheme: (theme) =>
          set({ theme }, false, 'setTheme'),
        
        setIsLoading: (loading) =>
          set({ isLoading: loading }, false, 'setIsLoading'),
      }),
      {
        name: 'app-storage', // localStorage key
        version: 1, // Add version to force migration
        partialize: (state) => ({
          // Only persist these fields
          theme: state.theme,
          user: state.user,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    )
  )
)
