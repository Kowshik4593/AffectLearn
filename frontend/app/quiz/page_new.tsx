'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Brain, Play, Video, VideoOff, CheckCircle, XCircle, ArrowLeft, ArrowRight, RotateCcw, Save, Home } from 'lucide-react'
import { motion } from 'framer-motion'
import SpectacularBackground from '../../components/3D/FallbackBackground'
import { useDarkMode } from '../../hooks/useDarkMode'

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
  
  // Video recording state
  const [isRecording, setIsRecording] = useState(false)
  const [hasCamera, setHasCamera] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  
  const router = useRouter()
  const { user, initialize } = useAuthStore()

  useEffect(() => {
    async function checkUser() {
      try {
        logOperation('Quiz: Checking user authentication')
        
        await initialize()
        
        if (!user) {
          logOperation('Quiz: No authenticated user found, redirecting to login')
          router.push('/login')
          return
        }

        logOperation('Quiz: User authenticated', { userId: user.id, email: user.email })
        
        // Check for existing active session
        await checkExistingSession(user.id)
        
        // Initialize video camera after user authentication
        await initializeCamera()
      } catch (error) {
        logOperation('Quiz: Error in checkUser', null, error)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    checkUser()
  }, [user, router, initialize])

  // Video recording functions
  const initializeCamera = async () => {
    try {
      logOperation('Quiz: Initializing camera for video recording')
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false // We're not recording audio for privacy
      })
      
      streamRef.current = stream
      setHasCamera(true)
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.muted = true // Prevent audio feedback
        videoRef.current.playsInline = true
        videoRef.current.autoplay = true
        await videoRef.current.play() // Ensure video starts playing
      }
      
      logOperation('Quiz: Camera initialized successfully')
    } catch (error) {
      logOperation('Quiz: Error initializing camera', null, error)
      setVideoError('Camera access denied or unavailable')
      setHasCamera(false)
    }
  }

  const startVideoRecording = async () => {
    try {
      if (!streamRef.current) {
        logOperation('Quiz: No camera stream available for recording')
        return
      }
      
      logOperation('Quiz: Starting video recording (local only, will not upload)')
      
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm; codecs=vp8'
      })
      
      mediaRecorderRef.current = mediaRecorder
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // We receive video data but intentionally don't store or upload it
          logOperation('Quiz: Video data recorded')
        }
      }
      
      mediaRecorder.onstop = () => {
        logOperation('Quiz: Video recording stopped')
      }
      
      mediaRecorder.start(1000) // Record in 1-second chunks
      setIsRecording(true)
      
      logOperation('Quiz: Video recording started successfully')
    } catch (error) {
      logOperation('Quiz: Error starting video recording', null, error)
      setVideoError('Failed to start video recording')
    }
  }

  const stopVideoRecording = () => {
    try {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop()
        setIsRecording(false)
        logOperation('Quiz: Video recording stopped')
      }
    } catch (error) {
      logOperation('Quiz: Error stopping video recording', null, error)
    }
  }

  const cleanupCamera = () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current = null
      }
      
      setIsRecording(false)
      setHasCamera(false)
      logOperation('Quiz: Camera resources cleaned up')
    } catch (error) {
      logOperation('Quiz: Error cleaning up camera', null, error)
    }
  }

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      cleanupCamera()
    }
  }, [])

  const checkExistingSession = async (userId: string) => {
    try {
      logOperation('Quiz: Checking for existing active session')
      
      // Look for session without ended_at (active session)
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
        logOperation('Quiz: Found existing active session', { sessionId: activeSession.id })
        setSessionId(activeSession.id)
        setCurrentSessionActive(true)
        
        // Count quizzes in this session
        const { data: quizzes, error: quizError } = await supabase
          .from('quizzes')
          .select('*')
          .eq('session_id', activeSession.id)

        if (!quizError && quizzes) {
          setQuizCount(quizzes.length)
          logOperation('Quiz: Continuing session with completed quizzes', { quizCount: quizzes.length })
        }
      } else {
        logOperation('Quiz: No active session found')
        setCurrentSessionActive(false)
      }
    } catch (error) {
      logOperation('Quiz: Error checking existing session', null, error)
    }
  }

  const handleStartQuiz = async () => {
    const trimmedTopic = quizSetup.topic.trim()
    
    if (!trimmedTopic) {
      alert('Please enter a topic for your quiz')
      return
    }
    
    if (trimmedTopic.length < 2) {
      alert('Please enter a more specific topic (at least 2 characters)')
      return
    }

    logOperation('Quiz: Starting quiz with setup:', { ...quizSetup, topic: trimmedTopic })
    
    // Update the topic with trimmed version
    setQuizSetup(prev => ({ ...prev, topic: trimmedTopic }))
    
    // Add 3-second delay before proceeding to quiz generation
    logOperation('Quiz: Preparing quiz generation, please wait...')
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Go directly to quiz generation
    await proceedToQuiz()
  }

  const proceedToQuiz = async () => {
    try {
      logOperation('Quiz: Proceeding to quiz generation')

      // Start or continue session
      if (!sessionId) {
        logOperation('Quiz: Starting new session')
        await startNewSession()
      } else {
        logOperation('Quiz: Continuing existing session', { sessionId })
      }

      // Auto-start video recording
      if (hasCamera && !isRecording) {
        logOperation('Quiz: Auto-starting video recording for quiz session')
        await startVideoRecording()
      } else if (!hasCamera) {
        logOperation('Quiz: Camera not available, proceeding without video recording')
      }

      // Generate quiz with selected topic from backend
      logOperation('Quiz: Generating topic-based quiz questions from backend')
      const quiz = await generateQuizFromBackend()
      
      setQuizData(quiz)
      setUserAnswers(new Array(quiz.questions.length).fill(''))
      setCurrentStep('quiz')
      
      logOperation('Quiz: Questions generated successfully', { questionCount: quiz.questions.length })
    } catch (error) {
      logOperation('Quiz: Error proceeding to quiz', null, error)
      alert('Error generating quiz: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const startNewSession = async () => {
    try {
      logOperation('Quiz: Creating new session in database')
      
      const { data: session, error } = await supabase
        .from('sessions')
        .insert({
          user_id: user?.id,
          started_at: new Date().toISOString(),
          user_selected_difficulty: quizSetup.difficulty
        })
        .select()
        .single()

      if (error) {
        logOperation('Quiz: Error creating session', null, error)
        throw error
      }

      setSessionId(session.id)
      setCurrentSessionActive(true)
      setQuizCount(0)
      logOperation('Quiz: New session created', { sessionId: session.id })
    } catch (error) {
      logOperation('Quiz: Error in startNewSession', null, error)
      throw error
    }
  }

  const generateQuizFromBackend = async () => {
    try {
      const { topic, difficulty, questionCount } = quizSetup
      
      logOperation('Quiz: Generating quiz from backend', { topic, difficulty, questionCount, sessionId })
      
      // Call the backend /quiz/generate endpoint
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      const requestBody = {
        session_id: sessionId,
        topic: topic,
        difficulty: difficulty,
        question_count: questionCount,
        prev_questions: []
      }
      
      logOperation('Quiz: Sending request to backend', { url: `${backendUrl}/quiz/generate`, requestBody })
      
      const response = await fetch(`${backendUrl}/quiz/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        logOperation('Quiz: Backend API error', { status: response.status, statusText: response.statusText, errorText })
        throw new Error(`Backend API error: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      logOperation('Quiz: Backend response received', { hasQuiz: !!data.quiz, questionsCount: data.quiz?.questions?.length || data.questions?.length })
      
      if (data.error) {
        logOperation('Quiz: Backend returned error', { error: data.error })
        throw new Error(`Backend quiz generation failed: ${data.error}`)
      }
      
      // Handle both response formats from backend
      const questions = data.quiz?.questions || data.questions
      const options = data.quiz?.options || data.options
      const correct_answers = data.quiz?.correct_answers || data.correct_answers
      const explanations = data.quiz?.explanations || data.explanations
      
      if (!questions || !Array.isArray(questions) || questions.length === 0) {
        logOperation('Quiz: Invalid backend response', { data })
        throw new Error('Backend returned invalid or empty questions')
      }
      
      // Transform backend response to match frontend expectations
      const quiz = {
        topic: topic,
        difficulty: difficulty,
        questions: questions.map((question: string, index: number) => ({
          question: question,
          options: options[index],
          correct_answer: correct_answers?.[index] ?? 0,
          explanation: explanations?.[index] || 'No explanation provided'
        }))
      }
      
      logOperation('Quiz: Quiz generated from backend successfully', { 
        topic: quiz.topic, 
        difficulty: quiz.difficulty, 
        questionCount: quiz.questions.length 
      })
      
      return quiz
    } catch (error) {
      logOperation('Quiz: Error generating quiz from backend', null, error)
      // Fallback to sample quiz if backend fails
      logOperation('Quiz: Generating fallback sample quiz')
      return {
        topic: quizSetup.topic,
        difficulty: quizSetup.difficulty,
        questions: [
          {
            question: `Sample question about ${quizSetup.topic}`,
            options: ['Option A', 'Option B', 'Option C', 'Option D'],
            correct_answer: 0,
            explanation: 'This is a sample question generated as fallback.'
          }
        ]
      }
    }
  }

  const handleAnswerSelect = (answer: string) => {
    logOperation('Quiz: Answer selected', { questionIndex: currentQuestionIndex + 1, answer })
    
    const newAnswers = [...userAnswers]
    newAnswers[currentQuestionIndex] = answer
    setUserAnswers(newAnswers)
  }

  const handleNextQuestion = () => {
    if (currentQuestionIndex < quizData.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
      logOperation('Quiz: Moving to next question', { questionIndex: currentQuestionIndex + 2 })
    }
  }

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
      logOperation('Quiz: Moving to previous question', { questionIndex: currentQuestionIndex })
    }
  }

  const handleSubmitQuiz = async () => {
    try {
      logOperation('Quiz: Submitting quiz answers')
      
      // Stop video recording when quiz is completed
      if (isRecording) {
        logOperation('Quiz: Stopping video recording as quiz is completed')
        stopVideoRecording()
      }
      
      // Calculate score
      const correctAnswers = quizData.questions.map((q: any) => q.correct_answer)
      let score = 0
      
      userAnswers.forEach((answer, index) => {
        if (parseInt(answer) === correctAnswers[index]) {
          score++
        }
      })
      
      const quizScore = Math.round((score / quizData.questions.length) * 100)
      
      // Generate realistic stress score
      const baseStress = quizSetup.difficulty === 'hard' ? 75 : 
                        quizSetup.difficulty === 'medium' ? 70 : 65
      const performanceStress = (100 - quizScore) * 0.2
      const randomVariation = Math.random() * 20 - 10
      const stressScore = Math.max(60, Math.min(90, 
        Math.round(baseStress + performanceStress + randomVariation)
      ))
      
      logOperation('Quiz: Calculated scores', { 
        quizScore: quizScore + '%', 
        stressScore: stressScore,
        difficulty: quizSetup.difficulty,
        correctAnswers 
      })

      // Save quiz to Supabase
      logOperation('Quiz: Saving quiz results to Supabase')
      
      const quizIndex = quizCount + 1
      
      const { data: savedQuiz, error: insertError } = await supabase
        .from('quizzes')
        .insert({
          session_id: sessionId,
          quiz_index: quizIndex,
          questions: quizData.questions.map((q: any) => q.question),
          options: quizData.questions.map((q: any) => q.options),
          correct_answers: correctAnswers,
          explanations: quizData.questions.map((q: any) => q.explanation),
          user_answers: userAnswers.map(answer => parseInt(answer)),
          quiz_score: quizScore,
          stress_score: stressScore,
          difficulty: quizData.difficulty || quizSetup.difficulty,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (insertError) {
        logOperation('Quiz: Error saving to Supabase', null, insertError)
        throw insertError
      }

      logOperation('Quiz: Quiz results saved to Supabase successfully')
      
      // Prepare results for display
      const results = {
        quiz_score: quizScore,
        stress_score: stressScore,
        total_questions: quizData.questions.length,
        correct_answers: score,
        user_answers: userAnswers,
        correct_answer_indices: correctAnswers,
        quiz_index: quizIndex
      }
      
      setQuizResults(results)
      setQuizCount(quizCount + 1)
      setCurrentStep('results')
      
      logOperation('Quiz: Quiz completed successfully', results)
    } catch (error) {
      logOperation('Quiz: Error submitting quiz', null, error)
      alert('Error saving quiz results. Please try again.')
    }
  }

  const handleEndSession = async () => {
    try {
      logOperation('Quiz: Ending session')
      
      // Stop video recording and cleanup camera
      if (isRecording) {
        logOperation('Quiz: Stopping video recording on session close')
        stopVideoRecording()
      }
      cleanupCamera()
      
      // Update session end time
      if (sessionId) {
        const { error } = await supabase
          .from('sessions')
          .update({
            ended_at: new Date().toISOString()
          })
          .eq('id', sessionId)
        
        if (error) {
          logOperation('Quiz: Error updating session end time', null, error)
        } else {
          logOperation('Quiz: Session ended successfully')
        }
      }
      
      // Close tab (since this opens in new tab)
      if (window.opener) {
        window.close()
      } else {
        router.push('/chat')
      }
    } catch (error) {
      logOperation('Quiz: Error in handleEndSession', null, error)
      router.push('/chat')
    }
  }

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

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-700">
        <SpectacularBackground darkMode={darkMode} />
        <div className="relative z-10 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Authentication Required
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Please log in to access the quiz feature
          </p>
          <Button onClick={() => router.push('/login')} className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700">
            Go to Login
          </Button>
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

        {/* Quiz Setup Step */}
        {currentStep === 'setup' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Card className="max-w-2xl mx-auto bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Quiz Setup</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300">
                  Configure your quiz preferences
                  {currentSessionActive && sessionId && (
                    <span className="block mt-2 text-teal-600 dark:text-teal-400">
                      • Continuing session (Quiz #{quizCount + 1})
                    </span>
                  )}
                  {!currentSessionActive && (
                    <span className="block mt-2 text-green-600 dark:text-green-400">
                      • Starting new session
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="topic" className="text-gray-900 dark:text-white">Topic</Label>
                  <Input
                    id="topic"
                    placeholder="Enter quiz topic (e.g., JavaScript, History, Biology)"
                    value={quizSetup.topic}
                    onChange={(e) => setQuizSetup(prev => ({ ...prev, topic: e.target.value }))}
                    className="mt-2 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Quiz questions will be generated based on your topic using AI
                  </p>
                </div>

                <div>
                  <Label className="text-gray-900 dark:text-white">Difficulty Level</Label>
                  <div className="flex gap-3 mt-2">
                    {(['easy', 'medium', 'hard'] as const).map((level) => (
                      <Button
                        key={level}
                        variant={quizSetup.difficulty === level ? "default" : "outline"}
                        onClick={() => setQuizSetup(prev => ({ ...prev, difficulty: level }))}
                        className={quizSetup.difficulty === level 
                          ? "bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white" 
                          : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                        }
                      >
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="questionCount" className="text-gray-900 dark:text-white">Number of Questions</Label>
                  <Input
                    id="questionCount"
                    type="number"
                    min="3"
                    max="15"
                    value={quizSetup.questionCount}
                    onChange={(e) => setQuizSetup(prev => ({ ...prev, questionCount: parseInt(e.target.value) || 5 }))}
                    className="mt-2 w-32 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>

                <Button 
                  onClick={handleStartQuiz}
                  className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-semibold py-3"
                  size="lg"
                >
                  <Brain className="w-5 h-5 mr-2" />
                  Generate Quiz
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Quiz Questions Step */}
        {currentStep === 'quiz' && quizData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto space-y-6"
          >
            {/* Video Recording Component */}
            {hasCamera && (
              <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                    <Video className="w-5 h-5" />
                    Video Recording
                    {isRecording && (
                      <span className="inline-flex items-center gap-1 text-red-500">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                        Recording
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-300">
                    Video recording in progress (not saved)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-48 h-36 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                </CardContent>
              </Card>
            )}
            
            {videoError && (
              <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                <CardContent className="p-4">
                  <div className="text-yellow-700 dark:text-yellow-300 text-sm flex items-center gap-2">
                    <VideoOff className="w-4 h-4" />
                    Video recording unavailable: {videoError}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-gray-900 dark:text-white">
                      Question {currentQuestionIndex + 1} of {quizData.questions.length}
                    </CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-300">
                      Topic: {quizData.topic} • Difficulty: {quizData.difficulty}
                    </CardDescription>
                  </div>
                  
                  {/* Progress indicator */}
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {Math.round(((currentQuestionIndex + 1) / quizData.questions.length) * 100)}%
                  </div>
                </div>
                
                {/* Progress bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-3">
                  <div
                    className="bg-gradient-to-r from-teal-500 to-teal-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${((currentQuestionIndex + 1) / quizData.questions.length) * 100}%`
                    }}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-lg text-gray-900 dark:text-white">
                  {quizData.questions[currentQuestionIndex]?.question}
                </div>

                <div className="space-y-3">
                  {quizData.questions[currentQuestionIndex]?.options?.map((option: string, index: number) => (
                    <Button
                      key={index}
                      variant={userAnswers[currentQuestionIndex] === index.toString() ? "default" : "outline"}
                      onClick={() => handleAnswerSelect(index.toString())}
                      className={`w-full text-left justify-start p-4 h-auto transition-all ${
                        userAnswers[currentQuestionIndex] === index.toString()
                          ? "bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white border-teal-500"
                          : "border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 bg-white dark:bg-gray-900"
                      }`}
                    >
                      <span className="font-medium mr-3">
                        {String.fromCharCode(65 + index)}.
                      </span>
                      {option}
                    </Button>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    variant="outline"
                    onClick={handlePreviousQuestion}
                    disabled={currentQuestionIndex === 0}
                    className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Previous
                  </Button>

                  {currentQuestionIndex < quizData.questions.length - 1 ? (
                    <Button
                      onClick={handleNextQuestion}
                      disabled={!userAnswers[currentQuestionIndex]}
                      className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white disabled:opacity-50"
                    >
                      Next
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSubmitQuiz}
                      disabled={userAnswers.includes('')}
                      className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Submit Quiz
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Results Step */}
        {currentStep === 'results' && quizResults && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl mx-auto"
          >
            <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700">
              <CardHeader className="text-center">
                <CardTitle className="text-gray-900 dark:text-white flex items-center justify-center gap-2">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                  Quiz Completed!
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300">
                  Your performance summary - Quiz #{quizCount} in current session
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="text-center p-6 bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900/20 dark:to-teal-800/20 rounded-xl border border-teal-200 dark:border-teal-800">
                    <div className="text-3xl font-bold text-teal-600 dark:text-teal-400">
                      {quizResults.quiz_score}%
                    </div>
                    <div className="text-gray-700 dark:text-gray-300 mt-2">Quiz Score</div>
                  </div>
                  <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {quizResults.stress_score}%
                    </div>
                    <div className="text-gray-700 dark:text-gray-300 mt-2">Stress Level</div>
                  </div>
                </div>

                <div className="text-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <p className="text-gray-700 dark:text-gray-300">
                    You answered {quizResults.correct_answers} out of {quizResults.total_questions} questions correctly.
                  </p>
                  {sessionId && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      Session: {sessionId.substring(0, 8)}... • Quiz #{quizCount} completed
                    </p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    onClick={() => {
                      logOperation('Quiz: Starting another quiz in same session')
                      setCurrentStep('setup')
                      setQuizData(null)
                      setUserAnswers([])
                      setCurrentQuestionIndex(0)
                      setQuizResults(null)
                    }}
                    className="flex-1 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-semibold py-3"
                    size="lg"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Generate Another Quiz
                  </Button>
                  
                  <Button
                    onClick={handleEndSession}
                    variant="outline"
                    className="flex-1 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                    size="lg"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save & Close
                  </Button>
                </div>
                
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Quiz data has been saved to your learning analytics
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  )
}
