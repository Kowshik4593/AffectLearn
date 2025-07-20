import axios from 'axios'
import { supabase } from './supabase'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
})

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`
      console.log('Sending access token:', session.access_token.substring(0, 50) + '...') // Debug log (truncated)
      console.log('Token info:', {
        hasUser: !!session.user,
        userId: session.user?.id,
        email: session.user?.email
      })
    } else {
      console.log('No access token found in session')
    }
  } catch (error) {
    console.error('Error getting auth session:', error)
  }
  return config
})

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('Unauthorized - redirecting to login')
      // You might want to redirect to login page here
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Helper function to get current session token
export const getCurrentUserToken = async (): Promise<string | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  } catch (error) {
    console.error('Error getting user token:', error)
    return null
  }
}

// API functions
export const apiService = {
  // User management endpoints
  getUserProfile: async () => {
    const response = await api.get('/user/profile/')
    return response.data
  },

  createUser: async (email: string) => {
    const response = await api.post('/create_user/', { email })
    return response.data
  },

  // Auth endpoints
  createSession: async (userId: string) => {
    const response = await api.post('/new_chat/', { user_id: userId })
    return response.data
  },

  // Chat endpoints
  sendTextMessage: async (message: string, sessionId: string, language: string = 'en') => {
    const response = await api.post('/text_to_sentiment/', {
      text: message,
      session_id: sessionId,
      language
    })
    return response.data
  },

  askQuestion: async (queryText: string, sessionId: string, chatId: string, sentimentLabel: string, sentimentScore: number, inputType: string = 'text', language: string = 'en', transcript?: string) => {
    const response = await api.post('/ask/', {
      query_text: queryText,
      session_id: sessionId,
      chat_id: chatId,
      sentiment_label: sentimentLabel,
      sentiment_score: sentimentScore,
      input_type: inputType,
      transcript: transcript,
      language: language
    })
    return response.data
  },

  // Audio endpoints
  sendAudioMessage: async (audioBlob: Blob, sessionId: string, language: string = 'en') => {
    const formData = new FormData()
    formData.append('file', audioBlob, 'audio.webm')
    // Don't send session_id since we're using standalone queries
    formData.append('language', language)

    const response = await api.post('/audio_to_sentiment/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  generateVoice: async (text: string, language: string = 'en-US', voiceName: string = 'en-US-Wavenet-D', sessionId?: string, queryId?: string, chatId?: string) => {
    // Use the test endpoint for now to avoid authentication issues
    const response = await api.post('/voice/generate-test', {
      text: text,
      language_code: language,
      voice_name: voiceName,
      session_id: sessionId,
      query_id: queryId,
      chat_id: chatId
    })
    return response.data
  },

  // Get audio by query ID
  getAudioByQueryId: async (queryId: string, sessionId?: string) => {
    const params = new URLSearchParams({ query_id: queryId })
    if (sessionId) {
      params.append('session_id', sessionId)
    }
    const response = await api.get(`/voice/audio?${params}`)
    return response.data
  },

  // File upload endpoints
  uploadPDF: async (file: File, sessionId: string) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('session_id', sessionId)

    const response = await api.post('/parse_pdf/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  uploadImage: async (file: File, sessionId: string) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('session_id', sessionId)

    const response = await api.post('/parse_image/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  // Chat history
  getChatHistory: async () => {
    const response = await api.get('/chats/')
    return response.data
  },

  getChat: async (chatId: string) => {
    const response = await api.get(`/chat/${chatId}`)
    return response.data
  },

  updateChatTitle: async (chatId: string, title: string) => {
    const response = await api.put(`/chat/${chatId}/title`, { title })
    return response.data
  },

  deleteChat: async (chatId: string) => {
    const response = await api.delete(`/chat/${chatId}`)
    return response.data
  },

  // Voice explanation endpoint
  getVoiceExplanation: async (queryText: string, sessionId: string, sentimentLabel: string = 'NEUTRAL', sentimentScore: number = 0, inputType: string = 'text') => {
    const response = await api.post('/ask/voice-explanation', {
      query_text: queryText,
      session_id: sessionId,
      chat_id: sessionId,
      sentiment_label: sentimentLabel,
      sentiment_score: sentimentScore,
      input_type: inputType,
      language: 'en'
    })
    return response.data
  },
}
