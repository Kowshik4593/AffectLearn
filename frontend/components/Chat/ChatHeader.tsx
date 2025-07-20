'use client'

import { useAuthStore } from '../../store/authStore'
import { useChatStore } from '../../store/chatStore'
import { Globe, User, LogOut, ChevronDown, Menu, Sun, Moon, Brain } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useDarkMode } from '../../hooks/useDarkMode'

export default function ChatHeader() {
  const router = useRouter()
  const { user, signOut } = useAuthStore()
  const { language, setLanguage, currentSession, toggleSidebar, isSidebarMinimized } = useChatStore()
  const [darkMode, toggleDarkMode] = useDarkMode()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const languageMenuRef = useRef<HTMLDivElement>(null)

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'Hindi' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
  ]

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      
      // Don't close if clicking on dropdown buttons
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setShowUserMenu(false)
      }
      if (languageMenuRef.current && !languageMenuRef.current.contains(target)) {
        setShowLanguageMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleAnalyticsClick = () => {
    console.log('Analytics button clicked')
    setShowUserMenu(false)
    // Always use the fixed session ID for analytics
    const fixedSessionId = "ed8c0ffa-21f2-4dfb-938e-8cdf7baa3384"
    router.push(`/analytics?sessionId=${fixedSessionId}`)
  }

  const handleSignOutClick = () => {
    console.log('Sign out button clicked')
    setShowUserMenu(false)
    handleSignOut()
  }

  const handleSignOut = async () => {
    if (isSigningOut) {
      return // Prevent multiple clicks
    }
    
    try {
      console.log('ChatHeader: Starting sign out process...')
      setIsSigningOut(true)
      setShowUserMenu(false) // Close the menu immediately
      
      console.log('ChatHeader: Current user before sign out:', user?.email)
      
      // Add a small delay to ensure UI updates
      await new Promise(resolve => setTimeout(resolve, 100))
      
      console.log('ChatHeader: Calling authStore signOut...')
      await signOut()
      
      console.log('ChatHeader: Sign out completed')
      
    } catch (error) {
      console.error('ChatHeader: Sign out error:', error)
      
      // Force redirect even if sign out fails
      console.log('ChatHeader: Forcing redirect due to error')
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    } finally {
      // Reset state in case something goes wrong
      setTimeout(() => {
        setIsSigningOut(false)
      }, 500)
    }
  }

  return (
    <header className="px-4 md:px-6 py-4 transition-all duration-300">
      <div className="flex items-center justify-between">
        {/* Left side - Mobile menu + Logo */}
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          <button
            onClick={toggleSidebar}
            className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Toggle menu"
          >
            <Menu size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
          
          {/* Professional Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-teal-400 to-teal-500 rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">AffectLearn</h1>
              {currentSession && (
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 truncate max-w-48 md:max-w-80">
                  {currentSession.title}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Professional Controls */}
        <div className="flex items-center gap-2">
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? (
              <Sun size={16} className="text-yellow-500" />
            ) : (
              <Moon size={16} className="text-gray-600 dark:text-gray-300" />
            )}
          </button>

          {/* Language Selector */}
          <div className="relative" ref={languageMenuRef}>
            <button
              onClick={() => setShowLanguageMenu(!showLanguageMenu)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
            >
              <Globe size={16} className="text-blue-500" />
              <span className="hidden md:inline">
                {languages.find(l => l.code === language)?.name || 'English'}
              </span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${showLanguageMenu ? 'rotate-180' : ''}`} />
            </button>

            {showLanguageMenu && (
              <div className="absolute right-0 top-full mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-40 z-50">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLanguage(lang.code)
                      setShowLanguageMenu(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                      language === lang.code 
                        ? 'text-blue-500 font-medium' 
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Professional User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
            >
              <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <User size={14} className="text-white" />
              </div>
              <span className="hidden md:inline text-sm font-medium max-w-24 truncate">
                {user?.email?.split('@')[0] || 'User'}
              </span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-48 z-[9999]">
                <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Signed in as</p>
                  <p className="text-sm text-gray-900 dark:text-white truncate font-medium">{user?.email}</p>
                </div>
                
                <button
                  type="button"
                  onClick={handleAnalyticsClick}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 cursor-pointer select-none"
                  style={{ pointerEvents: 'auto' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span>Learning Analytics</span>
                </button>
                
                <button
                  type="button"
                  onClick={handleSignOutClick}
                  disabled={isSigningOut}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none"
                  style={{ pointerEvents: 'auto' }}
                >
                  <LogOut size={14} />
                  <span>{isSigningOut ? 'Signing out...' : 'Sign Out'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
