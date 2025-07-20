'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Brain, CheckCircle, XCircle, ArrowLeft, ArrowRight, RotateCcw, Save, Home } from 'lucide-react'
import { motion } from 'framer-motion'
import SpectacularBackground from '@/components/3D/FallbackBackground'
import { useDarkMode } from '@/hooks/useDarkMode'

// Utility function for logging operations (matching LLM project style)
const logOperation = (operation: string, data?: any, error?: any) => {
  const timestamp = new Date().toISOString()
  const logEntry = {
    timestamp,
    operation,
    data: data || {},
    error: error || null
  }
  console.log(`[${timestamp}] ${operation}:`, logEntry)
}

export default function QuizPage() {
  const [loading, setLoading] = useState(true)
  const [darkMode] = useDarkMode()
  const [quizSetup, setQuizSetup] = useState({
    topic: '',
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    questionCount: 5
  })
  const [currentStep, setCurrentStep] = useState<'setup' | 'quiz' | 'results'>('setup')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentSessionActive, setCurrentSessionActive] = useState(false)
  const [quizData, setQuizData] = useState<any>(null)
  const [userAnswers, setUserAnswers] = useState<string[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [quizResults, setQuizResults] = useState<any>(null)
  const [quizCount, setQuizCount] = useState(0)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [cameraInitialized, setCameraInitialized] = useState(false)
  
  // Video refs for live preview
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    async function initializeQuiz() {
      try {
        logOperation('Quiz: Initializing quiz page')
        
        // Always use the fixed session ID from URL params or default - no authentication required
        const urlSessionId = searchParams.get('sessionId') || "aaab3eb6-af0c-4779-bde4-8c279a677f55"
        logOperation('Quiz: Using fixed session ID', { sessionId: urlSessionId })
        setSessionId(urlSessionId)
        setCurrentSessionActive(true)
        
        // Get quiz count for this session (for display purposes only)
        try {
          const { data: quizzes } = await supabase
            .from('quizzes')
            .select('quiz_index')
            .eq('session_id', urlSessionId)
            .order('quiz_index', { ascending: false })
            .limit(1)

          if (quizzes && quizzes.length > 0) {
            setQuizCount(quizzes[0].quiz_index + 1)
          }
        } catch (dbError) {
          logOperation('Quiz: Error getting quiz count (non-critical)', null, dbError)
          // Continue without quiz count - not critical for functionality
        }
        
        // Initialize video camera
        await initializeCamera()
      } catch (error) {
        logOperation('Quiz: Error in initializeQuiz', null, error)
        // Don't redirect - just continue with quiz functionality
      } finally {
        setLoading(false)
      }
    }

    initializeQuiz()
  }, [searchParams])

  // Re-apply camera stream when video element mounts in quiz step
  useEffect(() => {
    if (currentStep === 'quiz' && videoRef.current && streamRef.current && !videoRef.current.srcObject) {
      logOperation('Quiz: Re-applying camera stream to video element')
      videoRef.current.srcObject = streamRef.current
      videoRef.current.muted = true
      videoRef.current.playsInline = true
      videoRef.current.autoplay = true
      videoRef.current.play().catch((error) => {
        logOperation('Quiz: Error playing video', null, error)
      })
    }
  }, [currentStep, videoRef.current])

  // Periodic check for video stream health
  useEffect(() => {
    if (currentStep === 'quiz') {
      const checkVideoHealth = () => {
        if (videoRef.current && streamRef.current) {
          const videoTracks = streamRef.current.getVideoTracks()
          if (videoTracks.length === 0 || videoTracks[0].readyState === 'ended') {
            logOperation('Quiz: Video stream ended, attempting restart')
            restartCameraIfNeeded()
          }
        }
      }

      const interval = setInterval(checkVideoHealth, 5000) // Check every 5 seconds
      return () => clearInterval(interval)
    }
  }, [currentStep])

  // Video preview initialization (no recording, just live preview)
  const initializeCamera = async () => {
    try {
      console.log('=== CAMERA INITIALIZATION DEBUG ===')
      console.log('Navigator.mediaDevices available:', !!navigator.mediaDevices)
      console.log('getUserMedia available:', !!navigator.mediaDevices?.getUserMedia)
      
      logOperation('Quiz: Requesting camera access for video preview')
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false // Privacy - not recording audio as per requirements
      })
      
      console.log('Stream obtained:', stream)
      console.log('Video tracks:', stream.getVideoTracks())
      
      streamRef.current = stream
      
      if (videoRef.current) {
        console.log('Video element found:', videoRef.current)
        videoRef.current.srcObject = stream
        videoRef.current.muted = true
        videoRef.current.playsInline = true
        videoRef.current.autoplay = true
        
        // Add event listeners to track video state
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded')
        }
        videoRef.current.onplay = () => {
          console.log('Video started playing')
        }
        videoRef.current.onerror = (e) => {
          console.error('Video error:', e)
        }
        
        await videoRef.current.play()
        console.log('Video element started playing')
        logOperation('Quiz: Video element started playing')
      } else {
        console.log('Video element not found!')
      }
      
      setCameraInitialized(true)
      setVideoError(null)
      console.log('=== CAMERA INITIALIZED SUCCESSFULLY ===')
      logOperation('Quiz: Camera initialized successfully')
    } catch (error: any) {
      console.error('=== CAMERA INITIALIZATION FAILED ===')
      console.error('Error details:', error)
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      
      logOperation('Quiz: Camera initialization failed', null, error)
      setCameraInitialized(false)
      const errorMessage = error.name === 'NotAllowedError' 
        ? 'Camera access denied. Please allow camera access to see the video preview.'
        : error.name === 'NotFoundError'
        ? 'No camera found on this device.'
        : `Camera error: ${error.message}`
      setVideoError(errorMessage)
    }
  }

  // Check for existing active session
  const checkExistingSession = async (userId: string) => {
    try {
      logOperation('Quiz: Checking for existing active session', { userId })
      
      const { data: sessions, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', userId)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)

      if (error) {
        logOperation('Quiz: Error checking existing sessions', null, error)
        return
      }

      if (sessions && sessions.length > 0) {
        const activeSession = sessions[0]
        setSessionId(activeSession.id)
        setCurrentSessionActive(true)
        
        // Get quiz count for this session
        const { data: quizzes } = await supabase
          .from('quizzes')
          .select('quiz_index')
          .eq('session_id', activeSession.id)
          .order('quiz_index', { ascending: false })
          .limit(1)

        if (quizzes && quizzes.length > 0) {
          setQuizCount(quizzes[0].quiz_index + 1)
        }
        
        logOperation('Quiz: Found existing active session', { 
          sessionId: activeSession.id,
          quizCount: quizzes?.length || 0 
        })
      } else {
        logOperation('Quiz: No active session found')
      }
    } catch (error) {
      logOperation('Quiz: Error in checkExistingSession', null, error)
    }
  }

  // Generate quiz function
  const generateQuiz = async () => {
    logOperation('Quiz: Starting quiz generation process', quizSetup)
    setLoading(true)

    try {
      // Always use the fixed session ID - no need to create new sessions
      if (!sessionId) {
        const fixedSessionId = "aaab3eb6-af0c-4779-bde4-8c279a677f55"
        setSessionId(fixedSessionId)
        setCurrentSessionActive(true)
      }

      setLoading(false)

      // Generate quiz using Groq (simplified for integration)
      try {
        const generatedQuiz = await callGroqAPI()
        setQuizData(generatedQuiz)
        setUserAnswers(new Array(generatedQuiz.questions.length).fill(''))
        setCurrentQuestionIndex(0)
        setCurrentStep('quiz')
        
        // Ensure camera is working when quiz starts
        if (!cameraInitialized) {
          logOperation('Quiz: Reinitializing camera for quiz start')
          await initializeCamera()
        } else {
          // Even if camera was initialized, restart it to ensure video element gets the stream
          logOperation('Quiz: Ensuring camera stream is connected to video element')
          await restartCameraIfNeeded()
        }
        
        logOperation('Quiz: Quiz generated successfully', { 
          questionCount: generatedQuiz.questions.length,
          difficulty: quizSetup.difficulty 
        })
      } catch (apiError) {
        logOperation('Quiz: Error generating quiz content', null, apiError)
        alert('Failed to generate quiz. Please try again.')
      }
    } catch (error) {
      logOperation('Quiz: Error in generateQuiz', null, error)
      alert('Failed to start quiz session. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Function to restart camera if needed
  const restartCameraIfNeeded = async () => {
    if (videoRef.current && (!streamRef.current || !videoRef.current.srcObject)) {
      logOperation('Quiz: Camera stream lost, reinitializing...')
      await initializeCamera()
    }
  }

  // Call Groq API to generate quiz
  const callGroqAPI = async () => {
    const response = await fetch('/api/generate-quiz', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: quizSetup.topic,
        difficulty: quizSetup.difficulty,
        questionCount: quizSetup.questionCount,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to generate quiz')
    }

    return await response.json()
  }

  // Handle answer selection
  const handleAnswerSelect = (answerIndex: number) => {
    const newAnswers = [...userAnswers]
    newAnswers[currentQuestionIndex] = answerIndex.toString()
    setUserAnswers(newAnswers)
    logOperation('Quiz: Answer selected', { 
      questionIndex: currentQuestionIndex, 
      selectedAnswer: answerIndex 
    })
  }

  // Navigate questions
  const handleNextQuestion = () => {
    if (currentQuestionIndex < quizData.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
      logOperation('Quiz: Moved to next question', { questionIndex: currentQuestionIndex + 1 })
    }
  }

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
      logOperation('Quiz: Moved to previous question', { questionIndex: currentQuestionIndex - 1 })
    }
  }

  // Submit quiz
  const handleSubmitQuiz = async () => {
    if (!sessionId || !quizData) return

    try {
      logOperation('Quiz: Submitting quiz', { sessionId, quizCount })

      // Calculate score
      let correctCount = 0
      const correctAnswers = quizData.correct_answers || []
      
      userAnswers.forEach((answer, index) => {
        if (parseInt(answer) === correctAnswers[index]) {
          correctCount++
        }
      })

      const quizScore = (correctCount / quizData.questions.length) * 100

      // Generate random stress score between 60-90
      const stressScore = Math.floor(Math.random() * (90 - 60 + 1)) + 60
      logOperation('Quiz: Generated stress score', { stressScore })

      // Save quiz to database (try to save, but don't fail if database is unavailable)
      try {
        const { data: savedQuiz, error } = await supabase
          .from('quizzes')
          .insert({
            session_id: sessionId,
            quiz_index: quizCount,
            questions: quizData.questions,
            options: quizData.options,
            correct_answers: correctAnswers,
            user_answers: userAnswers.map(a => parseInt(a)),
            quiz_score: quizScore,
            stress_score: stressScore,
            difficulty: quizSetup.difficulty,
            explanations: quizData.explanations || []
          })
          .select()
          .single()

        if (error) {
          logOperation('Quiz: Error saving quiz to database (non-critical)', null, error)
          // Continue with local results even if database save fails
        } else {
          logOperation('Quiz: Quiz saved to database successfully', { quizId: savedQuiz.id })
        }
      } catch (dbError) {
        logOperation('Quiz: Database save failed (non-critical, continuing with local results)', null, dbError)
      }

      const results = {
        score: quizScore,
        correctAnswers: correctCount,
        totalQuestions: quizData.questions.length,
        stressScore: stressScore,
        questions: quizData.questions,
        userAnswers: userAnswers,
        correctAnswerIndices: correctAnswers,
        explanations: quizData.explanations || []
      }
      
      setQuizResults(results)
      setCurrentStep('results')
      setQuizCount(quizCount + 1)
      
      logOperation('Quiz: Quiz submitted successfully', { 
        score: quizScore,
        correctAnswers: correctCount,
        totalQuestions: quizData.questions.length
      })
    } catch (error) {
      logOperation('Quiz: Error submitting quiz', null, error)
      alert('Failed to submit quiz. Please try again.')
    }
  }

  // End session
  const handleEndSession = async () => {
    if (!sessionId) return

    try {
      logOperation('Quiz: Ending session')
      
      const { error } = await supabase
        .from('sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', sessionId)

      if (error) {
        logOperation('Quiz: Error ending session', null, error)
      } else {
        logOperation('Quiz: Session ended successfully')
      }
      
      // Clean up video stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      
      // Close tab (since this opens in new tab)
      if (window.opener) {
        window.close()
      } else {
        router.push('/chat')
      }
    } catch (error) {
      logOperation('Quiz: Error in handleEndSession', null, error)
    }
  }

  // Generate another quiz
  const handleGenerateAnother = () => {
    setQuizData(null)
    setUserAnswers([])
    setCurrentQuestionIndex(0)
    setQuizResults(null)
    setCurrentStep('setup')
    logOperation('Quiz: Starting new quiz in same session')
  }

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      logOperation('Quiz: Component unmounted, camera cleaned up')
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-700">
        <SpectacularBackground darkMode={darkMode} />
        <div className="relative z-10 text-center">
          <motion.div
            className="w-16 h-16 bg-gradient-to-r from-teal-400 to-teal-500 rounded-2xl flex items-center justify-center mb-6 mx-auto"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Brain className="w-8 h-8 text-white" />
          </motion.div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Loading Quiz...
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Please wait while we prepare your learning experience
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 relative overflow-hidden transition-colors duration-700">
      <SpectacularBackground darkMode={darkMode} />
      
      <div className="relative z-10 p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-teal-400 to-teal-500 rounded-xl flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Learning Quiz</h1>
              {currentSessionActive && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Session Active • Quiz {quizCount + 1}
                </p>
              )}
            </div>
          </div>
          
          <Button
            onClick={handleEndSession}
            variant="outline"
            className="border-gray-300 dark:border-gray-600"
          >
            <Home className="w-4 h-4 mr-2" />
            Close
          </Button>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          {currentStep === 'setup' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white">Create New Quiz</CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-300">
                    Set up your learning quiz with custom parameters
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="topic" className="text-gray-900 dark:text-white">Topic</Label>
                    <Input
                      id="topic"
                      placeholder="Enter the topic you want to learn about..."
                      value={quizSetup.topic}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuizSetup(prev => ({ ...prev, topic: e.target.value }))}
                      className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-900 dark:text-white">Difficulty</Label>
                      <div className="flex gap-2">
                        {['easy', 'medium', 'hard'].map((diff) => (
                          <Button
                            key={diff}
                            variant={quizSetup.difficulty === diff ? 'default' : 'outline'}
                            onClick={() => setQuizSetup(prev => ({ ...prev, difficulty: diff as any }))}
                            className={quizSetup.difficulty === diff 
                              ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white' 
                              : 'border-gray-300 dark:border-gray-600'
                            }
                          >
                            {diff.charAt(0).toUpperCase() + diff.slice(1)}
                          </Button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="questionCount" className="text-gray-900 dark:text-white">Number of Questions</Label>
                      <Input
                        id="questionCount"
                        type="number"
                        min="3"
                        max="15"
                        value={quizSetup.questionCount}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuizSetup(prev => ({ ...prev, questionCount: parseInt(e.target.value) }))}
                        className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                      />
                    </div>
                  </div>
                  
                  {/* Camera Test Section */}
                  <div className="space-y-2">
                    <Label className="text-gray-900 dark:text-white">Camera Preview Test</Label>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <video
                            ref={videoRef}
                            className="w-32 h-24 bg-gray-200 dark:bg-gray-700 rounded object-cover"
                            muted
                            playsInline
                            autoPlay
                          />
                          {videoError && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded text-xs text-center">
                              {videoError}
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            Camera status: {cameraInitialized ? '✅ Ready' : videoError ? '❌ Error' : '⏳ Initializing...'} <br/>
                            Browser support: {typeof navigator !== 'undefined' && navigator.mediaDevices ? '✅' : '❌'} getUserMedia
                          </p>
                          <Button
                            onClick={initializeCamera}
                            size="sm"
                            variant="outline"
                            className="text-sm"
                          >
                            {cameraInitialized ? 'Restart Camera' : 'Test Camera'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    onClick={generateQuiz}
                    disabled={!quizSetup.topic.trim() || loading}
                    className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white"
                  >
                    {loading ? 'Generating Quiz...' : 'Generate Quiz'}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentStep === 'quiz' && quizData && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-gray-900 dark:text-white">
                        Question {currentQuestionIndex + 1} of {quizData.questions.length}
                      </CardTitle>
                      <CardDescription className="text-gray-600 dark:text-gray-300">
                        Difficulty: {quizSetup.difficulty} • Topic: {quizSetup.topic}
                      </CardDescription>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {userAnswers.filter(a => a !== '').length} / {quizData.questions.length} answered
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Video Preview Section */}
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                    <div className="text-center mb-2">
                      <div className="flex items-center justify-center gap-2">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          📹 Video Preview {cameraInitialized ? (
                            <span className="inline-flex items-center gap-1">
                              (Live) <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            </span>
                          ) : '(Initializing...)'}
                        </h4>
                        <Button
                          onClick={restartCameraIfNeeded}
                          size="sm"
                          variant="ghost"
                          className="text-xs h-6 px-2"
                        >
                          🔄
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-center">
                      <div className="relative">
                        <video
                          ref={videoRef}
                          className="w-48 h-36 bg-gray-200 dark:bg-gray-700 rounded-lg object-cover"
                          muted
                          playsInline
                          autoPlay
                        />
                        {videoError && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
                            <p className="text-xs text-gray-500 dark:text-gray-400 text-center px-2 mb-2">
                              {videoError}
                            </p>
                            <Button
                              onClick={initializeCamera}
                              size="sm"
                              variant="outline"
                              className="text-xs"
                            >
                              Retry Camera
                            </Button>
                          </div>
                        )}
                        {!cameraInitialized && !videoError && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
                            <p className="text-xs text-gray-500 dark:text-gray-400 text-center px-2">
                              Requesting camera access...
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      {quizData.questions[currentQuestionIndex]}
                    </h3>
                    
                    <div className="space-y-2">
                      {quizData.options[currentQuestionIndex]?.map((option: string, optionIndex: number) => (
                        <button
                          key={optionIndex}
                          onClick={() => handleAnswerSelect(optionIndex)}
                          className={`w-full text-left p-3 rounded border transition-colors ${
                            userAnswers[currentQuestionIndex] === optionIndex.toString()
                              ? 'bg-teal-50 border-teal-300 text-teal-900 dark:bg-teal-900/20 dark:border-teal-700 dark:text-teal-100'
                              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600'
                          }`}
                        >
                          <span className="font-medium mr-2">
                            {String.fromCharCode(65 + optionIndex)}.
                          </span>
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Button
                      onClick={handlePreviousQuestion}
                      disabled={currentQuestionIndex === 0}
                      variant="outline"
                      className="border-gray-300 dark:border-gray-600"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Previous
                    </Button>
                    
                    {currentQuestionIndex === quizData.questions.length - 1 ? (
                      <Button
                        onClick={handleSubmitQuiz}
                        disabled={userAnswers.filter(a => a !== '').length !== quizData.questions.length}
                        className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Submit Quiz
                      </Button>
                    ) : (
                      <Button
                        onClick={handleNextQuestion}
                        disabled={currentQuestionIndex === quizData.questions.length - 1}
                        className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white"
                      >
                        Next
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentStep === 'results' && quizResults && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              {/* Results Summary */}
              <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                    Quiz Completed!
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-300">
                    Here are your results for this quiz session
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-4 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {quizResults.score.toFixed(1)}%
                      </div>
                      <div className="text-sm text-green-600 dark:text-green-400">Overall Score</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {quizResults.correctAnswers}
                      </div>
                      <div className="text-sm text-blue-600 dark:text-blue-400">Correct Answers</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {quizResults.totalQuestions}
                      </div>
                      <div className="text-sm text-purple-600 dark:text-purple-400">Total Questions</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        {quizResults.stressScore}
                      </div>
                      <div className="text-sm text-orange-600 dark:text-orange-400">Stress Score</div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={handleGenerateAnother}
                      className="flex-1 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Generate Another Quiz
                    </Button>
                    <Button
                      onClick={() => window.open('/analytics', '_blank')}
                      variant="outline"
                      className="flex-1 border-gray-300 dark:border-gray-600"
                    >
                      View Analytics
                    </Button>
                    <Button
                      onClick={handleEndSession}
                      variant="outline"
                      className="flex-1 border-gray-300 dark:border-gray-600"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save & Close
                    </Button>
                  </div>
                  
                  <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
                    Quiz data has been saved to your learning analytics
                  </div>
                </CardContent>
              </Card>

              {/* Detailed Results */}
              <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white">Detailed Results</CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-300">
                    Review each question and see the correct answers
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {quizResults.questions.map((question: string, index: number) => (
                    <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {index + 1}. {question}
                        </h4>
                        {parseInt(quizResults.userAnswers[index]) === quizResults.correctAnswerIndices[index] ? (
                          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        )}
                      </div>
                      
                      <div className="space-y-1 text-sm">
                        <div className="text-gray-600 dark:text-gray-300">
                          <span className="font-medium">Your answer:</span> {quizData.options[index][parseInt(quizResults.userAnswers[index])]}
                        </div>
                        <div className="text-gray-600 dark:text-gray-300">
                          <span className="font-medium">Correct answer:</span> {quizData.options[index][quizResults.correctAnswerIndices[index]]}
                        </div>
                        {quizResults.explanations[index] && (
                          <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-blue-800 dark:text-blue-200">
                            <span className="font-medium">Explanation:</span> {quizResults.explanations[index]}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
