'use client'

import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { apiService } from '../lib/api'

interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  audioUrl?: string
  ttsTimings?: Array<{ start: number; end: number; text: string }>
  sentiment?: string
  query_id?: string  // Adding explicit query_id field for better tracking
  main_response?: string
  simplified_response?: string
  detailed_response?: string  // Groq detailed response for voice explanations
  tinyllama_response?: string // TinyLlama response
  image_data?: {
    image_url: string | null
    image_type: string | null
    svg_code: string | null
    explanations: Array<{
      text: string
      pdf_name: string
      page_num: number
    }>
  }
}

interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: Date
}

interface ChatState {
  currentSession: ChatSession | null
  sessions: ChatSession[]
  language: string
  isVoiceSidebarOpen: boolean
  isImageSidebarOpen: boolean
  isSidebarMinimized: boolean
  currentPlayingAudio: string | null
  isCreatingSession: boolean // Add flag to prevent infinite loops
  
  // Actions
  setCurrentSession: (session: ChatSession) => void
  addMessage: (message: ChatMessage) => void
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void
  createNewSession: () => void
  setLanguage: (language: string) => void
  toggleVoiceSidebar: () => void
  toggleImageSidebar: () => void
  toggleSidebar: () => void
  setCurrentPlayingAudio: (audioUrl: string | null) => void
  loadSessions: (sessions: ChatSession[]) => void
  loadChatHistory: () => Promise<void>
  updateSessionTitle: (sessionId: string, title: string) => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
  loadChatMessages: (chatId: string) => Promise<void>
}

export const useChatStore = create<ChatState>((set, get) => ({
  currentSession: null,
  sessions: [],
  language: 'en',
  isVoiceSidebarOpen: false,
  isImageSidebarOpen: false,
  isSidebarMinimized: typeof window !== 'undefined' ? localStorage.getItem('sidebarMinimized') === 'true' : false,
  currentPlayingAudio: null,
  isCreatingSession: false,

  setCurrentSession: (session) => set({ currentSession: session }),

  addMessage: (message) => {
    const { currentSession } = get()
    if (!currentSession) return
    
    // Check for duplicate messages to prevent adding the same message twice
    // This can happen if there are multiple submission paths
    const isDuplicate = currentSession.messages.some(
      msg => msg.id === message.id || 
            (msg.content === message.content && 
             msg.type === message.type && 
             Math.abs((msg.timestamp as Date).getTime() - (message.timestamp as Date).getTime()) < 1000)
    )
    
    if (isDuplicate) {
      console.log('Skipping duplicate message:', message)
      return
    }

    const updatedSession = {
      ...currentSession,
      messages: [...currentSession.messages, message]
    }

    set({ 
      currentSession: updatedSession,
      sessions: get().sessions.map(s => 
        s.id === currentSession.id ? updatedSession : s
      )
    })

    // Send to backend if it's a user message and doesn't already have query_id (avoid double processing audio messages)
    if (message.type === 'user' && message.content.trim() && !message.query_id) {
      const sendToBackend = async () => {
        try {
          // Update the user message with the query_id if it comes back from the backend
          const response = await apiService.sendTextMessage(
            message.content, 
            currentSession.id, 
            get().language
          )
          console.log('Message sent to backend:', response)
          
          // Update user message with sentiment and query_id if available
          if (response?.query_id) {
            const updatedUserMsg = {
              ...message,
              id: response.query_id, // Update the message ID with backend ID
              sentiment: response.sentiment_label
            };
            
            // Update the existing message with the backend ID
            get().updateMessage(message.id, updatedUserMsg);
            
            // Auto-update title for new chats
            if (currentSession.title === 'New Chat' && currentSession.messages.length === 1) {
              const title = message.content.length > 50 
                ? message.content.substring(0, 50) + '...' 
                : message.content
              try {
                await get().updateSessionTitle(currentSession.id, title)
              } catch (error) {
                console.error('Failed to auto-update title:', error)
              }
            }
            
            try {
              const askResponse = await apiService.askQuestion(
                message.content,
                currentSession.id,
                currentSession.id, // Use session_id as chat_id for now
                response.sentiment_label || 'NEUTRAL',
                response.sentiment_score || 0.0,
                'text',
                get().language
              )
              console.log('Got response from backend:', askResponse)
              
              // Add assistant response message
              if (askResponse?.main_response) {
                // Process markdown in the responses to clean up excessive whitespace
                // while preserving the markdown formatting (like ** for bold)
                const cleanMarkdown = (text: string) => {
                  if (!text) return '';
                  return text
                    .replace(/\n\n\n+/g, '\n\n') // Replace 3+ consecutive newlines with just 2
                    .trim();
                };
                
                const assistantMessage = {
                  id: askResponse.query_id || uuidv4(), // Use backend query_id as id
                  query_id: askResponse.query_id, // Also store query_id explicitly 
                  type: 'assistant' as const,
                  content: cleanMarkdown(askResponse.simplified_response || askResponse.main_response),
                  timestamp: new Date(),
                  sentiment: askResponse.sentiment_label,
                  // Store the cleaned markdown responses
                  main_response: cleanMarkdown(askResponse.main_response),
                  simplified_response: askResponse.simplified_response ? cleanMarkdown(askResponse.simplified_response) : undefined,
                  detailed_response: askResponse.detailed_response ? cleanMarkdown(askResponse.detailed_response) : undefined,
                  tinyllama_response: askResponse.tinyllama_response ? cleanMarkdown(askResponse.tinyllama_response) : undefined,
                  // Store image data from backend
                  image_data: askResponse.image_data
                }
                
                // Add the assistant message
                get().addMessage(assistantMessage)
              }
            } catch (askError) {
              console.error('Failed to get response from backend:', askError)
            }
          }
        } catch (error) {
          console.error('Failed to send message to backend:', error)
        }
      }
      sendToBackend()
    }
  },

  updateMessage: (messageId, updates) => {
    const { currentSession } = get()
    if (!currentSession) return

    const updatedSession = {
      ...currentSession,
      messages: currentSession.messages.map(msg =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      )
    }

    set({ 
      currentSession: updatedSession,
      sessions: get().sessions.map(s => 
        s.id === currentSession.id ? updatedSession : s
      )
    })
  },

  createNewSession: () => {
    const { isCreatingSession } = get()
    if (isCreatingSession) {
      console.log('Session creation already in progress, skipping...')
      return
    }
    
    set({ isCreatingSession: true })
    
    const newSession = {
      id: uuidv4(),
      title: 'New Chat',
      messages: [],
      createdAt: new Date(),
    }
    set((state) => ({
      sessions: [newSession, ...state.sessions],
      currentSession: newSession,
    }))
    
    // Call backend to create session in database (but don't await to avoid blocking)
    console.log('Creating new session in database...')
    
    // Note: We use a separate async function to avoid blocking the UI
    const createSessionInDB = async () => {
      try {
        console.log('Calling backend to create session...')
        const response = await apiService.createSession('placeholder')
        console.log('Session created in database:', response)
        
        // Update the session with the backend ID if needed
        if (response?.session_id) {
          set((state) => ({
            currentSession: state.currentSession ? {
              ...state.currentSession,
              id: response.session_id // Use backend session ID
            } : null,
            sessions: state.sessions.map(s => 
              s.id === newSession.id ? { ...s, id: response.session_id } : s
            )
          }))
        }
      } catch (error) {
        console.error('Failed to create session in database:', error)
        // Session will still work locally even if backend fails
      } finally {
        set({ isCreatingSession: false })
      }
    }
    
    // Only create in DB if we have a valid session
    if (newSession.id) {
      createSessionInDB()
    } else {
      set({ isCreatingSession: false })
    }
  },

  setLanguage: (language) => set({ language }),

  toggleVoiceSidebar: () => set({ 
    isVoiceSidebarOpen: !get().isVoiceSidebarOpen,
    isImageSidebarOpen: false // Close image sidebar when opening voice
  }),

  toggleImageSidebar: () => set({ 
    isImageSidebarOpen: !get().isImageSidebarOpen,
    isVoiceSidebarOpen: false // Close voice sidebar when opening image
  }),

  toggleSidebar: () => {
    const newMinimized = !get().isSidebarMinimized
    set({ isSidebarMinimized: newMinimized })
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarMinimized', newMinimized.toString())
    }
  },

  setCurrentPlayingAudio: (audioUrl) => set({ currentPlayingAudio: audioUrl }),

  loadSessions: (sessions) => set({ sessions }),

  loadChatHistory: async () => {
    try {
      console.log('Loading chat history...')
      const response = await apiService.getChatHistory()
      if (response?.chats) {
        const sessions: ChatSession[] = response.chats.map((chat: any) => ({
          id: chat.id,
          title: chat.title,
          messages: [], // Messages will be loaded when session is selected
          createdAt: new Date(chat.created_at)
        }))
        set({ sessions })
        console.log(`Loaded ${sessions.length} chat sessions`)
      } else {
        console.log('No chats found in response')
        set({ sessions: [] })
      }
    } catch (error: any) {
      console.error('Failed to load chat history:', error)
      
      // Handle different types of errors
      if (error.response?.status === 401) {
        console.log('Authentication error - user might need to re-login')
        // Don't throw error for auth issues, just set empty sessions
        set({ sessions: [] })
      } else if (error.response?.status === 403) {
        console.log('Permission denied - user might not have access')
        set({ sessions: [] })
      } else if (error.response?.status >= 500) {
        console.log('Server error - backend might be down')
        set({ sessions: [] })
      } else {
        // For other errors, still set empty sessions to prevent infinite loading
        set({ sessions: [] })
      }
    }
  },

  updateSessionTitle: async (sessionId: string, title: string) => {
    try {
      await apiService.updateChatTitle(sessionId, title)
      
      // Update the session in the store
      const { sessions, currentSession } = get()
      const updatedSessions = sessions.map(session => 
        session.id === sessionId ? { ...session, title } : session
      )
      
      set({ 
        sessions: updatedSessions,
        currentSession: currentSession?.id === sessionId 
          ? { ...currentSession, title }
          : currentSession
      })
    } catch (error) {
      console.error('Failed to update session title:', error)
      throw error
    }
  },

  deleteSession: async (sessionId: string) => {
    try {
      await apiService.deleteChat(sessionId)
      
      // Remove the session from the store
      const { sessions, currentSession } = get()
      const updatedSessions = sessions.filter(session => session.id !== sessionId)
      
      set({ 
        sessions: updatedSessions,
        currentSession: currentSession?.id === sessionId ? null : currentSession
      })
    } catch (error) {
      console.error('Failed to delete session:', error)
      throw error
    }
  },

  loadChatMessages: async (chatId: string) => {
    try {
      const response = await apiService.getChat(chatId)
      if (response) {
        const session: ChatSession = {
          id: response.id,
          title: response.title,
          messages: response.messages.map((msg: any) => ({
            id: msg.id,
            type: msg.type,
            content: msg.content,
            timestamp: new Date(msg.timestamp),
            sentiment: msg.sentiment,
            query_id: msg.query_id,
            main_response: msg.main_response,
            simplified_response: msg.simplified_response,
            detailed_response: msg.detailed_response,
            tinyllama_response: msg.tinyllama_response
          })),
          createdAt: new Date(response.created_at)
        }
        
        // Update the session in the sessions list and set as current
        const { sessions } = get()
        const updatedSessions = sessions.map(s => 
          s.id === chatId ? session : s
        )
        
        set({ 
          sessions: updatedSessions,
          currentSession: session
        })
      }
    } catch (error) {
      console.error('Failed to load chat messages:', error)
      throw error
    }
  }
}))
