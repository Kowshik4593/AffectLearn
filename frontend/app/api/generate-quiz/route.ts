import { NextRequest, NextResponse } from 'next/server'

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { topic, difficulty, questionCount } = body

    logOperation('API: Quiz generation request received', { topic, difficulty, questionCount })

    // Validate input
    if (!topic || !topic.trim()) {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 })
    }

    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return NextResponse.json({ error: 'Invalid difficulty level' }, { status: 400 })
    }

    if (!questionCount || questionCount < 1 || questionCount > 15) {
      return NextResponse.json({ error: 'Question count must be between 1 and 15' }, { status: 400 })
    }

    // Generate quiz using Groq
    const quiz = await generateQuizWithGroq(topic.trim(), difficulty, questionCount)
    
    logOperation('API: Quiz generated successfully', { 
      topic: quiz.topic,
      difficulty: quiz.difficulty,
      questionCount: quiz.questions.length
    })

    return NextResponse.json(quiz)
  } catch (error) {
    logOperation('API: Error generating quiz', null, error)
    return NextResponse.json(
      { error: 'Failed to generate quiz. Please try again.' },
      { status: 500 }
    )
  }
}

async function generateQuizWithGroq(topic: string, difficulty: string, questionCount: number) {
  const GROQ_API_KEY = process.env.GROQ_API_KEY
  
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY environment variable is not set')
  }

  const prompt = `Generate a ${difficulty} difficulty quiz about "${topic}" with exactly ${questionCount} multiple choice questions.

Format your response as a valid JSON object with this exact structure:
{
  "topic": "${topic}",
  "difficulty": "${difficulty}",
  "questions": [array of question strings],
  "options": [array of arrays, each containing 4 option strings],
  "correct_answers": [array of numbers 0-3 indicating correct option index],
  "explanations": [array of explanation strings for each question]
}

IMPORTANT REQUIREMENTS:
- Each question should be clear and educational
- Each question should have exactly 4 multiple choice options (A, B, C, D)
- Only one option should be correct per question
- correct_answers MUST be 0-based indices: 0 = first option, 1 = second option, 2 = third option, 3 = fourth option
- NEVER use indices 1, 2, 3, 4 - ALWAYS use 0, 1, 2, 3
- Provide detailed explanations for why each answer is correct
- Make sure the JSON is valid and properly formatted
- Questions should be appropriate for ${difficulty} level

Example format:
{
  "topic": "JavaScript",
  "difficulty": "medium",
  "questions": ["What is a closure in JavaScript?"],
  "options": [["A function that returns another function", "A variable that stores functions", "A way to close browser windows", "A method to end loops"]],
  "correct_answers": [0],
  "explanations": ["A closure is a function that has access to variables in its outer (enclosing) scope even after the outer function has returned."]
}`

  try {
    logOperation('API: Calling Groq API for quiz generation', { topic, difficulty, questionCount })
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mistral-saba-24b',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      logOperation('API: Groq API error', { status: response.status, errorText })
      throw new Error(`Groq API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No content received from Groq API')
    }

    logOperation('API: Groq API response received', { contentLength: content.length })

    // Parse the JSON response
    let quiz
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }
      
      quiz = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      logOperation('API: Error parsing JSON from Groq', { content, parseError })
      throw new Error('Failed to parse quiz JSON from AI response')
    }

    // Validate the quiz structure
    if (!quiz.questions || !Array.isArray(quiz.questions) || quiz.questions.length !== questionCount) {
      throw new Error('Invalid quiz structure: incorrect questions array')
    }

    if (!quiz.options || !Array.isArray(quiz.options) || quiz.options.length !== questionCount) {
      throw new Error('Invalid quiz structure: incorrect options array')
    }

    if (!quiz.correct_answers || !Array.isArray(quiz.correct_answers) || quiz.correct_answers.length !== questionCount) {
      throw new Error('Invalid quiz structure: incorrect correct_answers array')
    }

    if (!quiz.explanations || !Array.isArray(quiz.explanations) || quiz.explanations.length !== questionCount) {
      throw new Error('Invalid quiz structure: incorrect explanations array')
    }

    // Validate each question's options and correct the answer indices if needed
    for (let i = 0; i < questionCount; i++) {
      if (!Array.isArray(quiz.options[i]) || quiz.options[i].length !== 4) {
        throw new Error(`Question ${i + 1} does not have exactly 4 options`)
      }
      
      let correctAnswer = quiz.correct_answers[i]
      
      // Handle common AI mistakes with answer indices
      if (typeof correctAnswer === 'number') {
        // If AI returns 1-4 (thinking 1-based), convert to 0-3 (0-based)
        if (correctAnswer >= 1 && correctAnswer <= 4) {
          const adjustedAnswer = correctAnswer - 1
          logOperation('API: Converting 1-based to 0-based index', { 
            question: i + 1, 
            originalIndex: correctAnswer, 
            adjustedIndex: adjustedAnswer 
          })
          correctAnswer = adjustedAnswer
          quiz.correct_answers[i] = adjustedAnswer
        }
        // If somehow it's out of bounds, clamp it
        else if (correctAnswer > 3) {
          logOperation('API: Clamping out-of-bounds answer index', { 
            question: i + 1, 
            originalIndex: correctAnswer, 
            clampedIndex: 3 
          })
          correctAnswer = 3
          quiz.correct_answers[i] = 3
        }
        else if (correctAnswer < 0) {
          logOperation('API: Clamping negative answer index', { 
            question: i + 1, 
            originalIndex: correctAnswer, 
            clampedIndex: 0 
          })
          correctAnswer = 0
          quiz.correct_answers[i] = 0
        }
      }
      
      // Final validation
      if (typeof correctAnswer !== 'number' || correctAnswer < 0 || correctAnswer > 3) {
        throw new Error(`Question ${i + 1} has invalid correct answer index: ${correctAnswer}`)
      }
    }

    logOperation('API: Quiz validation and correction completed', { 
      questionsCount: quiz.questions.length,
      correctedAnswers: quiz.correct_answers,
      topic: quiz.topic,
      difficulty: quiz.difficulty
    })

    return quiz
  } catch (error) {
    logOperation('API: Error in generateQuizWithGroq', null, error)
    throw error
  }
}
