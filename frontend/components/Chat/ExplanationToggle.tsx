'use client'

import { useChatStore } from '../../store/chatStore'
import { Volume2, Image, X } from 'lucide-react'

export default function ExplanationToggle() {
  const { 
    isVoiceSidebarOpen, 
    isImageSidebarOpen, 
    toggleVoiceSidebar, 
    toggleImageSidebar 
  } = useChatStore()

  const isAnyOpen = isVoiceSidebarOpen || isImageSidebarOpen

  const handleVoiceToggle = () => {
    toggleVoiceSidebar()
  }

  const handleImageToggle = () => {
    toggleImageSidebar()
  }

  const handleClose = () => {
    if (isVoiceSidebarOpen) toggleVoiceSidebar()
    if (isImageSidebarOpen) toggleImageSidebar()
  }

  return (
    <div className="flex items-center space-x-2">
      {/* Toggle buttons */}
      <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        <button
          onClick={handleVoiceToggle}
          className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
            isVoiceSidebarOpen
              ? 'bg-white dark:bg-gray-700 text-teal-600 dark:text-teal-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400'
          }`}
        >
          <Volume2 className="w-4 h-4" />
          <span className="hidden sm:inline">Voice</span>
        </button>
        
        <button
          onClick={handleImageToggle}
          className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
            isImageSidebarOpen
              ? 'bg-white dark:bg-gray-700 text-teal-600 dark:text-teal-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400'
          }`}
        >
          <Image className="w-4 h-4" />
          <span className="hidden sm:inline">Visual</span>
        </button>
      </div>

      {/* Close button when any sidebar is open */}
      {isAnyOpen && (
        <button
          onClick={handleClose}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
