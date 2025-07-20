'use client'

import { useChatStore } from '../../store/chatStore'
import { X, Play, Pause, Volume2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { apiService } from '../../lib/api'

interface VoiceSidebarProps {
  isOpen: boolean
}

interface VoiceExplanation {
  text: string
  timings: Array<{ start: number; end: number; text: string }>
  audioUrl: string
}

export default function VoiceSidebar({ isOpen }: VoiceSidebarProps) {
  const { toggleVoiceSidebar, currentSession } = useChatStore()
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentLine, setCurrentLine] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [voiceExplanation, setVoiceExplanation] = useState<VoiceExplanation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cachedExplanations, setCachedExplanations] = useState<Record<string, VoiceExplanation>>({})
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    // Clear current voice explanation and audio state when session changes
    setVoiceExplanation(null)
    setError(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setCurrentLine(0)
    setIsLoading(false)
    
    // Check if we have a cached explanation for the last assistant message in this session
    if (currentSession && currentSession.messages.length > 0) {
      const lastAssistantMessage = [...currentSession.messages]
        .reverse()
        .find(msg => msg.type === 'assistant')
      
      if (lastAssistantMessage) {
        const cacheKey = lastAssistantMessage.query_id || lastAssistantMessage.id
        if (cacheKey && cachedExplanations[cacheKey]) {
          console.log("Loading cached voice explanation for message:", cacheKey)
          setVoiceExplanation(cachedExplanations[cacheKey])
        }
      }
    }
  }, [currentSession, cachedExplanations])

  useEffect(() => {
    // Generate voice explanation when sidebar is opened
    if (isOpen && currentSession && !voiceExplanation && !isLoading) {
      generateVoiceExplanation()
    }
    
    // Stop audio when sidebar is closed
    if (!isOpen && isPlaying) {
      const audio = audioRef.current
      if (audio) {
        audio.pause()
        setIsPlaying(false)
      }
    }
  }, [isOpen, currentSession, voiceExplanation, isPlaying])

  const generateVoiceExplanation = async () => {
    if (!currentSession || currentSession.messages.length === 0) {
      setError('No messages to explain')
      return
    }

    // Store the current session ID to check if it changes during the async operation
    const sessionIdAtStart = currentSession.id

    // Get the last assistant message
    const lastAssistantMessage = [...currentSession.messages]
      .reverse()
      .find(msg => msg.type === 'assistant')

    if (!lastAssistantMessage) {
      setError('No assistant messages to explain')
      return
    }

    // Check if we have a detailed response - only generate voice for detailed responses
    if (!lastAssistantMessage.detailed_response) {
      setError('Voice explanations are only available for detailed responses. Please toggle to detailed view first.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {    
    // Use detailed response for voice explanations
    let textToVoice = lastAssistantMessage.detailed_response
    
    console.log("Using detailed response for voice generation:", textToVoice.substring(0, 100) + "...");
    
    // Generate a query ID based on the message ID or create a unique one
    const queryId = lastAssistantMessage.query_id || lastAssistantMessage.id || `msg_${Date.now()}`
    const sessionId = currentSession?.id
    
    // Check cache first
    const cacheKey = lastAssistantMessage.query_id || lastAssistantMessage.id
    if (cacheKey && cachedExplanations[cacheKey]) {
      console.log("Using cached voice explanation for message:", cacheKey)
      setVoiceExplanation(cachedExplanations[cacheKey])
      setIsLoading(false)
      return
    }
    
    console.log("Checking for existing voice or generating new one:", {
      textLength: textToVoice.length,
      queryId,
      sessionId,
      hasQueryId: !!lastAssistantMessage.query_id
    });

      let response;
      
      // First, try to get existing audio if this message has a query_id
      if (lastAssistantMessage.query_id) {
        try {
          console.log("Attempting to retrieve existing audio for query_id:", lastAssistantMessage.query_id);
          response = await apiService.getAudioByQueryId(lastAssistantMessage.query_id, sessionId);
          console.log("Retrieved existing audio:", response);
        } catch (existingAudioError) {
          console.log("No existing audio found, will generate new one:", existingAudioError);
          response = null;
        }
      }
      
      // If no existing audio found, generate new one
      if (!response || !response.audio_url) {
        console.log("Generating new voice explanation...");
        // Call the API to generate voice with organization parameters
        response = await apiService.generateVoice(
          textToVoice,
          'en-US',
          'en-US-Wavenet-D',
          sessionId,
          queryId
        )
        console.log("Voice generation response:", response);
      }
      
      // Check if there's an error in the response
      if (response.error) {
        throw new Error(`API Error: ${response.error}`);
      }
      
      // Check if we got back an audio URL
      if (!response.audio_url) {
        throw new Error("No audio URL returned from API");
      }
      
      // Split the text into sentences for timings (we always need this for display)
      const sentences = textToVoice.split('.')
        .filter((sentence: string) => sentence.trim().length > 0)
        .map((sentence: string) => sentence.trim() + '.')
      
      // Create timing objects based on the returned timings or create simple ones
      let timings = [];
      
      if (response.tts_timings && response.tts_timings.length > 0) {
        console.log("Using backend timing data:", response.tts_timings);
        // Use backend timings if available
        timings = response.tts_timings;
      } else if (response.timings && response.timings.length > 0) {
        console.log("Using existing audio timing data:", response.timings);
        // Use existing timings if available (for previously generated audio)
        timings = response.timings;
      } else {
        console.log("No timing data available, creating estimates");
        // Create simple timings based on text length (fallback)
        let startTime = 0;
        timings = sentences.map((sentence: string, index: number) => {
          const duration = sentence.length * 0.05; // Rough estimate: 50ms per character
          const timing = {
            start: startTime,
            end: startTime + duration,
            text: sentence
          };
          startTime += duration;
          return timing;
        });
      }
      
      // Construct the full audio URL if it's a relative URL
      let audioUrl = convertToBackendURL(response.audio_url);
      console.log("Converted audio URL:", audioUrl);
      
      // Check if the session is still the same before setting the result
      // This prevents race conditions when users switch sessions quickly
      const currentSessionNow = useChatStore.getState().currentSession
      if (currentSessionNow?.id === sessionIdAtStart) {
        const newVoiceExplanation = {
          text: textToVoice,
          timings: timings,
          audioUrl: audioUrl
        };
        
        setVoiceExplanation(newVoiceExplanation);
        
        // Cache the explanation for this message
        const cacheKey = lastAssistantMessage.query_id || lastAssistantMessage.id;
        if (cacheKey) {
          setCachedExplanations(prev => ({
            ...prev,
            [cacheKey]: newVoiceExplanation
          }));
          console.log("Cached voice explanation for message:", cacheKey);
        }
      } else {
        console.log("Session changed during voice generation, discarding result");
      }
    } catch (err) {
      console.error('Error generating voice explanation:', err)
      
      // More specific error handling
      if (err instanceof Error) {
        if (err.message.includes('400')) {
          setError('Text is too long or invalid for voice generation. Please try with shorter content.')
        } else if (err.message.includes('401')) {
          setError('Authentication failed. Please refresh the page and try again.')
        } else if (err.message.includes('500')) {
          setError('Voice generation service is temporarily unavailable. Please try again in a moment.')
        } else if (err.message.includes('timeout')) {
          setError('Voice generation timed out. The content might be too long.')
        } else {
          setError(`Voice generation failed: ${err.message}`)
        }
      } else {
        setError('Failed to generate voice explanation. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Enhanced voice explanation generation
  const generateEnhancedExplanation = async () => {
    if (!currentSession || currentSession.messages.length === 0) {
      setError('No messages to explain')
      return
    }

    const userMessages = currentSession.messages.filter(msg => msg.type === 'user')
    const lastUserMessage = userMessages[userMessages.length - 1]
    
    if (!lastUserMessage) {
      setError('No user messages found to enhance')
      return
    }

    setIsLoading(true)
    setError(null)
    setVoiceExplanation(null)

    try {
      console.log("Generating enhanced voice explanation for:", lastUserMessage.content.substring(0, 100))
      
      const enhancedResponse = await apiService.getVoiceExplanation(
        lastUserMessage.content,
        currentSession.id,
        lastUserMessage.sentiment || 'NEUTRAL',
        0,
        'text'
      )
      
      if (enhancedResponse?.voice_explanation) {
        console.log("Enhanced explanation generated:", enhancedResponse.voice_explanation.substring(0, 100) + "...")
        
        // Generate voice audio for the enhanced explanation
        const voiceResponse = await apiService.generateVoice(
          enhancedResponse.voice_explanation,
          'en-US',
          'en-US-Wavenet-D',
          currentSession.id,
          `enhanced_${Date.now()}`
        )
        
        if (voiceResponse?.audio_url) {
          let audioUrl = convertToBackendURL(voiceResponse.audio_url);
          console.log("Enhanced explanation audio URL:", audioUrl);
          
          const newVoiceExplanation = {
            text: enhancedResponse.voice_explanation,
            timings: voiceResponse.timings || [],
            audioUrl: audioUrl
          }
          
          setVoiceExplanation(newVoiceExplanation)
        } else {
          setError('Failed to generate audio for enhanced explanation')
        }
      } else {
        setError('Failed to generate enhanced explanation')
      }
    } catch (error) {
      console.error('Error generating enhanced explanation:', error)
      setError('Failed to generate enhanced explanation. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => {
      setCurrentTime(audio.currentTime)
      
      // Update current line based on timing
      if (voiceExplanation) {
        const currentTiming = voiceExplanation.timings.find(
          timing => audio.currentTime >= timing.start && audio.currentTime < timing.end
        )
        if (currentTiming) {
          const lineIndex = voiceExplanation.timings.indexOf(currentTiming)
          setCurrentLine(lineIndex)
        }
      }
    }

    const updateDuration = () => {
      setDuration(audio.duration)
    }

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('ended', () => setIsPlaying(false))

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('ended', () => setIsPlaying(false))
    }
  }, [voiceExplanation])

  const togglePlayback = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      setError(null) // Clear any previous errors
      
      // Log audio source for debugging
      console.log("Playing audio from URL:", audio.src)
      
      audio.play().catch(err => {
        console.error('Error playing audio:', err)
        
        // Provide more specific error messages based on error type
        if (err.name === "NotSupportedError") {
          setError(`Audio format not supported or URL is invalid: ${audio.src}`)
        } else if (err.name === "NotAllowedError") {
          setError('Browser blocked audio playback. Please interact with the page first.')
        } else if (err.name === "AbortError") {
          setError('Audio playback was aborted. The audio URL might be invalid or blocked by CORS.')
        } else {
          setError(`Failed to play audio: ${err.message || err.name}. Try regenerating the audio.`)
        }
      })
      setIsPlaying(true)
    }
  }
  
  // Add a function to preload audio and check if it can be played
  const preloadAudio = () => {
    if (!voiceExplanation?.audioUrl) return
    
    const audio = audioRef.current
    if (!audio) return
    
    // Set audio attributes
    audio.preload = "auto"
    
    // Listen for errors
    const handleError = (e: Event) => {
      console.error('Audio loading error:', e)
      const target = e.target as HTMLAudioElement
      const errorMessage = target?.error?.message || "Unknown error loading audio"
      setError(`Audio could not be loaded: ${errorMessage}`)
    }
    
    audio.addEventListener('error', handleError)
    
    // Return cleanup function
    return () => {
      audio.removeEventListener('error', handleError)
    }
  }
  
  // Add effect to preload audio when URL changes
  useEffect(() => {
    return preloadAudio()
  }, [voiceExplanation?.audioUrl])

  const handleSeek = (time: number) => {
    const audio = audioRef.current
    if (!audio) return

    audio.currentTime = time
    setCurrentTime(time)
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const retryGeneration = () => {
    setVoiceExplanation(null)
    setError(null)
    generateVoiceExplanation()
  }

  // Utility function to convert backend URLs to correct format
  const convertToBackendURL = (url: string): string => {
    if (url && url.startsWith("/api/")) {
      // Replace frontend port with backend port (8000)
      const currentPort = window.location.port;
      const baseUrl = window.location.origin.replace(`:${currentPort}`, ':8000');
      return `${baseUrl}${url}`;
    }
    return url;
  };

  if (!isOpen) return null

  return (
    <div className="w-96 bg-gray-800 border-l border-gray-700 flex flex-col animate-slide-in h-full max-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Volume2 size={20} className="text-teal-400" />
          <h2 className="text-lg font-semibold text-white">Voice Explanation</h2>
        </div>
        <button
          onClick={toggleVoiceSidebar}
          className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <X size={20} className="text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col p-4 min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-10 h-10 border-4 border-teal-400 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-300">Generating voice explanation...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-red-400 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <p className="text-gray-300 mb-4 text-center">{error}</p>
            <button 
              onClick={retryGeneration}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 rounded-lg text-white transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : voiceExplanation ? (
          <>
            {/* Voice Info */}
            <div className="bg-gray-700 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">Detailed Response Audio</span>
                <span className="text-xs bg-teal-600 px-2 py-1 rounded text-white">
                  {voiceExplanation.text.length} chars
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Voice explanation generated from detailed response
              </p>
            </div>
            
            {/* Audio Player */}
            <div className="bg-gray-700 rounded-lg p-4 mb-4">
              <audio ref={audioRef} src={voiceExplanation.audioUrl} />
              
              {/* Play/Pause Button */}
              <button
                onClick={togglePlayback}
                className="w-12 h-12 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 rounded-full flex items-center justify-center text-white mb-3 mx-auto transition-all transform hover:scale-105"
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <div 
                  className="w-full h-2 bg-gray-600 rounded-full cursor-pointer"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const progress = (e.clientX - rect.left) / rect.width
                    handleSeek(progress * duration)
                  }}
                >
                  <div 
                    className="h-full bg-gradient-to-r from-teal-400 to-teal-500 rounded-full transition-all"
                    style={{ width: `${(currentTime / duration) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Text with Sync */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Explanation Text</h3>
              <div className="space-y-3 pb-4">
                {voiceExplanation.timings.map((timing, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      currentLine === index
                        ? 'bg-teal-500/20 border border-teal-500/30 text-white'
                        : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                    }`}
                    onClick={() => handleSeek(timing.start)}
                  >
                    <p className="text-sm leading-relaxed">{timing.text}</p>
                    <span className="text-xs text-gray-400 mt-1 block">
                      {formatTime(timing.start)} - {formatTime(timing.end)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Controls */}
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <button className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors">
                  Slow Down
                </button>
                <button className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors">
                  Speed Up
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-center mb-6">
              <div className="text-gray-400 mb-3">
                <Volume2 size={48} className="mx-auto opacity-50" />
              </div>
              <p className="text-gray-300 mb-2">Voice explanations available for detailed responses</p>
              <p className="text-gray-400 text-sm">Toggle to detailed view in the chat to enable voice generation</p>
            </div>
            {/* Only show generate button if there are messages */}
            {currentSession && currentSession.messages.length > 0 && (
              <button 
                onClick={generateVoiceExplanation}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 rounded-lg text-white transition-colors"
              >
                Check for Detailed Response
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
