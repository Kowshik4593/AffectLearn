'use client'

import { useState, useRef } from 'react'
import { useChatStore } from '../../store/chatStore'
import { useAuthStore } from '../../store/authStore'
import { AudioRecorder } from '../../lib/recorder'
import { apiService } from '../../lib/api'
import { Send, Mic, MicOff, Upload, FileText, Image as ImageIcon, Loader2 } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'

export default function ChatInput() {
  const [message, setMessage] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<AudioRecorder | null>(null)

  const { currentSession, addMessage, language } = useChatStore()
  const { user } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || !currentSession || !user) return

    // The addMessage function in chatStore will handle the API calls
    // so we don't need to duplicate that logic here
    const userMessage = {
      id: uuidv4(), // Use UUID instead of timestamp
      type: 'user' as const,
      content: message.trim(),
      timestamp: new Date()
    }

    // Add user message to the store - the store will handle API calls
    addMessage(userMessage)
    setMessage('')
    setIsLoading(true)
    
    // Set loading to false after a reasonable delay
    // This is a simple way to handle the async nature of the API calls
    setTimeout(() => {
      setIsLoading(false)
    }, 3000)
  }

  const handleStartRecording = async () => {
    try {
      recorderRef.current = new AudioRecorder()
      await recorderRef.current.startRecording()
      setIsRecording(true)
    } catch (error) {
      console.error('Error starting recording:', error)
      alert('Could not access microphone. Please check permissions.')
    }
  }

  const handleStopRecording = async () => {
    if (!recorderRef.current || !currentSession || !user) return

    try {
      setIsLoading(true)
      const audioBlob = await recorderRef.current.stopRecording()
      setIsRecording(false)

      try {
        // Send audio directly to backend and get transcription
        const audioResponse = await apiService.sendAudioMessage(audioBlob, currentSession.id, language)
        
        // Add the actual transcribed message to chat
        const userMessage = {
          id: audioResponse.query_id || uuidv4(),
          type: 'user' as const,
          content: audioResponse.transcript || 'Audio message',
          timestamp: new Date(),
          audioUrl: audioResponse.input_audio_path,
          sentiment: audioResponse.sentiment_label,
          query_id: audioResponse.query_id
        }
        addMessage(userMessage)

        // Add the assistant response if available
        if (audioResponse.groq_response_simplified || audioResponse.groq_response_main) {
          const assistantMessage = {
            id: uuidv4(),
            type: 'assistant' as const,
            content: audioResponse.groq_response_simplified || audioResponse.groq_response_main || 'No response available',
            timestamp: new Date(),
            main_response: audioResponse.groq_response_main,
            simplified_response: audioResponse.groq_response_simplified
          }
          addMessage(assistantMessage)
        }
        
      } catch (err) {
        console.error('Failed to send audio:', err)
        alert('Failed to send audio message.')
      }
      setIsLoading(false)
    } catch (error) {
      console.error('Error processing audio:', error)
      setIsRecording(false)
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (file: File, type: 'pdf' | 'image') => {
    if (!currentSession || !user) return

    setIsLoading(true)

    try {
      // Add file upload message
      const userMessage = {
        id: uuidv4(),
        type: 'user' as const,
        content: `Uploading ${type.toUpperCase()}: ${file.name}`,
        timestamp: new Date()
      }

      addMessage(userMessage)
      
      // Let the store handle API calls
      // Set loading to false after a delay
      setTimeout(() => {
        setIsLoading(false)
      }, 3000)
    } catch (error) {
      console.error('Error processing file:', error)
      setIsLoading(false)
    }
  }

  return (
    <div className="p-4 bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="flex items-end gap-3">
          {/* File Upload Buttons */}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileUpload(file, 'pdf')
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 text-gray-600 dark:text-gray-300"
              title="Upload PDF"
            >
              <FileText size={20} />
            </button>

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileUpload(file, 'image')
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={isLoading}
              className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 text-gray-600 dark:text-gray-300"
              title="Upload Image"
            >
              <ImageIcon size={20} />
            </button>
          </div>

          {/* Text Input */}
          <div className="flex-1 relative">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask me anything about STEM subjects..."
              className="w-full resize-none min-h-[48px] max-h-32 px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              disabled={isLoading || isRecording}
            />
          </div>

          {/* Voice Button */}
          <button
            type="button"
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            disabled={isLoading}
            className={`p-3 rounded-lg transition-all disabled:opacity-50 ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300'
            }`}
            title={isRecording ? 'Stop Recording' : 'Start Recording'}
          >
            {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!message.trim() || isLoading || isRecording}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white p-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </form>

        {/* Recording indicator */}
        {isRecording && (
          <div className="mt-2 flex items-center justify-center gap-2 text-red-600 dark:text-red-400 text-sm">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            Recording... Click the microphone to stop
          </div>
        )}
      </div>
    </div>
  )
}
