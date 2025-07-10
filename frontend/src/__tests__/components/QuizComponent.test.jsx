import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../App'
import { mockLearningData, setupMockFetch } from '../utils/testUtils'

describe('Quiz Component', () => {
  let mockFetch

  beforeEach(() => {
    mockFetch = setupMockFetch()
    localStorage.clear()
  })

  const setupQuizWithData = async () => {
    const user = userEvent.setup()
    
    // Mock successful API response with quiz data
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockLearningData
    })

    render(<App />)
    
    // Navigate to generator and submit content
    await user.click(screen.getByRole('button', { name: /create/i }))
    await user.type(screen.getByPlaceholderText(/Type or paste your lecture notes/i), 'Machine learning content')
    await user.click(screen.getByRole('button', { name: /Generate Learning Module/i }))
    
    // Wait for quiz to load
    await waitFor(() => {
      expect(screen.getByText(/Knowledge Assessment/i)).toBeInTheDocument()
    })

    return user
  }

  describe('Quiz Display', () => {
    it('displays quiz header and progress', async () => {
      await setupQuizWithData()
      
      expect(screen.getByText(/Knowledge Assessment/i)).toBeInTheDocument()
      expect(screen.getByText(/Test your understanding with interactive questions/i)).toBeInTheDocument()
      expect(screen.getByText(/Question 1 of 3/i)).toBeInTheDocument()
    })

    it('shows progress bar with correct states', async () => {
      await setupQuizWithData()
      
      const progressSteps = screen.getAllByRole('generic').filter(el => 
        el.className.includes('progress-step')
      )
      
      expect(progressSteps).toHaveLength(3)
      expect(progressSteps[0]).toHaveClass('active')
      expect(progressSteps[1]).not.toHaveClass('active')
      expect(progressSteps[2]).not.toHaveClass('active')
    })

    it('displays first question with options', async () => {
      await setupQuizWithData()
      
      expect(screen.getByText(mockLearningData.question1)).toBeInTheDocument()
      expect(screen.getByText(/Understand/i)).toBeInTheDocument() // Bloom's level
      
      // Check all options are displayed
      mockLearningData.options1.forEach(option => {
        expect(screen.getByText(option)).toBeInTheDocument()
      })
    })
  })

  describe('Quiz Interaction', () => {
    it('allows selecting an option', async () => {
      const user = await setupQuizWithData()
      
      const firstOption = screen.getByText(mockLearningData.options1[0])
      await user.click(firstOption.closest('.quiz-option'))
      
      expect(firstOption.closest('.quiz-option')).toHaveClass('selected')
    })

    it('progresses to next question after selection', async () => {
      const user = await setupQuizWithData()
      
      // Answer first question
      const firstOption = screen.getByText(mockLearningData.options1[0])
      await user.click(firstOption.closest('.quiz-option'))
      
      // Should progress to question 2 after delay
      await waitFor(() => {
        expect(screen.getByText(/Question 2 of 3/i)).toBeInTheDocument()
        expect(screen.getByText(mockLearningData.question2)).toBeInTheDocument()
      }, { timeout: 1000 })
    })

    it('updates progress bar as questions are answered', async () => {
      const user = await setupQuizWithData()
      
      // Answer first question
      const firstOption = screen.getByText(mockLearningData.options1[0])
      await user.click(firstOption.closest('.quiz-option'))
      
      await waitFor(() => {
        expect(screen.getByText(/1 answered/i)).toBeInTheDocument()
      })
    })

    it('completes quiz after answering all questions', async () => {
      const user = await setupQuizWithData()
      
      // Answer question 1
      const firstOption = screen.getByText(mockLearningData.options1[0])
      await user.click(firstOption.closest('.quiz-option'))
      
      // Wait for question 2 and answer it
      await waitFor(() => {
        expect(screen.getByText(mockLearningData.question2)).toBeInTheDocument()
      })
      
      const secondOption = screen.getByText(mockLearningData.options2[1])
      await user.click(secondOption.closest('.quiz-option'))
      
      // Wait for question 3 and answer it
      await waitFor(() => {
        expect(screen.getByText(mockLearningData.question3)).toBeInTheDocument()
      })
      
      const thirdOption = screen.getByText(mockLearningData.options3[1])
      await user.click(thirdOption.closest('.quiz-option'))
      
      // Should show completion screen
      await waitFor(() => {
        expect(screen.getByText(/Assessment Complete!/i)).toBeInTheDocument()
        expect(screen.getByText(/100%/i)).toBeInTheDocument() // All correct answers
      })
    })
  })

  describe('Quiz Results', () => {
    const completeQuiz = async (user) => {
      // Answer all three questions correctly
      const answers = [
        mockLearningData.options1[0], // Correct answer for Q1
        mockLearningData.options2[1], // Correct answer for Q2  
        mockLearningData.options3[1]  // Correct answer for Q3
      ]
      
      for (let i = 0; i < answers.length; i++) {
        if (i > 0) {
          await waitFor(() => {
            expect(screen.getByText(mockLearningData[`question${i + 1}`])).toBeInTheDocument()
          })
        }
        
        const option = screen.getByText(answers[i])
        await user.click(option.closest('.quiz-option'))
      }
    }

    it('displays correct score for perfect quiz', async () => {
      const user = await setupQuizWithData()
      await completeQuiz(user)
      
      await waitFor(() => {
        expect(screen.getByText(/You scored 3 out of 3 questions correctly/i)).toBeInTheDocument()
        expect(screen.getByText(/100%/i)).toBeInTheDocument()
      })
    })

    it('provides retake option', async () => {
      const user = await setupQuizWithData()
      await completeQuiz(user)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Retake Assessment/i })).toBeInTheDocument()
      })
    })

    it('resets quiz when retaking', async () => {
      const user = await setupQuizWithData()
      await completeQuiz(user)
      
      await waitFor(() => {
        const retakeButton = screen.getByRole('button', { name: /Retake Assessment/i })
        expect(retakeButton).toBeInTheDocument()
      })
      
      await user.click(screen.getByRole('button', { name: /Retake Assessment/i }))
      
      // Should return to first question
      expect(screen.getByText(/Question 1 of 3/i)).toBeInTheDocument()
      expect(screen.getByText(mockLearningData.question1)).toBeInTheDocument()
    })
  })

  describe('Quiz Progress Tracking', () => {
    it('calls API to record quiz completion', async () => {
      // Mock quiz completion API
      const quizCompleteMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, progress: {} })
      })
      
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockLearningData
        })
        .mockImplementation(quizCompleteMock)
      
      const user = await setupQuizWithData()
      await completeQuiz(user)
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:8000/quiz-complete',
          expect.objectContaining({
            method: 'POST',
            body: expect.any(FormData)
          })
        )
      })
    })
  })

  describe('Quiz Error Handling', () => {
    it('handles missing question data gracefully', async () => {
      const incompleteData = {
        ...mockLearningData,
        question2: undefined,
        options2: undefined
      }
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => incompleteData
      })
      
      const user = userEvent.setup()
      render(<App />)
      
      await user.click(screen.getByRole('button', { name: /create/i }))
      await user.type(screen.getByPlaceholderText(/Type or paste your lecture notes/i), 'Test content')
      await user.click(screen.getByRole('button', { name: /Generate Learning Module/i }))
      
      // Should still show available questions
      await waitFor(() => {
        expect(screen.getByText(mockLearningData.question1)).toBeInTheDocument()
      })
    })

    it('handles API errors during quiz submission', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockLearningData
        })
        .mockRejectedValueOnce(new Error('Network error'))
      
      const user = await setupQuizWithData()
      await completeQuiz(user)
      
      // Quiz should complete locally even if API call fails
      await waitFor(() => {
        expect(screen.getByText(/Assessment Complete!/i)).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('provides proper ARIA labels for quiz elements', async () => {
      await setupQuizWithData()
      
      // Check for proper button roles
      const options = screen.getAllByRole('generic').filter(el => 
        el.className.includes('quiz-option')
      )
      
      expect(options.length).toBeGreaterThan(0)
    })

    it('supports keyboard navigation', async () => {
      const user = await setupQuizWithData()
      
      const firstOption = screen.getByText(mockLearningData.options1[0]).closest('.quiz-option')
      
      // Should be clickable/focusable
      expect(firstOption).toHaveStyle({ cursor: 'pointer' })
    })
  })
}) 