'use client'

import { useChatStore } from '../../store/chatStore'
import { X, Image, Eye, BookOpen } from 'lucide-react'
import { useState, useEffect } from 'react'
import { apiService } from '../../lib/api'

interface ImageSidebarProps {
  isOpen: boolean
}

interface ImageExplanation {
  image_url: string | null
  svg_code: string | null
  explanations: Array<{
    text: string
    pdf_name: string
    page_num: number
  }>
  debug?: {
    matched_ids: string[]
  }
}

export default function ImageSidebar({ isOpen }: ImageSidebarProps) {
  const { toggleImageSidebar, currentSession } = useChatStore()
  const [isLoading, setIsLoading] = useState(false)
  const [imageExplanation, setImageExplanation] = useState<ImageExplanation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cachedExplanations, setCachedExplanations] = useState<Record<string, ImageExplanation>>({})

  useEffect(() => {
    // Clear current image explanation when session changes
    setImageExplanation(null)
    setError(null)
    setIsLoading(false)
    
    // Check if we have a cached explanation for the last assistant message in this session
    if (currentSession && currentSession.messages.length > 0) {
      const lastAssistantMessage = [...currentSession.messages]
        .reverse()
        .find(msg => msg.type === 'assistant')
      
      if (lastAssistantMessage) {
        // Get the corresponding user message to create the same cache key format
        const messageIndex = currentSession.messages.findIndex(msg => msg.id === lastAssistantMessage.id)
        const userMessage = messageIndex > 0 ? currentSession.messages[messageIndex - 1] : null
        
        if (userMessage && userMessage.type === 'user') {
          const cacheKey = `${userMessage.content.trim().toLowerCase()}_${lastAssistantMessage.query_id || lastAssistantMessage.id}`
          if (cachedExplanations[cacheKey]) {
            console.log("Loading cached image explanation for query:", userMessage.content, "with key:", cacheKey)
            setImageExplanation(cachedExplanations[cacheKey])
          }
        }
      }
    }
  }, [currentSession, cachedExplanations])

  useEffect(() => {
    // Generate image explanation when sidebar is opened
    if (isOpen && currentSession && !imageExplanation && !isLoading) {
      generateImageExplanation()
    }
  }, [isOpen, currentSession, imageExplanation, isLoading])

  const clearCache = () => {
    setCachedExplanations({})
    setImageExplanation(null)
    setError(null)
    setIsLoading(false)
    console.log("Image cache cleared completely")
  }

  const debugCache = () => {
    console.log("Current cache contents:", cachedExplanations)
    console.log("Cache keys:", Object.keys(cachedExplanations))
    if (imageExplanation) {
      console.log("Current image explanation:", imageExplanation)
    }
  }

  const generateImageExplanation = async () => {
    if (!currentSession || currentSession.messages.length === 0) {
      setError('No messages to explain')
      return
    }

    // Get the last assistant message
    const lastAssistantMessage = [...currentSession.messages]
      .reverse()
      .find(msg => msg.type === 'assistant')

    if (!lastAssistantMessage) {
      setError('No assistant messages to explain')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Fallback: Get the corresponding user message for the query first
      const messageIndex = currentSession.messages.findIndex(msg => msg.id === lastAssistantMessage.id)
      const userMessage = messageIndex > 0 ? currentSession.messages[messageIndex - 1] : null
      
      if (!userMessage || userMessage.type !== 'user') {
        setError('No user query found for image generation')
        return
      }

      // Create cache key based on actual query content to avoid wrong image caching
      const cacheKey = `${userMessage.content.trim().toLowerCase()}_${lastAssistantMessage.query_id || lastAssistantMessage.id}`
      
      console.log("=== IMAGE GENERATION DEBUG ===")
      console.log("User query:", userMessage.content)
      console.log("Cache key:", cacheKey)
      console.log("Available cache keys:", Object.keys(cachedExplanations))
      console.log("=== END DEBUG ===")
      
      // Check cache first with improved key
      if (cachedExplanations[cacheKey]) {
        console.log("Using cached image explanation for query:", userMessage.content)
        setImageExplanation(cachedExplanations[cacheKey])
        setIsLoading(false)
        return
      }

      // Check if the message already has image data
      if ((lastAssistantMessage as any).image_data) {
        console.log("=== EXISTING IMAGE DATA DEBUG ===")
        console.log("Message has existing image data:", (lastAssistantMessage as any).image_data)
        console.log("User query was:", userMessage.content)
        console.log("=== END EXISTING IMAGE DATA DEBUG ===")
        
        // TEMPORARILY SKIP EXISTING IMAGE DATA TO FORCE FRESH API CALL
        // const imageData = (lastAssistantMessage as any).image_data
        // 
        // const explanation: ImageExplanation = {
        //   image_url: imageData.image_url,
        //   svg_code: imageData.svg_code,
        //   explanations: imageData.explanations || [],
        //   debug: imageData.debug
        // }

        // setImageExplanation(explanation)

        // // Cache the explanation with improved key
        // setCachedExplanations(prev => ({
        //   ...prev,
        //   [cacheKey]: explanation
        // }))
        // setIsLoading(false)
        // return
      }

      console.log("=== API CALL DEBUG ===")
      console.log("Generating image explanation for query:", userMessage.content)
      console.log("API URL:", `http://localhost:8000/image/explain-topic?query=${encodeURIComponent(userMessage.content)}&format=json`)
      console.log("=== END API CALL DEBUG ===")

      // Call the image generation API as fallback
      const response = await fetch(`http://localhost:8000/image/explain-topic?query=${encodeURIComponent(userMessage.content)}&format=json`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to generate image explanation: ${response.statusText}`)
      }

      const data = await response.json()
      console.log("=== BACKEND RESPONSE DEBUG ===")
      console.log("Full backend response:", data)
      console.log("Query was:", userMessage.content)
      console.log("Returned image_url:", data.image_url)
      console.log("=== END BACKEND RESPONSE DEBUG ===")

      const explanation: ImageExplanation = {
        image_url: data.image_url,
        svg_code: data.svg_code,
        explanations: data.explanations || [],
        debug: data.debug
      }

      setImageExplanation(explanation)

      // Cache the explanation
      if (cacheKey) {
        setCachedExplanations(prev => ({
          ...prev,
          [cacheKey]: explanation
        }))
      }

    } catch (err) {
      console.error("Error generating image explanation:", err)
      setError(err instanceof Error ? err.message : 'Failed to generate image explanation')
    } finally {
      setIsLoading(false)
    }
  }

  const getImageUrl = (imageUrl: string | null): string | null => {
    if (!imageUrl) return null
    
    // If it's already a full URL, return as is
    if (imageUrl.startsWith('http')) {
      return imageUrl
    }
    
    // Extract filename from path
    const filename = imageUrl.split(/[/\\]/).pop()
    if (!filename) return null
    
    // Convert to full backend URL based on image type
    if (imageUrl.includes('generated_images/') || ['deeplearning.png', 'friction.png', 'hyperbola.png', 'parabola.jpg', 'photosynthesis.jpeg'].includes(filename)) {
      // Topic images from generated_images folder
      return `http://localhost:8000/api/static/generated_images/${filename}`
    }
    
    // Handle textbook images
    if (imageUrl.includes('textbooks/images/')) {
      return `http://localhost:8000/api/static/textbook_images/${filename}`
    }
    
    // Default: try generated_images folder on backend
    return `http://localhost:8000/api/static/generated_images/${filename}`
  }

  if (!isOpen) return null

  return (
    <div className="h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <Image className="w-5 h-5 text-teal-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Visual Explanation</h3>
        </div>
        <div className="flex items-center space-x-2">
          {/* Debug: Clear Cache Button */}
          <button
            onClick={clearCache}
            title="Clear image cache"
            className="p-1 text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded transition-colors"
          >
            🗑️
          </button>
          {/* Debug: Show Cache Button */}
          <button
            onClick={debugCache}
            title="Debug cache contents"
            className="p-1 text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded transition-colors"
          >
            🔍
          </button>
          <button
            onClick={toggleImageSidebar}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300 text-sm">Generating visual explanation...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
            <button
              onClick={() => {
                setError(null)
                generateImageExplanation()
              }}
              className="mt-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 text-sm underline"
            >
              Try again
            </button>
          </div>
        )}

        {imageExplanation && !isLoading && (
          <div className="space-y-6">
            {/* Image/SVG Display */}
            {(imageExplanation.image_url || imageExplanation.svg_code) && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Eye className="w-4 h-4 text-teal-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Visual Diagram</span>
                </div>
                
                <div className="flex justify-center">
                  {imageExplanation.svg_code ? (
                    <div 
                      className="max-w-full"
                      dangerouslySetInnerHTML={{ __html: imageExplanation.svg_code }}
                    />
                  ) : imageExplanation.image_url ? (
                    <div className="relative">
                      {(() => {
                        const finalImageUrl = getImageUrl(imageExplanation.image_url);
                        console.log("=== IMAGE URL DEBUG ===");
                        console.log("Original image_url:", imageExplanation.image_url);
                        console.log("Final image URL:", finalImageUrl);
                        console.log("=== END IMAGE DEBUG ===");
                        return (
                          <img 
                            src={finalImageUrl || undefined} 
                            alt="Visual explanation" 
                            className="max-w-full h-auto rounded-lg shadow-sm"
                            onLoad={(e) => {
                              console.log("Image loaded successfully:", finalImageUrl);
                            }}
                            onError={(e) => {
                              console.error("Error loading image:", finalImageUrl)
                              console.error("Original URL:", imageExplanation.image_url)
                              const target = e.currentTarget
                              target.style.display = 'none'
                              // Show fallback message
                              const fallback = target.nextElementSibling as HTMLElement
                              if (fallback) fallback.style.display = 'block'
                            }}
                          />
                        );
                      })()}
                      <div 
                        className="hidden text-center text-gray-500 dark:text-gray-400 p-4"
                        style={{ display: 'none' }}
                      >
                        <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Image not available</p>
                        <p className="text-xs mt-1">Filename: {imageExplanation.image_url.split(/[/\\]/).pop()}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* Text Explanations */}
            {imageExplanation.explanations && imageExplanation.explanations.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <BookOpen className="w-4 h-4 text-teal-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Related Explanations</span>
                </div>
                
                {imageExplanation.explanations.map((exp, index) => (
                  <div key={index} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed mb-2">
                      {exp.text}
                    </p>
                    {exp.pdf_name && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Source: {exp.pdf_name} {exp.page_num > 0 && `(Page ${exp.page_num})`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Debug Info (only in development) */}
            {imageExplanation.debug && process.env.NODE_ENV === 'development' && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                <details>
                  <summary className="cursor-pointer">Debug Info</summary>
                  <pre className="mt-2 bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs overflow-auto">
                    {JSON.stringify(imageExplanation.debug, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!imageExplanation && !isLoading && !error && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Image className="w-12 h-12 text-gray-400 mb-4" />
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Visual Available</h4>
            <p className="text-gray-600 dark:text-gray-300 text-sm">
              Visual explanations will appear here when available for your queries.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
