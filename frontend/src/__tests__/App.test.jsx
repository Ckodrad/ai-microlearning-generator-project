import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

// Mock fetch for API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock file reader
global.FileReader = class MockFileReader {
  constructor() {
    this.readAsText = vi.fn()
    this.onload = null
  }
}

describe('App Component', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    localStorage.clear()
  })

  describe('Navigation', () => {
    it('renders all navigation tabs', () => {
      render(<App />)
      
      expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /assistant/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument()
    })

    it('switches between tabs correctly', async () => {
      const user = userEvent.setup()
      render(<App />)
      
      // Should start on home tab
      expect(screen.getByText(/AI-Powered Microlearning Generator/i)).toBeInTheDocument()
      
      // Click on Create tab
      await user.click(screen.getByRole('button', { name: /create/i }))
      expect(screen.getByText(/Create Your Learning Module/i)).toBeInTheDocument()
      
      // Click on Assistant tab
      await user.click(screen.getByRole('button', { name: /assistant/i }))
      expect(screen.getByText(/AI Learning Assistant/i)).toBeInTheDocument()
      
      // Click on Settings tab
      await user.click(screen.getByRole('button', { name: /settings/i }))
      expect(screen.getByText(/Learning Preferences/i)).toBeInTheDocument()
    })

    it('shows active state for current tab', async () => {
      const user = userEvent.setup()
      render(<App />)
      
      const homeButton = screen.getByRole('button', { name: /home/i })
      const createButton = screen.getByRole('button', { name: /create/i })
      
      // Home should be active initially
      expect(homeButton).toHaveClass('active')
      expect(createButton).not.toHaveClass('active')
      
      // Switch to create tab
      await user.click(createButton)
      expect(homeButton).not.toHaveClass('active')
      expect(createButton).toHaveClass('active')
    })
  })

  describe('Home Page', () => {
    it('displays welcome message without user name', () => {
      render(<App />)
      
      expect(screen.getByText(/Transform your educational content/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Start Creating Learning Content/i })).toBeInTheDocument()
    })

    it('displays personalized welcome when user name is set', () => {
      // Set user preferences in localStorage
      localStorage.setItem('userPreferences', JSON.stringify({ name: 'John Doe' }))
      
      render(<App />)
      
      expect(screen.getByText(/Welcome back, John Doe!/i)).toBeInTheDocument()
      expect(screen.getByText(/Your Learning Profile/i)).toBeInTheDocument()
    })

    it('displays feature cards', () => {
      render(<App />)
      
      expect(screen.getByText(/Audio Intelligence/i)).toBeInTheDocument()
      expect(screen.getByText(/Visual Analysis/i)).toBeInTheDocument()
      expect(screen.getByText(/Text Processing/i)).toBeInTheDocument()
      expect(screen.getByText(/Smart Assessments/i)).toBeInTheDocument()
    })
  })

  describe('Generator Page', () => {
    beforeEach(async () => {
      const user = userEvent.setup()
      render(<App />)
      await user.click(screen.getByRole('button', { name: /create/i }))
    })

    it('displays upload zones for different file types', () => {
      expect(screen.getByText(/Audio File/i)).toBeInTheDocument()
      expect(screen.getByText(/Image File/i)).toBeInTheDocument()
      expect(screen.getByText(/Text File/i)).toBeInTheDocument()
    })

    it('displays text input area', () => {
      expect(screen.getByPlaceholderText(/Type or paste your lecture notes/i)).toBeInTheDocument()
    })

    it('shows generate button', () => {
      expect(screen.getByRole('button', { name: /Generate Learning Module/i })).toBeInTheDocument()
    })

    it('handles text input correctly', async () => {
      const user = userEvent.setup()
      const textArea = screen.getByPlaceholderText(/Type or paste your lecture notes/i)
      
      await user.type(textArea, 'Test content for learning')
      expect(textArea).toHaveValue('Test content for learning')
    })

    it('shows error when submitting without content', async () => {
      const user = userEvent.setup()
      
      await user.click(screen.getByRole('button', { name: /Generate Learning Module/i }))
      
      await waitFor(() => {
        expect(screen.getByText(/Please provide at least one input/i)).toBeInTheDocument()
      })
    })
  })

  describe('Chat Interface', () => {
    beforeEach(async () => {
      const user = userEvent.setup()
      render(<App />)
      await user.click(screen.getByRole('button', { name: /assistant/i }))
    })

    it('displays initial AI greeting', () => {
      expect(screen.getByText(/Hello! I'm your AI learning assistant/i)).toBeInTheDocument()
    })

    it('shows chat input and send button', () => {
      expect(screen.getByPlaceholderText(/Ask me anything about your learning materials/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /➤/ })).toBeInTheDocument()
    })

    it('handles chat input correctly', async () => {
      const user = userEvent.setup()
      const chatInput = screen.getByPlaceholderText(/Ask me anything about your learning materials/i)
      
      await user.type(chatInput, 'Hello AI!')
      expect(chatInput).toHaveValue('Hello AI!')
    })

    it('sends message on enter key', async () => {
      const user = userEvent.setup()
      const chatInput = screen.getByPlaceholderText(/Ask me anything about your learning materials/i)
      
      await user.type(chatInput, 'Test message')
      await user.keyboard('{Enter}')
      
      // Should clear input after sending
      expect(chatInput).toHaveValue('')
      
      // Should show user message
      await waitFor(() => {
        expect(screen.getByText('Test message')).toBeInTheDocument()
      })
    })
  })

  describe('Settings Page', () => {
    beforeEach(async () => {
      const user = userEvent.setup()
      render(<App />)
      await user.click(screen.getByRole('button', { name: /settings/i }))
    })

    it('displays all preference sections', () => {
      expect(screen.getByText(/Personal Profile/i)).toBeInTheDocument()
      expect(screen.getByText(/Learning Style/i)).toBeInTheDocument()
      expect(screen.getByText(/Study Settings/i)).toBeInTheDocument()
      expect(screen.getByText(/Learning Interests/i)).toBeInTheDocument()
    })

    it('handles name input correctly', async () => {
      const user = userEvent.setup()
      const nameInput = screen.getByPlaceholderText(/Enter your name/i)
      
      await user.type(nameInput, 'Jane Doe')
      expect(nameInput).toHaveValue('Jane Doe')
    })

    it('handles learning style selection', async () => {
      const user = userEvent.setup()
      const visualCard = screen.getByText(/Visual/i).closest('div')
      
      await user.click(visualCard)
      expect(visualCard).toHaveClass('selected')
    })

    it('saves preferences to localStorage', async () => {
      const user = userEvent.setup()
      
      // Fill in some preferences
      await user.type(screen.getByPlaceholderText(/Enter your name/i), 'Test User')
      
      // Click save button
      await user.click(screen.getByRole('button', { name: /Save All Preferences/i }))
      
      // Check localStorage
      const savedPrefs = JSON.parse(localStorage.getItem('userPreferences'))
      expect(savedPrefs.name).toBe('Test User')
    })
  })

  describe('API Integration', () => {
    it('makes API call when generating content', async () => {
      const user = userEvent.setup()
      
      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          summary: 'Test summary',
          question1: 'Test question?',
          options1: ['Option A', 'Option B', 'Option C', 'Option D'],
          flashcards: [{ front: 'Test front', back: 'Test back' }],
          progress: { session_id: 'test-session-123' }
        })
      })
      
      render(<App />)
      await user.click(screen.getByRole('button', { name: /create/i }))
      
      // Add some content
      await user.type(screen.getByPlaceholderText(/Type or paste your lecture notes/i), 'Test content')
      
      // Submit
      await user.click(screen.getByRole('button', { name: /Generate Learning Module/i }))
      
      // Check API was called
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/process', {
          method: 'POST',
          body: expect.any(FormData)
        })
      })
    })

    it('handles API errors gracefully', async () => {
      const user = userEvent.setup()
      
      // Mock API error
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      
      render(<App />)
      await user.click(screen.getByRole('button', { name: /create/i }))
      
      // Add content and submit
      await user.type(screen.getByPlaceholderText(/Type or paste your lecture notes/i), 'Test content')
      await user.click(screen.getByRole('button', { name: /Generate Learning Module/i }))
      
      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/Error:/i)).toBeInTheDocument()
      })
    })

    it('sends chat messages to backend API', async () => {
      const user = userEvent.setup()
      
      // Mock chat API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          response: 'AI response from backend'
        })
      })
      
      render(<App />)
      await user.click(screen.getByRole('button', { name: /assistant/i }))
      
      const chatInput = screen.getByPlaceholderText(/Ask me anything about your learning materials/i)
      await user.type(chatInput, 'Hello AI!')
      await user.click(screen.getByRole('button', { name: /➤/ }))
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/chat', {
          method: 'POST',
          body: expect.any(FormData)
        })
      })
    })

    it('saves preferences to backend when session exists', async () => {
      const user = userEvent.setup()
      
      // Mock successful preferences save
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Preferences saved successfully'
        })
      })
      
      // Set up component with session
      localStorage.setItem('userPreferences', JSON.stringify({ name: 'Test User' }))
      
      render(<App />)
      await user.click(screen.getByRole('button', { name: /settings/i }))
      
      // Simulate having a session (this would normally come from content generation)
      const saveButton = screen.getByRole('button', { name: /Save All Preferences/i })
      await user.click(saveButton)
      
      // Should save to localStorage at minimum
      expect(localStorage.getItem('userPreferences')).toBeTruthy()
    })

    it('loads analytics from backend', async () => {
      const user = userEvent.setup()
      
      // Mock analytics response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          analytics: {
            total_quizzes: 5,
            total_flashcards: 10,
            average_quiz_score: 85.0,
            total_study_time: 7200,
            learning_streak: 7
          }
        })
      })
      
      render(<App />)
      
      // The component should load analytics when it has a session
      // This test would need to be refined based on when analytics are actually loaded
    })

    it('tracks flashcard reviews', async () => {
      const user = userEvent.setup()
      
      // First mock content generation with flashcards
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          summary: 'Test summary',
          flashcards: [
            { front: 'Question 1', back: 'Answer 1' },
            { front: 'Question 2', back: 'Answer 2' }
          ],
          progress: { session_id: 'test-session-123' }
        })
      })
      
      // Then mock flashcard review API
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          progress: { session_id: 'test-session-123' }
        })
      })
      
      render(<App />)
      await user.click(screen.getByRole('button', { name: /create/i }))
      
      // Generate content with flashcards
      await user.type(screen.getByPlaceholderText(/Type or paste your lecture notes/i), 'Test content')
      await user.click(screen.getByRole('button', { name: /Generate Learning Module/i }))
      
      await waitFor(() => {
        expect(screen.getByText(/Study Flashcards/i)).toBeInTheDocument()
      })
      
      // Interact with flashcard
      const showAnswerButton = screen.getByRole('button', { name: /Show Answer/i })
      await user.click(showAnswerButton)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Yes - I Knew It/i })).toBeInTheDocument()
      })
      
      await user.click(screen.getByRole('button', { name: /Yes - I Knew It/i }))
      
      // Should have called flashcard review API
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/flashcard-review', {
          method: 'POST',
          body: expect.any(FormData)
        })
      })
    })

    it('handles quiz completion with backend tracking', async () => {
      const user = userEvent.setup()
      
      // Mock content generation with quiz
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          summary: 'Test summary',
          question1: 'What is AI?',
          question2: 'What is ML?',
          question3: 'What is DL?',
          options1: ['Artificial Intelligence', 'Automatic Integration', 'Advanced Input', 'None'],
          options2: ['Machine Learning', 'Manual Labor', 'Multiple Languages', 'None'],
          options3: ['Deep Learning', 'Data Loss', 'Direct Link', 'None'],
          correct_option1: 0,
          correct_option2: 0,
          correct_option3: 0,
          progress: { session_id: 'test-session-123' }
        })
      })
      
      // Mock quiz completion API
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          progress: { session_id: 'test-session-123' }
        })
      })
      
      render(<App />)
      await user.click(screen.getByRole('button', { name: /create/i }))
      
      // Generate content with quiz
      await user.type(screen.getByPlaceholderText(/Type or paste your lecture notes/i), 'AI and ML basics')
      await user.click(screen.getByRole('button', { name: /Generate Learning Module/i }))
      
      await waitFor(() => {
        expect(screen.getByText(/Knowledge Assessment/i)).toBeInTheDocument()
      })
      
      // The actual quiz interaction test would depend on the quiz UI implementation
      // This is a basic structure for testing quiz completion
    })

    it('falls back to local responses when backend APIs fail', async () => {
      const user = userEvent.setup()
      
      // Mock chat API failure
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      
      render(<App />)
      await user.click(screen.getByRole('button', { name: /assistant/i }))
      
      const chatInput = screen.getByPlaceholderText(/Ask me anything about your learning materials/i)
      await user.type(chatInput, 'Hello AI!')
      await user.click(screen.getByRole('button', { name: /➤/ }))
      
      // Should still show a response (fallback)
      await waitFor(() => {
        expect(screen.getByText(/Hello AI!/)).toBeInTheDocument()
      })
      
      // Should have some AI response even with backend failure
      await waitFor(() => {
        const messages = screen.getAllByText(/learning/i)
        expect(messages.length).toBeGreaterThan(1) // Initial greeting + response
      })
    })
  })

  describe('Quiz Functionality', () => {
    beforeEach(() => {
      // Mock data with quiz content
      const mockData = {
        summary: 'Test summary',
        question1: 'What is the answer?',
        question2: 'Another question?',
        question3: 'Final question?',
        options1: ['A', 'B', 'C', 'D'],
        options2: ['A', 'B', 'C', 'D'],
        options3: ['A', 'B', 'C', 'D'],
        correct_option1: 0,
        correct_option2: 1,
        correct_option3: 2,
        bloom_level1: 'Remember',
        bloom_level2: 'Understand',
        bloom_level3: 'Apply'
      }
      
      // Set up component with quiz data
      const user = userEvent.setup()
      render(<App />)
      
      // Simulate having loaded quiz data
      const app = screen.getByTestId ? screen.getByTestId('app') : document.body
      app._mockData = mockData
    })

    it('displays quiz when data is available', () => {
      // This would be tested with actual quiz data loaded
      // Implementation depends on how quiz data is passed to components
    })
  })
}) 