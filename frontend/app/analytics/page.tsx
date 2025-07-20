'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Trophy, Target, Brain, TrendingUp, BarChart3, ArrowLeft, Calendar, Eye, CheckCircle, XCircle } from 'lucide-react'

interface Quiz {
  id: string
  session_id: string
  topic?: string
  difficulty?: string
  score?: number
  quiz_score?: number
  stress_level?: number
  stress_score?: number
  questions?: string | any[]
  options?: string[][]
  correct_answers?: number[]
  user_answers?: number[]
  explanations?: string[]
  created_at: string
  session?: {
    user_id?: string
  }
  sentiment_score?: number
  sentiment_label?: string
}

interface QuizAnalytics {
  totalQuizzes: number
  averageScore: number
  averageStress: number
  difficultyDistribution: Record<string, number>
  sentimentDistribution: Record<string, number>
}

const logOperation = (operation: string, data?: any, error?: any) => {
  console.log(`[Analytics] ${operation}`, data, error)
}

export default function AnalyticsPage() {
  const router = useRouter()
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [analytics, setAnalytics] = useState<QuizAnalytics | null>(null)
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [alertDialog, setAlertDialog] = useState<{
    open: boolean
    title: string
    description: string
  }>({
    open: false,
    title: '',
    description: '',
  })

  const showAlert = (title: string, description: string) => {
    logOperation('Alert shown', { title, description })
    setAlertDialog({ open: true, title, description })
  }

  // Fetch quiz data for specific user (with debugging)
  useEffect(() => {
    const fetchQuizData = async () => {
      setIsLoading(true)
      const userId = "24b8f4fc-d76f-448a-b8be-993c5baefbc5"
      const sessionId = "ed8c0ffa-21f2-4dfb-938e-8cdf7baa3384"
      
      logOperation('Fetching quiz data for specific user', { userId, sessionId })

      try {
        // First, let's see what tables exist
        const { data: tablesData, error: tablesError } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public')

        if (!tablesError) {
          logOperation('Available tables', tablesData)
        }

        // Try to get quizzes for this specific session first
        const { data: quizzesData, error: quizzesError } = await supabase
          .from('quizzes')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false })

        logOperation('Quizzes query result', { data: quizzesData, error: quizzesError })

        // If no data for specific session, try to get all quizzes to see structure
        if (!quizzesData || quizzesData.length === 0) {
          const { data: allQuizzesData, error: allQuizzesError } = await supabase
            .from('quizzes')
            .select('*')
            .limit(10)
            .order('created_at', { ascending: false })

          logOperation('All quizzes sample', { data: allQuizzesData, error: allQuizzesError })

          if (!allQuizzesData || allQuizzesData.length === 0) {
            // Check if table exists with different name
            const { data: alternativeQuizzes, error: altError } = await supabase
              .from('quiz_sessions')
              .select('*')
              .limit(5)

            logOperation('Alternative quiz table check', { data: alternativeQuizzes, error: altError })

            // Set empty state with debug info
            setQuizzes([])
            setAnalytics({
              totalQuizzes: 0,
              averageScore: 0,
              averageStress: 0,
              difficultyDistribution: {},
              sentimentDistribution: {}
            })
            setIsLoading(false)
            return
          }

          // Use all quizzes if no specific session data
          setQuizzes(allQuizzesData || [])
          
          // Calculate basic analytics from all data
          const analyticsData: QuizAnalytics = {
            totalQuizzes: allQuizzesData?.length || 0,
            averageScore: allQuizzesData?.length ? 
              allQuizzesData.reduce((sum, q) => sum + (q.score || q.quiz_score || 0), 0) / allQuizzesData.length : 0,
            averageStress: allQuizzesData?.length ? 
              allQuizzesData.reduce((sum, q) => sum + (q.stress_level || q.stress_score || 0), 0) / allQuizzesData.length : 0,
            difficultyDistribution: (allQuizzesData || []).reduce((acc, q) => {
              const difficulty = q.difficulty || 'Unknown'
              acc[difficulty] = (acc[difficulty] || 0) + 1
              return acc
            }, {} as Record<string, number>),
            sentimentDistribution: (allQuizzesData || []).reduce((acc, q) => {
              const sentiment = q.sentiment_label || 'NEUTRAL'
              acc[sentiment] = (acc[sentiment] || 0) + 1
              return acc
            }, {} as Record<string, number>)
          }

          setAnalytics(analyticsData)
          setIsLoading(false)
          return
        }

        // Get sentiment data for the sessions
        const { data: queriesData, error: queriesError } = await supabase
          .from('queries')
          .select('session_id, sentiment_score, sentiment_label')
          .eq('session_id', sessionId)

        logOperation('Queries data', { data: queriesData, error: queriesError })

        // Get session data
        const { data: sessionData, error: sessionError } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', sessionId)
          .single()

        logOperation('Session data', { data: sessionData, error: sessionError })

        // Process the quiz data
        const enrichedQuizzes = (quizzesData || []).map(quiz => {
          const sentiment = queriesData?.find(q => q.session_id === quiz.session_id)
          return {
            ...quiz,
            session: sessionData,
            sentiment_score: sentiment?.sentiment_score || null,
            sentiment_label: sentiment?.sentiment_label || 'NEUTRAL'
          }
        })

        // Calculate analytics
        const validQuizzes = enrichedQuizzes.filter(q => (q.score || q.quiz_score) !== null && (q.score || q.quiz_score) !== undefined)
        const validStressQuizzes = enrichedQuizzes.filter(q => (q.stress_level || q.stress_score) !== null && (q.stress_level || q.stress_score) !== undefined)

        const analyticsData: QuizAnalytics = {
          totalQuizzes: enrichedQuizzes.length,
          averageScore: validQuizzes.length > 0 
            ? validQuizzes.reduce((sum, q) => sum + (q.score || q.quiz_score || 0), 0) / validQuizzes.length 
            : 0,
          averageStress: validStressQuizzes.length > 0
            ? validStressQuizzes.reduce((sum, q) => sum + (q.stress_level || q.stress_score || 0), 0) / validStressQuizzes.length
            : 0,
          difficultyDistribution: enrichedQuizzes.reduce((acc, q) => {
            const difficulty = q.difficulty || 'Unknown'
            acc[difficulty] = (acc[difficulty] || 0) + 1
            return acc
          }, {} as Record<string, number>),
          sentimentDistribution: enrichedQuizzes.reduce((acc, q) => {
            const sentiment = q.sentiment_label || 'NEUTRAL'
            acc[sentiment] = (acc[sentiment] || 0) + 1
            return acc
          }, {} as Record<string, number>)
        }

        logOperation('Final analytics calculated', analyticsData)
        
        setQuizzes(enrichedQuizzes)
        setAnalytics(analyticsData)

      } catch (error: any) {
        logOperation('Failed to fetch quiz data', null, error)
        showAlert('Error', `Failed to load quiz data: ${error.message}`)
      } finally {
        setIsLoading(false)
      }
    }

    fetchQuizData()
  }, [])

  const handleQuizClick = (quiz: Quiz) => {
    logOperation('Quiz row clicked', { quizId: quiz.id, sessionId: quiz.session_id })
    setSelectedQuiz(quiz)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 'text-green-600 bg-green-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'hard': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment?.toUpperCase()) {
      case 'POSITIVE': return 'text-green-600'
      case 'NEGATIVE': return 'text-red-600'
      case 'NEUTRAL': return 'text-gray-600'
      default: return 'text-gray-600'
    }
  }

  // Chart data preparation
  const difficultyChartData = analytics ? Object.entries(analytics.difficultyDistribution).map(([key, value]) => ({
    name: key,
    count: value
  })) : []

  const sentimentChartData = analytics ? Object.entries(analytics.sentimentDistribution).map(([key, value]) => ({
    name: key,
    count: value
  })) : []

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading analytics...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
              <p className="text-gray-600">Comprehensive insights into quiz performance across all users</p>
            </div>
            <Button onClick={() => router.push('/chat')} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Chat
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Debug Information */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Debug Information</h3>
          <div className="text-sm text-blue-700">
            <p>User ID: 24b8f4fc-d76f-448a-b8be-993c5baefbc5</p>
            <p>Session ID: ed8c0ffa-21f2-4dfb-938e-8cdf7baa3384</p>
            <p>Quizzes found: {quizzes.length}</p>
            <p>Check browser console for detailed logs</p>
            {quizzes.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer font-medium">Sample Quiz Data Structure</summary>
                <pre className="mt-2 text-xs bg-white p-2 rounded border overflow-auto">
                  {JSON.stringify(quizzes[0], null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Trophy className="w-8 h-8 text-blue-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Quizzes</dt>
                      <dd className="text-lg font-medium text-gray-900">{analytics.totalQuizzes}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Target className="w-8 h-8 text-green-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Average Score</dt>
                      <dd className="text-lg font-medium text-gray-900">{analytics.averageScore.toFixed(1)}%</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Brain className="w-8 h-8 text-orange-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Average Stress</dt>
                      <dd className="text-lg font-medium text-gray-900">{analytics.averageStress.toFixed(1)}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <TrendingUp className="w-8 h-8 text-purple-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Performance</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {analytics.averageScore >= 80 ? 'Excellent' : 
                         analytics.averageScore >= 60 ? 'Good' : 'Needs Improvement'}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Charts */}
        {analytics && (difficultyChartData.length > 0 || sentimentChartData.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Difficulty Distribution */}
            {difficultyChartData.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2" />
                  Quiz Difficulty Distribution
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={difficultyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Sentiment Distribution */}
            {sentimentChartData.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Brain className="w-5 h-5 mr-2" />
                  Sentiment Distribution
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={sentimentChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {sentimentChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Quiz History Table */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              All Quiz Sessions ({quizzes.length} total)
            </h3>
            <p className="text-gray-600">Complete history of all quiz sessions from all users</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-6 font-medium text-gray-600">Date</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-600">User</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-600">Topic</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-600">Difficulty</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-600">Score</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-600">Stress</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-600">Sentiment</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {quizzes.map((quiz) => (
                  <tr 
                    key={quiz.id} 
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => handleQuizClick(quiz)}
                  >
                    <td className="py-3 px-6 text-gray-900">
                      {formatDate(quiz.created_at)}
                    </td>
                    <td className="py-3 px-6 text-gray-900">
                      {quiz.session?.user_id?.slice(0, 8) || 'Unknown'}...
                    </td>
                    <td className="py-3 px-6 text-gray-900">
                      {quiz.topic || 'General'}
                    </td>
                    <td className="py-3 px-6">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(quiz.difficulty)}`}>
                        {quiz.difficulty || 'Unknown'}
                      </span>
                    </td>
                    <td className="py-3 px-6 font-medium text-gray-900">
                      {(quiz.score !== null && quiz.score !== undefined) ? `${quiz.score}%` : 
                       (quiz.quiz_score !== null && quiz.quiz_score !== undefined) ? `${quiz.quiz_score}%` : 'N/A'}
                    </td>
                    <td className="py-3 px-6 text-gray-900">
                      {(quiz.stress_level !== null && quiz.stress_level !== undefined) ? quiz.stress_level.toFixed(1) : 
                       (quiz.stress_score !== null && quiz.stress_score !== undefined) ? quiz.stress_score.toFixed(1) : 'N/A'}
                    </td>
                    <td className="py-3 px-6">
                      <span className={`font-medium ${getSentimentColor(quiz.sentiment_label)}`}>
                        {quiz.sentiment_label || 'NEUTRAL'}
                      </span>
                    </td>
                    <td className="py-3 px-6">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleQuizClick(quiz)
                        }}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {quizzes.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No quiz sessions found.
            </div>
          )}
        </div>
      </div>

      {/* Quiz Details Dialog */}
      <Dialog open={!!selectedQuiz} onOpenChange={() => setSelectedQuiz(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Quiz Session Details</DialogTitle>
            <DialogDescription>
              {selectedQuiz && formatDate(selectedQuiz.created_at)}
            </DialogDescription>
          </DialogHeader>
          {selectedQuiz && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Topic</label>
                  <p className="text-gray-900">{selectedQuiz.topic || 'General'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Difficulty</label>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(selectedQuiz.difficulty)}`}>
                    {selectedQuiz.difficulty || 'Unknown'}
                  </span>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Score</label>
                  <p className="text-gray-900">
                    {(selectedQuiz.score !== null && selectedQuiz.score !== undefined) ? `${selectedQuiz.score}%` : 
                     (selectedQuiz.quiz_score !== null && selectedQuiz.quiz_score !== undefined) ? `${selectedQuiz.quiz_score}%` : 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Stress Level</label>
                  <p className="text-gray-900">
                    {(selectedQuiz.stress_level !== null && selectedQuiz.stress_level !== undefined) ? selectedQuiz.stress_level.toFixed(1) : 
                     (selectedQuiz.stress_score !== null && selectedQuiz.stress_score !== undefined) ? selectedQuiz.stress_score.toFixed(1) : 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Sentiment</label>
                  <span className={`font-medium ${getSentimentColor(selectedQuiz.sentiment_label)}`}>
                    {selectedQuiz.sentiment_label || 'NEUTRAL'}
                  </span>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Session ID</label>
                  <p className="text-gray-900 font-mono text-xs">{selectedQuiz.session_id}</p>
                </div>
              </div>
              {selectedQuiz.questions && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Questions</label>
                  <div className="mt-2 space-y-2">
                    {JSON.parse(selectedQuiz.questions).map((q: any, i: number) => (
                      <div key={i} className="p-3 bg-gray-50 rounded">
                        <p className="font-medium">{q.question}</p>
                        <p className="text-sm text-gray-600 mt-1">Your answer: {q.userAnswer}</p>
                        <p className="text-sm text-gray-600">Correct: {q.correctAnswer}</p>
                        <div className="flex items-center mt-1">
                          {q.isCorrect ? (
                            <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500 mr-1" />
                          )}
                          <span className={`text-xs ${q.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                            {q.isCorrect ? 'Correct' : 'Incorrect'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Alert Dialog */}
      <AlertDialog open={alertDialog.open} onOpenChange={(open) => setAlertDialog({ ...alertDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{alertDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAlertDialog({ ...alertDialog, open: false })}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}