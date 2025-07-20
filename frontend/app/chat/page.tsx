'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '../../store/authStore'
import { useChatStore } from '../../store/chatStore'
import ChatHeader from '../../components/Chat/ChatHeader'
import ChatSidebar from '../../components/Chat/ChatSidebar'
import ChatArea from '../../components/Chat/ChatArea'
import VoiceSidebar from '../../components/Chat/VoiceSidebar'
import ImageSidebar from '../../components/Chat/ImageSidebar'
import { apiService } from '../../lib/api'

export default function ChatPage() {
  const router = useRouter()
  const { user, loading, initialize, ensureUserRecord } = useAuthStore()
  const { isVoiceSidebarOpen, isImageSidebarOpen, createNewSession, currentSession, isSidebarMinimized } = useChatStore()
  const [isLoading, setIsLoading] = useState(true)
  const [isCreatingSession, setIsCreatingSession] = useState(false)

  useEffect(() => {
    initialize()
  }, []) // Remove initialize from dependencies

  useEffect(() => {
    console.log('ChatPage: Auth state changed:', { user: !!user, loading, currentSession: !!currentSession })
    
    if (loading) {
      return // Still loading, wait
    }
    
    if (!user) {
      console.log('ChatPage: No user, redirecting to login')
      router.push('/login')
      return
    }
    
    if (!currentSession && !isCreatingSession) {
      console.log('ChatPage: User exists but no session, creating session...')
      setIsCreatingSession(true)
      // Just create session, user record should already exist from auth flow
      createNewSession()
      // Reset the flag after a delay to allow the session to be created
      setTimeout(() => setIsCreatingSession(false), 1000)
    }
    
    setIsLoading(false)
  }, [user, loading, currentSession, isCreatingSession]) // Add isCreatingSession to dependencies

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center transition-colors duration-700">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-teal-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300 text-lg">Loading your learning environment...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect to login
  }

  return (
    <div className="h-screen flex overflow-hidden bg-white dark:bg-gray-900">
      {/* Professional background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-blue-50/20 to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900" />
      
      {/* Mobile overlay for sidebar */}
      {!isSidebarMinimized && (
        <div 
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => {/* Will be handled by sidebar */}}
        />
      )}
      
      {/* Professional sidebar */}
      <div className="relative z-40">
        <ChatSidebar />
      </div>
      
      {/* Main content area */}
      <div className="flex-1 flex flex-col relative z-10 min-w-0">
        {/* Header */}
        <div className="flex-shrink-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
          <ChatHeader />
        </div>
        
        {/* Chat content area */}
        <div className="flex-1 flex relative overflow-hidden min-h-0">
          <div className="flex-1 relative">
            {/* Quiz Generator Button - Top Left Corner */}
            <div className="absolute top-4 left-4 z-50">
              <button
                onClick={() => {
                  // Always use the fixed session ID
                  const fixedSessionId = "aaab3eb6-af0c-4779-bde4-8c279a677f55"
                  const quizUrl = `/quiz?sessionId=${fixedSessionId}`
                  window.open(quizUrl, '_blank')
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white rounded-lg shadow-lg transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2"
                title="Open Quiz Generator in new tab"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span className="text-sm font-medium">Quiz Generator</span>
              </button>
            </div>
            <ChatArea />
          </div>
          
          {/* Voice and Image sidebars with responsive design */}
          <div className={`transition-all duration-300 ${(isVoiceSidebarOpen || isImageSidebarOpen) ? 'w-80 lg:w-96' : 'w-0'} overflow-hidden`}>
            {isVoiceSidebarOpen && (
              <VoiceSidebar 
                isOpen={isVoiceSidebarOpen}
              />
            )}
            {isImageSidebarOpen && (
              <ImageSidebar 
                isOpen={isImageSidebarOpen}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
