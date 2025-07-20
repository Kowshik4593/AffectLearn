'use client'

import { useChatStore } from '../../store/chatStore'
import { Plus, MessageSquare, Clock, ChevronLeft, ChevronRight, Edit3, Trash2, Check, X } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function ChatSidebar() {
  const { 
    sessions, 
    currentSession, 
    setCurrentSession, 
    createNewSession, 
    isSidebarMinimized, 
    toggleSidebar,
    loadChatHistory,
    updateSessionTitle,
    deleteSession,
    loadChatMessages
  } = useChatStore()
  
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  // Load chat history on component mount
  useEffect(() => {
    loadChatHistory()
  }, [])

  const formatDate = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return date.toLocaleDateString()
  }

  const startEditingTitle = (session: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingSessionId(session.id)
    setEditTitle(session.title)
  }

  const saveTitle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (editingSessionId && editTitle.trim()) {
      try {
        await updateSessionTitle(editingSessionId, editTitle.trim())
        setEditingSessionId(null)
        setEditTitle('')
      } catch (error) {
        console.error('Failed to update title:', error)
      }
    }
  }

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingSessionId(null)
    setEditTitle('')
  }

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this chat?')) {
      try {
        await deleteSession(sessionId)
      } catch (error) {
        console.error('Failed to delete session:', error)
      }
    }
  }

  const handleSessionSelect = async (session: any) => {
    try {
      // Load messages for this chat
      await loadChatMessages(session.id)
    } catch (error) {
      console.error('Failed to load chat messages:', error)
      // Still set the session even if messages fail to load
      setCurrentSession(session)
    }
  }

  return (
    <aside className={`${isSidebarMinimized ? 'w-16' : 'w-72 lg:w-80'} bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300`}>
      {/* Header with minimize button */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          {!isSidebarMinimized && (
            <h2 className="text-gray-900 dark:text-white font-semibold">Chats</h2>
          )}
          <button
            onClick={toggleSidebar}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            title={isSidebarMinimized ? "Expand sidebar" : "Minimize sidebar"}
          >
            {isSidebarMinimized ? (
              <ChevronRight size={18} className="text-gray-500 dark:text-gray-400" />
            ) : (
              <ChevronLeft size={18} className="text-gray-500 dark:text-gray-400" />
            )}
          </button>
        </div>
        
        {!isSidebarMinimized && (
          <button
            onClick={createNewSession}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-3 justify-center px-4 py-2 rounded-lg transition-colors font-medium"
          >
            <Plus size={20} />
            <span className="font-medium">New Chat</span>
          </button>
        )}
        
        {isSidebarMinimized && (
          <button
            onClick={createNewSession}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-lg transition-colors"
            title="New Chat"
          >
            <Plus size={20} className="mx-auto" />
          </button>
        )}
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          {sessions.length === 0 ? (
            <div className={`p-4 text-center text-gray-500 dark:text-gray-400 ${isSidebarMinimized ? 'hidden' : ''}`}>
              <MessageSquare size={24} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">Start a new chat to begin</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`mb-2 group relative`}
              >
                <button
                  onClick={() => handleSessionSelect(session)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    currentSession?.id === session.id 
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className={`flex items-start gap-3 ${isSidebarMinimized ? 'justify-center' : ''}`}>
                    <MessageSquare size={18} className="text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                    {!isSidebarMinimized && (
                      <div className="flex-1 min-w-0">
                        {editingSessionId === session.id ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="w-full px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveTitle(e as any)
                                if (e.key === 'Escape') cancelEdit(e as any)
                              }}
                            />
                            <button
                              onClick={saveTitle}
                              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-green-600 dark:text-green-400"
                              title="Save"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-red-600 dark:text-red-400"
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between">
                              <h3 className="text-gray-900 dark:text-white text-sm font-medium truncate pr-2">
                                {session.title}
                              </h3>
                              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                                <button
                                  onClick={(e) => startEditingTitle(session, e)}
                                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white"
                                  title="Edit title"
                                >
                                  <Edit3 size={12} />
                                </button>
                                <button
                                  onClick={(e) => handleDeleteSession(session.id, e)}
                                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-500 dark:text-gray-400 hover:text-red-500"
                                  title="Delete chat"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                              <Clock size={12} className="text-gray-500 dark:text-gray-500" />
                              <span className="text-xs text-gray-500 dark:text-gray-500">
                                {formatDate(session.createdAt)}
                              </span>
                            </div>
                            {session.messages.length > 0 && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
                                {session.messages[session.messages.length - 1].content}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      {!isSidebarMinimized && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            <p>AffectLearn</p>
            <p className="mt-1">AI-Powered Learning</p>
          </div>
        </div>
      )}
    </aside>
  )
}
