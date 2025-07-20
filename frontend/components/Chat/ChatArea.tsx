'use client'

import { useChatStore } from '../../store/chatStore'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import { useEffect, useRef } from 'react'
import { Brain } from 'lucide-react'

export default function ChatArea() {
  const { currentSession } = useChatStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      // Force scroll to bottom with a more aggressive approach
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end',
      })
      
      // As a backup, also scroll the parent container
      const chatContainer = document.querySelector('.overflow-y-auto')
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight
      }
    }
  }

  // Improved scrolling effect with a small delay to ensure DOM is updated
  useEffect(() => {
    // Scroll immediately
    scrollToBottom()
    // And again after a small delay to ensure any async rendering is complete
    const timeoutId = setTimeout(() => {
      scrollToBottom()
    }, 100)
    
    return () => clearTimeout(timeoutId)
  }, [currentSession?.messages])

  if (!currentSession) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center max-w-2xl mx-auto">
          {/* Professional logo */}
          <div className="w-16 h-16 bg-gradient-to-r from-teal-400 to-teal-500 rounded-2xl flex items-center justify-center mb-6 mx-auto">
            <Brain className="w-8 h-8 text-white" />
          </div>
          
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Start Your Conversation
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
            Type a message or record your voice to begin your personalized learning experience!
          </p>
          
          {/* Professional feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md transition-all cursor-default group">
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-200">💬</div>
              <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">Smart Conversations</h3>
              <p className="text-gray-600 dark:text-gray-300">Ask questions in text or voice with intelligent context understanding</p>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md transition-all cursor-default group">
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-200">🎧</div>
              <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">Emotion-Aware Audio</h3>
              <p className="text-gray-600 dark:text-gray-300">Get voice explanations that adapt to your emotional state</p>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md transition-all cursor-default group">
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-200">📄</div>
              <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">Multi-Modal Learning</h3>
              <p className="text-gray-600 dark:text-gray-300">Upload PDFs and images for comprehensive analysis</p>
            </div>
          </div>
          
          {/* Call to action */}
          <div className="mt-8">
            <div className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors">
              Start Your Learning Journey
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Debug: Print messages to console
  console.log("Chat messages:", currentSession.messages);

  return (
    <div className="h-full flex flex-col">
      {/* Messages Area with proper scrolling */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {currentSession.messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-teal-400 to-teal-500 rounded-xl mx-auto flex items-center justify-center mb-6">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Start Your Conversation</h3>
                <p className="text-gray-600 dark:text-gray-300">Type a message or record your voice to begin your personalized learning experience!</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {currentSession.messages.map((message, index) => {
                const key = `${message.id}-${index}`;
                return (
                  <div 
                    key={key} 
                    className="opacity-0 animate-fade-in"
                    style={{ animationDelay: `${index * 0.05}s`, animationFillMode: 'forwards' }}
                  >
                    <ChatMessage message={message} />
                  </div>
                );
              })}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area - Fixed at bottom */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
        <ChatInput />
      </div>
    </div>
  )
}
