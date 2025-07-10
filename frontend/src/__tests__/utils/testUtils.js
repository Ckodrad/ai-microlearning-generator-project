import { vi } from 'vitest'

// Mock learning content data
export const mockLearningData = {
  summary: 'This is a comprehensive overview of machine learning concepts including supervised learning, unsupervised learning, and reinforcement learning.',
  learning_objectives: [
    'Understand the fundamentals of machine learning',
    'Differentiate between supervised and unsupervised learning',
    'Apply basic machine learning concepts to real-world problems'
  ],
  key_concepts: [
    'Machine Learning',
    'Supervised Learning', 
    'Unsupervised Learning',
    'Neural Networks',
    'Data Processing'
  ],
  question1: 'What is the main difference between supervised and unsupervised learning?',
  question2: 'Which algorithm would you use for spam email detection?',
  question3: 'How would you evaluate the performance of a classification model?',
  options1: [
    'Supervised learning uses labeled data while unsupervised learning uses unlabeled data',
    'Supervised learning is faster than unsupervised learning',
    'Supervised learning requires more memory',
    'There is no difference between them'
  ],
  options2: [
    'K-means clustering',
    'Logistic regression',
    'PCA',
    'DBSCAN'
  ],
  options3: [
    'Using only accuracy metric',
    'Using precision, recall, and F1-score',
    'Only looking at the confusion matrix',
    'Checking if the model runs without errors'
  ],
  correct_option1: 0,
  correct_option2: 1,
  correct_option3: 1,
  bloom_level1: 'Understand',
  bloom_level2: 'Apply',
  bloom_level3: 'Analyze',
  explanation1: 'Supervised learning requires labeled training data to learn patterns, while unsupervised learning finds patterns in unlabeled data.',
  explanation2: 'Logistic regression is ideal for binary classification tasks like spam detection where we have labeled examples of spam and non-spam emails.',
  explanation3: 'A comprehensive evaluation should include multiple metrics like precision, recall, and F1-score to understand model performance from different angles.',
  flashcards: [
    {
      front: 'What is machine learning?',
      back: 'A subset of AI that enables computers to learn from data without explicit programming',
      category: 'definition'
    },
    {
      front: 'Name three types of machine learning',
      back: 'Supervised learning, unsupervised learning, and reinforcement learning',
      category: 'key concept'
    },
    {
      front: 'What is overfitting?',
      back: 'When a model learns the training data too well and fails to generalize to new data',
      category: 'concept'
    }
  ],
  difficulty_level: 'intermediate',
  progress: {
    session_id: 'test-session-123',
    created_at: '2024-01-01T00:00:00.000Z',
    completed_modules: 0,
    total_modules: 1,
    quiz_scores: {},
    flashcard_progress: {},
    learning_objectives_completed: [],
    time_spent: 0,
    streak_days: 0,
    last_activity: '2024-01-01T00:00:00.000Z'
  }
}

// Mock user preferences
export const mockUserPreferences = {
  name: 'Test User',
  learningStyle: 'visual',
  difficulty: 'intermediate',
  pace: 'moderate',
  studyTime: 45,
  interests: ['Science & Technology', 'Programming'],
  learningPath: 'balanced',
  notifications: true,
  adaptiveMode: true,
  studyGoals: ['Learn new skills', 'Career advancement'],
  preferredTime: 'morning',
  weeklyGoal: 5,
  reminderSettings: {
    enabled: true,
    frequency: 'daily',
    time: '09:00'
  },
  contentPreferences: {
    audioSpeed: 1.0,
    textSize: 'medium',
    darkMode: false,
    animations: true
  }
}

// Mock API responses
export const mockApiResponses = {
  process: {
    success: {
      ok: true,
      json: async () => mockLearningData
    },
    error: {
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error' })
    },
    networkError: () => Promise.reject(new Error('Network error'))
  },
  quizComplete: {
    success: {
      ok: true,
      json: async () => ({
        success: true,
        progress: {
          ...mockLearningData.progress,
          quiz_scores: { 'knowledge_check': 85 }
        }
      })
    }
  }
}

// Utility functions for testing
export const createMockFile = (name, type, content = 'test content') => {
  const blob = new Blob([content], { type })
  blob.name = name
  return blob
}

export const createMockEvent = (files) => ({
  target: { files },
  preventDefault: vi.fn(),
  stopPropagation: vi.fn()
})

export const createMockDragEvent = (files) => ({
  dataTransfer: { files },
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
  type: 'drop'
})

// Setup functions for common test scenarios
export const setupMockFetch = (response = mockApiResponses.process.success) => {
  global.fetch = vi.fn().mockResolvedValue(response)
  return global.fetch
}

export const setupMockLocalStorage = (initialData = {}) => {
  const store = { ...initialData }
  global.localStorage = {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value }),
    removeItem: vi.fn((key) => { delete store[key] }),
    clear: vi.fn(() => { Object.keys(store).forEach(key => delete store[key]) })
  }
  return store
}

export const setupMockFileReader = () => {
  global.FileReader = class MockFileReader {
    constructor() {
      this.result = null
      this.readAsText = vi.fn((file) => {
        this.result = 'mock file content'
        if (this.onload) this.onload({ target: { result: this.result } })
      })
      this.onload = null
    }
  }
}

// Custom render function with common providers
export const renderWithProviders = (ui, options = {}) => {
  // This can be extended with context providers, routers, etc.
  return render(ui, options)
}

// Wait for async operations
export const waitForAsync = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms))

// Assertions helpers
export const expectToBeVisible = (element) => {
  expect(element).toBeInTheDocument()
  expect(element).toBeVisible()
}

export const expectToHaveCorrectAttributes = (element, attributes) => {
  Object.entries(attributes).forEach(([attr, value]) => {
    expect(element).toHaveAttribute(attr, value)
  })
}

// Mock implementations
export const mockImplementations = {
  fetch: vi.fn(),
  localStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
  },
  fileReader: {
    readAsText: vi.fn(),
    onload: vi.fn()
  },
  urlCreateObjectURL: vi.fn(() => 'mock-url'),
  urlRevokeObjectURL: vi.fn()
} 