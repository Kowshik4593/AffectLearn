'use client'

import { Volume2, Star, Copy, ThumbsUp, ThumbsDown, BookOpen, BookA } from 'lucide-react'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ExplanationToggle from './ExplanationToggle'

interface ChatMessageProps {
  message: {
    id: string
    type: 'user' | 'assistant'
    content: string
    timestamp: Date
    audioUrl?: string
    ttsTimings?: Array<{ start: number; end: number; text: string }>
    sentiment?: string
    query_id?: string  // Adding query_id for consistency with store
    main_response?: string
    simplified_response?: string
    detailed_response?: string  // Groq detailed response for voice explanations
    tinyllama_response?: string // TinyLlama response
  }
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const [copied, setCopied] = useState(false)
  const [showDetailed, setShowDetailed] = useState(false) // Default to simple view
  
  // Check if we have both simple and detailed responses
  const hasDetailedResponse = message.detailed_response && 
    message.detailed_response !== message.main_response &&
    message.detailed_response !== message.simplified_response

  const handleCopy = async () => {
    const textToCopy = showDetailed && message.detailed_response 
      ? message.detailed_response 
      : message.main_response || message.simplified_response || message.content
      
    await navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return 'text-green-400'
      case 'negative': return 'text-red-400'
      case 'neutral': return 'text-gray-400'
      default: return 'text-gray-400'
    }
  }

  return (
    <div className={`flex gap-4 ${message.type === 'user' ? 'flex-row-reverse' : ''}`}>
      {/* Professional Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        message.type === 'user' 
          ? 'bg-gradient-primary text-white' 
          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
      }`}>
        {message.type === 'user' ? (
          <span className="text-sm font-medium">U</span>
        ) : (
          <span className="text-sm font-medium">AI</span>
        )}
      </div>

      {/* Message Content */}
      <div className={`flex-1 max-w-3xl ${message.type === 'user' ? 'text-right' : ''}`}>
        <div className={`message-bubble ${message.type}`}>
          <div className="text-sm leading-relaxed">
            {/* Display markdown-formatted content based on toggle if detailed response exists */}
            {(() => {
              const contentToRender = message.type === 'assistant' && hasDetailedResponse 
                ? (showDetailed ? message.detailed_response : message.main_response || message.simplified_response) || ''
                : (message.main_response || message.simplified_response || message.content) || '';
                
              if (!contentToRender) {
                return <p className="text-slate-400 italic">No content available</p>;
              }
              
              // Process text to reduce excessive newlines before rendering and fix common formatting issues
              const processedContent = contentToRender
                .replace(/\n\n\n+/g, '\n\n') // Replace 3+ consecutive newlines with just 2
                .replace(/\*\*([^*]+)\*\*/g, (match, p1) => `**${p1.trim()}**`) // Fix spacing in bold text
                .trim();
              
              return (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // Customize paragraph spacing
                    p: ({node, ...props}) => <p className="mb-2" {...props} />,
                    // Customize heading spacing
                    h1: ({node, ...props}) => <h1 className="mb-2 mt-3" {...props} />,
                    h2: ({node, ...props}) => <h2 className="mb-2 mt-3" {...props} />,
                    h3: ({node, ...props}) => <h3 className="mb-2 mt-3" {...props} />,
                    // Customize list spacing
                    ul: ({node, ...props}) => <ul className="mb-3 mt-1" {...props} />,
                    ol: ({node, ...props}) => <ol className="mb-3 mt-1" {...props} />,
                    // Customize list item spacing
                    li: ({node, ...props}) => <li className="mb-1" {...props} />
                  }}
                >
                  {processedContent}
                </ReactMarkdown>
              );
            })()}
          </div>
          {/* Sentiment indicator for user messages */}
          {message.type === 'user' && message.sentiment && (
            <div className="mt-2 pt-2 border-t border-white/20">
              <span className={`text-xs ${getSentimentColor(message.sentiment)}`}>
                Sentiment: {message.sentiment}
              </span>
            </div>
          )}
        </div>

        {/* Professional Message Actions */}
        <div className={`flex items-center gap-2 mt-2 text-xs text-slate-500 dark:text-slate-400 ${
          message.type === 'user' ? 'justify-end' : ''
        }`}>
          <span>{formatTime(message.timestamp)}</span>
          
          {message.type === 'assistant' && (
            <div className="flex items-center gap-2 ml-2">
              <ExplanationToggle />
              
              <button
                onClick={handleCopy}
                className="btn-secondary text-xs px-2 py-1 flex items-center gap-1"
                title="Copy message"
              >
                <Copy size={12} />
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
              
              {/* Toggle for simple/detailed view if detailed response is available */}
              {hasDetailedResponse && (
                <button
                  onClick={() => setShowDetailed(!showDetailed)}
                  className="btn-secondary text-xs px-2 py-1 flex items-center gap-1"
                  title={showDetailed ? "Show simple response" : "Show detailed response"}
                >
                  {showDetailed ? <BookA size={12} /> : <BookOpen size={12} />}
                  <span>{showDetailed ? 'Simple' : 'Detailed'}</span>
                </button>
              )}
              
              <div className="flex items-center gap-1">
                <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors" title="Good response">
                  <ThumbsUp size={12} />
                </button>
                <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors" title="Bad response">
                  <ThumbsDown size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
