import React, { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Auth from './components/Auth';

const MainApp = () => {
  const [tab, setTab] = useState('home');
  const [files, setFiles] = useState({});
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [dragActive, setDragActive] = useState({});
  const [currentFlashcard, setCurrentFlashcard] = useState(0);
  const [showFlashcardAnswer, setShowFlashcardAnswer] = useState(false);
  const [progress, setProgress] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const textPreview = useRef("");
  
  // Get authentication context
  const { currentUser, userData, logout } = useAuth();
  
  // Quiz state management
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResults, setQuizResults] = useState({});
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(1);
  
  // AI Chat state
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      type: 'ai',
      content: 'Hello! I\'m your AI learning assistant. I can help you understand the material, answer questions, and provide personalized guidance. What would you like to explore?',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  
  // Personalization state
  const [userPreferences, setUserPreferences] = useState({
    name: '',
    learningStyle: 'visual',
    difficulty: 'intermediate',
    pace: 'moderate',
    studyTime: 30,
    interests: [],
    learningPath: 'balanced',
    notifications: true,
    adaptiveMode: true,
    studyGoals: [],
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
  });

  // Enhanced analytics with backend integration
  const [analytics, setAnalytics] = useState({
    totalQuestions: 0,
    flashcards: 0,
    concepts: 0,
    progress: 0,
    totalStudyTime: 0,
    learningStreak: 0,
    averageScore: 0
  });

  const loadAnalytics = useCallback(async () => {
    try {
      if (progress?.session_id) {
        const response = await fetch(`http://localhost:8000/analytics/${progress.session_id}`);
        if (response.ok) {
          const result = await response.json();
          if (result.analytics) {
            setAnalytics({
              totalQuestions: result.analytics.total_quizzes || 0,
              flashcards: result.analytics.total_flashcards || 0,
              concepts: result.analytics.learning_objectives_completed || 0,
              progress: result.analytics.average_quiz_score || 0,
              totalStudyTime: result.analytics.total_study_time || 0,
              learningStreak: result.analytics.learning_streak || 0,
              averageScore: result.analytics.average_quiz_score || 0
            });
            return;
          }
        }
      }
      
      // Fallback to local calculation
      if (data) {
        const totalQuestions = [data.question1, data.question2, data.question3].filter(Boolean).length;
        const flashcardsCount = data.flashcards?.length || 0;
        const conceptsCount = data.key_concepts?.length || 0;
        const progressPercent = quizCompleted ? Math.round((quizScore / totalQuestions) * 100) : 0;
        
        setAnalytics({
          totalQuestions,
          flashcards: flashcardsCount,
          concepts: conceptsCount,
          progress: progressPercent,
          totalStudyTime: 0,
          learningStreak: 0,
          averageScore: progressPercent
        });
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  }, [progress?.session_id, data, quizCompleted, quizScore]);

  const completeModule = useCallback(async (moduleId) => {
    if (!progress?.session_id) return;
    
    try {
      const form = new FormData();
      form.append('session_id', progress.session_id);
      form.append('module_id', moduleId);
      
      const response = await fetch('http://localhost:8000/complete-module', {
        method: 'POST',
        body: form,
      });
      
      if (response.ok) {
        const result = await response.json();
        setProgress(result.progress);
        loadAnalytics(); // Refresh analytics
      }
    } catch (error) {
      console.error('Failed to complete module:', error);
    }
  }, [progress?.session_id, loadAnalytics]);

  // Load preferences from localStorage on component mount
  useEffect(() => {
    const savedPreferences = localStorage.getItem('userPreferences');
    if (savedPreferences) {
      try {
        const loaded = JSON.parse(savedPreferences);
        setUserPreferences(prev => ({
          ...prev,
          ...loaded,
          studyGoals: Array.isArray(loaded.studyGoals) ? loaded.studyGoals : [],
        }));
      } catch (error) {
        console.error('Failed to load preferences:', error);
      }
    }
  }, []);

  // Load analytics when progress changes
  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Flashcard review handler with backend tracking
  const handleFlashcardReview = async (correct) => {
    if (!data?.flashcards || !progress?.session_id) return;
    
    try {
      const form = new FormData();
      form.append('session_id', progress.session_id);
      form.append('card_id', `flashcard_${currentFlashcard}`);
      form.append('correct', correct);
      
      const response = await fetch('http://localhost:8000/flashcard-review', {
        method: 'POST',
        body: form,
      });
      
      if (response.ok) {
        const result = await response.json();
        setProgress(result.progress);
        loadAnalytics(); // Refresh analytics
      }
    } catch (error) {
      console.error('Failed to track flashcard review:', error);
    }
    
    // Move to next flashcard
    if (currentFlashcard < data.flashcards.length - 1) {
      setCurrentFlashcard(currentFlashcard + 1);
    } else {
      setCurrentFlashcard(0);
    }
    setShowFlashcardAnswer(false);
  };

  const getAnalytics = () => {
    return analytics;
  };

  // All existing handlers remain the same
  const handleDrag = (e, type) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive((prev) => ({ ...prev, [type]: e.type === 'dragenter' || e.type === 'dragover' }));
  };

  const handleDrop = (e, type) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive((prev) => ({ ...prev, [type]: false }));
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile({ target: { name: type, files: e.dataTransfer.files } });
    }
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    setFiles((f) => ({ ...f, [e.target.name]: file }));
    if (e.target.name === 'text' && file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        textPreview.current = ev.target.result.slice(0, 200);
      };
      reader.readAsText(file);
    }
  };

  const handleRemove = (name) => {
    setFiles((f) => {
      const newFiles = { ...f };
      delete newFiles[name];
      return newFiles;
    });
    if (name === 'text') textPreview.current = "";
  };

  const handleSubmit = async () => {
    setError(null);
    setData(null);
    if (!files.audio && !files.image && !files.text && !prompt.trim()) {
      setError('Please provide at least one input (file or prompt).');
      return;
    }
    const form = new FormData();
    if (files.audio) form.append('audio', files.audio);
    if (files.image) form.append('image', files.image);
    if (files.text) form.append('text', files.text);
    if (prompt.trim()) form.append('prompt', prompt.trim());
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/process', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) throw new Error('Server error');
      const json = await res.json();
      setData(json);
      if (json.progress) {
        setProgress(json.progress);
        setSessionId(json.progress.session_id);
      }
      setTab('generator');
    } catch (e) {
      setError('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const renderPreview = (type) => {
    if (!files[type]) return null;
    if (type === 'image') {
      return <img src={URL.createObjectURL(files.image)} alt="preview" style={{ maxWidth: '100%', maxHeight: '100px', borderRadius: '8px' }} />;
    }
    if (type === 'audio') {
      return <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{files.audio.name}</span>;
    }
    if (type === 'text') {
      return <pre style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{textPreview.current || files.text.name}</pre>;
    }
    return null;
  };

  // All existing quiz and chat handlers remain the same but condensed for space
  const handleQuizAnswer = (questionNum, selectedOption) => {
    setQuizAnswers(prev => ({
      ...prev,
      [questionNum]: selectedOption
    }));
    
    setTimeout(() => {
      if (questionNum < 3) {
        setCurrentQuestion(questionNum + 1);
      } else {
        handleQuizSubmit();
      }
    }, 500);
  };

  const handleQuizSubmit = () => {
    let correctAnswers = 0;
    const results = {};
    
    [1, 2, 3].forEach(num => {
      const question = data[`question${num}`];
      if (!question) return;
      
      const userAnswer = quizAnswers[num];
      const correctOption = data[`correct_option${num}`] || 0;
      const isCorrect = userAnswer === correctOption;
      
      console.log(`Question ${num}: User answered ${userAnswer}, Correct is ${correctOption}, Is correct: ${isCorrect}`);
      
      results[num] = {
        userAnswer,
        correctOption,
        isCorrect,
        explanation: data[`explanation${num}`] || ''
      };
      
      if (isCorrect) correctAnswers++;
    });
    
    console.log(`Total correct answers: ${correctAnswers}, Quiz answers:`, quizAnswers);
    console.log('Quiz results:', results);
    
    setQuizResults(results);
    setQuizCompleted(true);
    setQuizScore(correctAnswers);
    
    if (progress?.session_id) {
      const form = new FormData();
      form.append('session_id', progress.session_id);
      form.append('quiz_id', 'knowledge_check');
      form.append('score', (correctAnswers / 3) * 100);
      
      fetch('http://localhost:8000/quiz-complete', {
        method: 'POST',
        body: form,
      }).catch(e => console.error('Failed to update quiz progress:', e));
    }
  };

  const resetQuiz = () => {
    setCurrentQuestion(1);
    setQuizAnswers({});
    setQuizResults({});
    setQuizCompleted(false);
    setQuizScore(0);
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: chatInput.trim(),
      timestamp: new Date().toLocaleTimeString()
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);
    
    try {
      const contextInfo = data ? {
        hasQuiz: !!(data.question1 || data.question2 || data.question3),
        hasFlashcards: !!(data.flashcards && data.flashcards.length > 0),
        summary: data.summary,
        concepts: data.key_concepts,
        currentProgress: quizCompleted ? Math.round((quizScore / 3) * 100) : 0
      } : null;
      
      // Send message to backend chat API
      const form = new FormData();
      form.append('message', userMessage.content);
      if (progress?.session_id) {
        form.append('session_id', progress.session_id);
      }
      if (contextInfo) {
        form.append('context', JSON.stringify(contextInfo));
      }
      
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        body: form,
      });
      
      if (!response.ok) {
        throw new Error('Chat API error');
      }
      
      const result = await response.json();
      
      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: result.response,
        timestamp: new Date().toLocaleTimeString()
      };
      
      setChatMessages(prev => [...prev, aiMessage]);
      setChatLoading(false);
      
    } catch (error) {
      console.error('Chat error:', error);
      setChatLoading(false);
      
      // Fallback to local response if API fails
      const contextInfo = data ? {
        hasQuiz: !!(data.question1 || data.question2 || data.question3),
        hasFlashcards: !!(data.flashcards && data.flashcards.length > 0),
        summary: data.summary,
        concepts: data.key_concepts,
        currentProgress: quizCompleted ? Math.round((quizScore / 3) * 100) : 0
      } : null;
      
      const aiResponse = generateAIResponse(userMessage.content, contextInfo);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: aiResponse,
        timestamp: new Date().toLocaleTimeString()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    }
  };

  const generateAIResponse = (userInput, context) => {
    const input = userInput.toLowerCase();
    
    if (context) {
      if (input.includes('quiz') || input.includes('question')) {
        if (context.hasQuiz) {
          if (context.currentProgress > 0) {
            return `Great work! You scored ${context.currentProgress}% on the quiz. ${
              context.currentProgress >= 80 
                ? 'Excellent understanding! Would you like to explore advanced concepts or review any specific areas?' 
                : 'Good progress! I can help you understand the concepts you found challenging. Which question would you like to review?'
            }`;
          }
          return 'I see you have a knowledge assessment available! Taking quizzes helps reinforce learning. Would you like some tips before starting, or do you have questions about the material?';
        }
        return 'Quizzes are a great way to test your understanding! Once you upload some content and generate questions, I can help you prepare and review your answers.';
      }
      
      if (input.includes('summary') || input.includes('understand')) {
        if (context.summary) {
          return `Based on your content, the key points are: ${context.summary.slice(0, 150)}... Would you like me to elaborate on any specific aspect or explain how these concepts connect?`;
        }
      }
    }
    
    if (input.includes('help') || input.includes('how')) {
      return 'I\'m here to support your learning journey! I can help you understand concepts, prepare for assessments, create study plans, or answer questions about the material. What specific area would you like assistance with?';
    }
    
    const responses = [
      'That\'s an interesting question! Can you provide more context about what you\'d like to learn?',
      'I\'m here to help you succeed! What specific aspect of the material would you like to explore?',
      'Learning is a journey, and I\'m glad to be part of yours! How can I assist you today?'
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const updatePreference = (key, value) => {
    setUserPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const updateInterests = (interest, checked) => {
    setUserPreferences(prev => ({
      ...prev,
      interests: checked 
        ? [...prev.interests, interest]
        : prev.interests.filter(i => i !== interest)
    }));
  };

  const updateStudyGoals = (goal, checked) => {
    setUserPreferences(prev => ({
      ...prev,
      studyGoals: checked 
        ? [...prev.studyGoals, goal]
        : prev.studyGoals.filter(g => g !== goal)
    }));
  };

  const updateContentPreference = (key, value) => {
    setUserPreferences(prev => ({
      ...prev,
      contentPreferences: {
        ...prev.contentPreferences,
        [key]: value
      }
    }));
  };

  const updateReminderSetting = (key, value) => {
    setUserPreferences(prev => ({
      ...prev,
      reminderSettings: {
        ...prev.reminderSettings,
        [key]: value
      }
    }));
  };

  const savePreferences = async () => {
    try {
      // Save to localStorage as backup
      localStorage.setItem('userPreferences', JSON.stringify(userPreferences));
      
      // Save to backend if we have a session
      if (progress?.session_id) {
        const form = new FormData();
        form.append('session_id', progress.session_id);
        form.append('preferences', JSON.stringify(userPreferences));
        
        const response = await fetch('http://localhost:8000/preferences', {
          method: 'POST',
          body: form,
        });
        
        if (response.ok) {
          alert('Preferences saved successfully to your learning profile!');
        } else {
          throw new Error('Failed to save to backend');
        }
      } else {
        alert('Preferences saved locally! Generate some content to sync with your learning profile.');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('Preferences saved locally, but could not sync to server.');
    }
  };

  const resetPreferences = () => {
    setUserPreferences({
      name: '',
      learningStyle: 'visual',
      difficulty: 'intermediate', 
      pace: 'moderate',
      studyTime: 30,
      interests: [],
      learningPath: 'balanced',
      notifications: true,
      adaptiveMode: true,
      studyGoals: [],
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
    });
  };

  // Alice.tech-inspired Home Page
  const renderHome = () => {
    const analytics = getAnalytics();
    
    return (
      <div className="main-content">
        <div className="hero-section">
          <h1 className="hero-title">
            AI-Powered <span className="highlight">Microlearning</span> Generator
          </h1>
          <p className="hero-subtitle">
            {userPreferences.name 
              ? `Welcome back, ${userPreferences.name}! Ready for your personalized learning session?`
              : 'Transform your educational content into comprehensive, interactive learning experiences with advanced AI technology'
            }
          </p>
          
          {userPreferences.name && (
            <div className="personalization-bar">
              <h3>Your Learning Profile</h3>
              <p>Optimized for {userPreferences.learningStyle} learning • {userPreferences.difficulty} difficulty • {userPreferences.pace} pace</p>
            </div>
          )}
          
          <div className="hero-cta">
            <button 
              className="btn btn-primary btn-large"
              onClick={() => setTab('generator')}
            >
              <span>🚀</span>
              Start Creating Learning Content
            </button>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-value">{analytics.totalQuestions}</span>
            <span className="stat-label">Assessment Questions</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{analytics.flashcards}</span>
            <span className="stat-label">Study Flashcards</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{analytics.concepts}</span>
            <span className="stat-label">Key Concepts</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{analytics.progress}%</span>
            <span className="stat-label">Learning Progress</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{Math.round(analytics.totalStudyTime / 60) || 0}h</span>
            <span className="stat-label">Study Time</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{analytics.learningStreak}</span>
            <span className="stat-label">Day Streak</span>
          </div>
        </div>
        
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🎤</div>
            <h3>Audio Intelligence</h3>
            <p>Advanced speech recognition transforms lectures and recordings into structured learning materials with key insights and summaries</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🖼️</div>
            <h3>Visual Analysis</h3>
            <p>AI-powered image understanding extracts knowledge from diagrams, charts, and educational visuals for comprehensive learning</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">📝</div>
            <h3>Text Processing</h3>
            <p>Natural language processing creates concise summaries, learning objectives, and structured content from any text source</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🎯</div>
            <h3>Smart Assessments</h3>
            <p>Bloom's Taxonomy-aligned questions test comprehension across Remember, Understand, and Apply cognitive levels</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">💬</div>
            <h3>AI Learning Assistant</h3>
            <p>Interactive conversational AI provides personalized guidance, explanations, and adaptive learning support</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Learning Analytics</h3>
            <p>Comprehensive progress tracking with personalized insights and adaptive recommendations for optimal learning</p>
          </div>
        </div>
      </div>
    );
  };

  // Alice.tech-inspired Generator Page
  const renderGenerator = () => (
    <div className="main-content">
      <div className="hero-section">
        <h1 className="hero-title">Create Your <span className="highlight">Learning Module</span></h1>
        <p className="hero-subtitle">Upload your educational content and let AI transform it into comprehensive, interactive learning materials</p>
      </div>
      
      <div className="upload-section">
        <div className="card-header">
          <div className="card-icon">📁</div>
          <div>
            <div className="card-title">Upload Educational Content</div>
            <div className="card-subtitle">Support for audio, images, and text files</div>
          </div>
        </div>
        
        <div className="upload-grid">
          {[
            { type: 'audio', icon: '🎤', label: 'Audio File', accept: 'audio/*', desc: 'Lectures, recordings, podcasts' },
            { type: 'image', icon: '🖼️', label: 'Image File', accept: 'image/*', desc: 'Diagrams, charts, screenshots' },
            { type: 'text', icon: '📝', label: 'Text File', accept: '.txt', desc: 'Notes, documents, articles' }
          ].map(({ type, icon, label, accept, desc }) => (
            <div
              key={type}
              className={`upload-zone${dragActive[type] ? ' active' : ''}`}
              onDragEnter={(e) => handleDrag(e, type)}
              onDragOver={(e) => handleDrag(e, type)}
              onDragLeave={(e) => handleDrag(e, type)}
              onDrop={(e) => handleDrop(e, type)}
            >
              <input
                id={`file-${type}`}
                type="file"
                name={type}
                accept={accept}
                onChange={handleFile}
                style={{ display: 'none' }}
              />
              <div
                onClick={() => document.getElementById(`file-${type}`).click()}
                style={{ cursor: 'pointer', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}
              >
                {files[type] ? (
                  <div style={{ textAlign: 'center', width: '100%' }}>
                    {renderPreview(type)}
                    <button 
                      className="btn btn-secondary" 
                      onClick={(e) => { e.stopPropagation(); handleRemove(type); }}
                      style={{ marginTop: 'var(--space-3)' }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="upload-icon">{icon}</div>
                    <div className="upload-label">{label}</div>
                    <div className="upload-description">{desc}</div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        
        <div className="text-input-section">
          <label htmlFor="prompt-input" className="form-label">
            💭 Or enter your content directly
          </label>
          <textarea
            id="prompt-input"
            className="text-input"
            placeholder="Type or paste your lecture notes, questions, or educational content here..."
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
          />
        </div>
        
        <button className="submit-button" onClick={handleSubmit} disabled={loading}>
          {loading ? (
            <>
              <div style={{ 
                width: '20px', 
                height: '20px', 
                border: '2px solid rgba(255,255,255,0.3)', 
                borderTop: '2px solid white', 
                borderRadius: '50%', 
                animation: 'spin 1s linear infinite' 
              }}></div>
              <span>AI is analyzing your content...</span>
            </>
          ) : (
            <>
              <span>✨</span>
              <span>Generate Learning Module</span>
            </>
          )}
        </button>
        
        {error && (
          <div style={{
            color: 'var(--error)',
            background: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            marginTop: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)'
          }}>
            ⚠️ {error}
          </div>
        )}
      </div>
      
      {renderResults()}
    </div>
  );

  // Alice.tech-inspired Chat Interface
  const renderChatInterface = () => (
    <div className="main-content">
      <div className="hero-section">
        <h1 className="hero-title">AI Learning <span className="highlight">Assistant</span></h1>
        <p className="hero-subtitle">Get personalized guidance, explanations, and support for your learning journey</p>
      </div>
      
      <div className="chat-container">
        <div className="chat-header">
          <div className="chat-avatar">🤖</div>
          <div className="chat-info">
            <h3>Your Learning Assistant</h3>
            <p>Context-aware AI ready to help with your studies</p>
          </div>
        </div>
        
        <div className="chat-messages">
          {chatMessages.map((message) => (
            <div key={message.id} className={`chat-message ${message.type}`}>
              <div className={`message-avatar ${message.type}`}>
                {message.type === 'user' ? '👤' : '🤖'}
              </div>
              <div className="message-content">
                <p className="message-text">{message.content}</p>
                <div className="message-time">{message.timestamp}</div>
              </div>
            </div>
          ))}
          
          {chatLoading && (
            <div className="chat-message ai">
              <div className="message-avatar ai">🤖</div>
              <div className="message-content">
                <p className="message-text" style={{ fontStyle: 'italic', opacity: 0.7 }}>AI is thinking...</p>
              </div>
            </div>
          )}
        </div>
        
        <div className="chat-input-container">
          <div className="chat-input-wrapper">
            <textarea
              className="chat-input"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendChatMessage();
                }
              }}
              placeholder="Ask me anything about your learning materials..."
              rows={1}
            />
            <button 
              className="chat-send-button"
              onClick={sendChatMessage}
              disabled={chatLoading || !chatInput.trim()}
            >
              ➤
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Enhanced Alice.tech-inspired Preferences Panel
  const renderPreferencesPanel = () => {
    return (
      <div className="main-content">
        <div className="hero-section">
          <h1 className="hero-title">Learning <span className="highlight">Preferences</span></h1>
          <p className="hero-subtitle">Personalize your learning experience with comprehensive adaptive settings and preferences</p>
        </div>
        
        <div className="preferences-panel">
          <div className="preferences-grid">
            {/* Personal Profile Section */}
            <div className="preference-section">
              <h3>👤 Personal Profile</h3>
              <div className="form-group">
                <label className="form-label">Your Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={userPreferences.name}
                  onChange={(e) => updatePreference('name', e.target.value)}
                  placeholder="Enter your name"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Preferred Study Time</label>
                <select
                  className="form-select"
                  value={userPreferences.preferredTime}
                  onChange={(e) => updatePreference('preferredTime', e.target.value)}
                >
                  <option value="morning">Morning (6AM - 12PM)</option>
                  <option value="afternoon">Afternoon (12PM - 6PM)</option>
                  <option value="evening">Evening (6PM - 10PM)</option>
                  <option value="night">Night (10PM - 6AM)</option>
                </select>
              </div>
            </div>

            {/* Learning Style Section */}
            <div className="preference-section">
              <h3>🎯 Learning Style</h3>
              <div className="form-group">
                <label className="form-label">Preferred Learning Style</label>
                <div className="learning-style-grid">
                  {[
                    { value: 'visual', icon: '👁️', label: 'Visual', desc: 'Images, diagrams, charts' },
                    { value: 'auditory', icon: '👂', label: 'Auditory', desc: 'Sound, music, speech' },
                    { value: 'kinesthetic', icon: '✋', label: 'Kinesthetic', desc: 'Hands-on, movement' },
                    { value: 'reading', icon: '📖', label: 'Reading/Writing', desc: 'Text, notes, writing' }
                  ].map((style) => (
                    <div
                      key={style.value}
                      className={`learning-style-card ${userPreferences.learningStyle === style.value ? 'selected' : ''}`}
                      onClick={() => updatePreference('learningStyle', style.value)}
                    >
                      <div className="style-icon">{style.icon}</div>
                      <div className="style-label">{style.label}</div>
                      <div className="style-description">{style.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Difficulty Level</label>
                <div className="difficulty-selector">
                  {[
                    { value: 'beginner', label: 'Beginner', color: '#10b981' },
                    { value: 'intermediate', label: 'Intermediate', color: '#f59e0b' },
                    { value: 'advanced', label: 'Advanced', color: '#ef4444' }
                  ].map((level) => (
                    <button
                      key={level.value}
                      className={`difficulty-btn ${userPreferences.difficulty === level.value ? 'selected' : ''}`}
                      onClick={() => updatePreference('difficulty', level.value)}
                      style={{ 
                        borderColor: userPreferences.difficulty === level.value ? level.color : 'var(--border)',
                        backgroundColor: userPreferences.difficulty === level.value ? `${level.color}15` : 'transparent'
                      }}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Study Settings Section */}
            <div className="preference-section">
              <h3>⏱️ Study Settings</h3>
              <div className="form-group">
                <label className="form-label">Learning Pace</label>
                <select
                  className="form-select"
                  value={userPreferences.pace}
                  onChange={(e) => updatePreference('pace', e.target.value)}
                >
                  <option value="slow">Slow & Thorough</option>
                  <option value="moderate">Moderate</option>
                  <option value="fast">Fast & Efficient</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Daily Study Time: {userPreferences.studyTime} minutes</label>
                <input
                  type="range"
                  className="study-time-slider"
                  min="15"
                  max="120"
                  step="15"
                  value={userPreferences.studyTime}
                  onChange={(e) => updatePreference('studyTime', parseInt(e.target.value))}
                />
                <div className="slider-labels">
                  <span>15 min</span>
                  <span>60 min</span>
                  <span>120 min</span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Weekly Study Goal: {userPreferences.weeklyGoal} sessions</label>
                <input
                  type="range"
                  className="study-time-slider"
                  min="1"
                  max="7"
                  step="1"
                  value={userPreferences.weeklyGoal}
                  onChange={(e) => updatePreference('weeklyGoal', parseInt(e.target.value))}
                />
                <div className="slider-labels">
                  <span>1 session</span>
                  <span>4 sessions</span>
                  <span>7 sessions</span>
                </div>
              </div>
            </div>

            {/* Learning Interests Section */}
            <div className="preference-section">
              <h3>📚 Learning Interests</h3>
              <div className="interests-grid">
                {[
                  { id: 'science', icon: '🧪', label: 'Science & Technology' },
                  { id: 'business', icon: '💼', label: 'Business & Finance' },
                  { id: 'arts', icon: '🎨', label: 'Arts & Literature' },
                  { id: 'history', icon: '📜', label: 'History & Culture' },
                  { id: 'health', icon: '🏥', label: 'Health & Medicine' },
                  { id: 'math', icon: '🔢', label: 'Mathematics' },
                  { id: 'languages', icon: '🗣️', label: 'Languages' },
                  { id: 'programming', icon: '💻', label: 'Programming' }
                ].map((interest) => (
                  <div
                    key={interest.id}
                    className={`interest-card ${userPreferences.interests.includes(interest.label) ? 'selected' : ''}`}
                    onClick={() => updateInterests(interest.label, !userPreferences.interests.includes(interest.label))}
                  >
                    <div className="interest-icon">{interest.icon}</div>
                    <div className="interest-label">{interest.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Learning Path Section */}
            <div className="preference-section full-width">
              <h3>🛤️ Adaptive Learning Paths</h3>
              <div className="learning-paths-grid">
                {[
                  {
                    id: 'balanced',
                    title: 'Balanced Approach',
                    description: 'Equal mix of theory and practice with regular assessments',
                    features: ['Mixed content', 'Regular quizzes', 'Progress tracking'],
                    icon: '⚖️'
                  },
                  {
                    id: 'practice-heavy',
                    title: 'Practice-Heavy',
                    description: 'Focus on hands-on exercises and practical applications',
                    features: ['More exercises', 'Real examples', 'Applied learning'],
                    icon: '🔨'
                  },
                  {
                    id: 'theory-focused',
                    title: 'Theory-Focused',
                    description: 'Deep conceptual understanding with comprehensive explanations',
                    features: ['Detailed explanations', 'Concept mapping', 'Critical thinking'],
                    icon: '📖'
                  },
                  {
                    id: 'rapid-review',
                    title: 'Rapid Review',
                    description: 'Quick summaries and frequent testing for fast learning',
                    features: ['Concise content', 'Frequent testing', 'Quick feedback'],
                    icon: '⚡'
                  }
                ].map((path) => (
                  <div
                    key={path.id}
                    className={`learning-path-card ${userPreferences.learningPath === path.id ? 'selected' : ''}`}
                    onClick={() => updatePreference('learningPath', path.id)}
                  >
                    <div className="path-header">
                      <div className="path-icon">{path.icon}</div>
                      <div className="path-title">{path.title}</div>
                    </div>
                    <div className="path-description">{path.description}</div>
                    <div className="path-features">
                      {path.features.map((feature, index) => (
                        <span key={index} className="feature-tag">{feature}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Study Goals Section */}
            <div className="preference-section">
              <h3>🎯 Study Goals</h3>
              <div className="goals-grid">
                {[
                  'Improve test scores',
                  'Learn new skills',
                  'Career advancement',
                  'Personal development',
                  'Academic requirements',
                  'Certification prep'
                ].map((goal) => (
                  <label key={goal} className="goal-checkbox">
                    <input
                      type="checkbox"
                      checked={userPreferences.studyGoals.includes(goal)}
                      onChange={(e) => updateStudyGoals(goal, e.target.checked)}
                    />
                    <span className="checkmark"></span>
                    <span className="goal-text">{goal}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Content Preferences Section */}
            <div className="preference-section">
              <h3>🎛️ Content Preferences</h3>
              <div className="form-group">
                <label className="form-label">Audio Playback Speed</label>
                <select
                  className="form-select"
                  value={userPreferences.contentPreferences.audioSpeed}
                  onChange={(e) => updateContentPreference('audioSpeed', parseFloat(e.target.value))}
                >
                  <option value={0.5}>0.5x (Slow)</option>
                  <option value={0.75}>0.75x</option>
                  <option value={1.0}>1.0x (Normal)</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x (Fast)</option>
                  <option value={2.0}>2.0x (Very Fast)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Text Size</label>
                <div className="text-size-options">
                  {[
                    { value: 'small', label: 'Small' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'large', label: 'Large' }
                  ].map((size) => (
                    <button
                      key={size.value}
                      className={`text-size-btn ${userPreferences.contentPreferences.textSize === size.value ? 'selected' : ''}`}
                      onClick={() => updateContentPreference('textSize', size.value)}
                    >
                      {size.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <div className="toggle-options">
                  <label className="toggle-option">
                    <input
                      type="checkbox"
                      checked={userPreferences.contentPreferences.animations}
                      onChange={(e) => updateContentPreference('animations', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                    <span className="toggle-label">Enable Animations</span>
                  </label>

                  <label className="toggle-option">
                    <input
                      type="checkbox"
                      checked={userPreferences.notifications}
                      onChange={(e) => updatePreference('notifications', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                    <span className="toggle-label">Study Reminders</span>
                  </label>

                  <label className="toggle-option">
                    <input
                      type="checkbox"
                      checked={userPreferences.adaptiveMode}
                      onChange={(e) => updatePreference('adaptiveMode', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                    <span className="toggle-label">Adaptive Learning</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
          
          {/* Enhanced Action Buttons */}
          <div className="preferences-actions">
            <button className="btn btn-primary btn-large" onClick={savePreferences}>
              💾 Save All Preferences
            </button>
            <button className="btn btn-secondary" onClick={resetPreferences}>
              🔄 Reset to Default
            </button>
            <button 
              className="btn btn-ghost" 
              onClick={() => {
                const dataStr = JSON.stringify(userPreferences, null, 2);
                const dataBlob = new Blob([dataStr], {type: 'application/json'});
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'learning-preferences.json';
                link.click();
              }}
            >
              📥 Export Settings
            </button>
          </div>

          {/* Personalization Insights */}
          {userPreferences.name && (
            <div className="personalization-insights">
              <h3>🧠 Your Learning Profile</h3>
              <div className="insights-grid">
                <div className="insight-card">
                  <div className="insight-icon">🎯</div>
                  <div className="insight-content">
                    <div className="insight-title">Learning Style</div>
                    <div className="insight-description">
                      Optimized for {userPreferences.learningStyle} learning with {userPreferences.difficulty} difficulty
                    </div>
                  </div>
                </div>
                
                <div className="insight-card">
                  <div className="insight-icon">⏰</div>
                  <div className="insight-content">
                    <div className="insight-title">Study Schedule</div>
                    <div className="insight-description">
                      {userPreferences.studyTime} min sessions, {userPreferences.weeklyGoal}x per week in the {userPreferences.preferredTime}
                    </div>
                  </div>
                </div>

                <div className="insight-card">
                  <div className="insight-icon">🛤️</div>
                  <div className="insight-content">
                    <div className="insight-title">Learning Path</div>
                    <div className="insight-description">
                      Following {userPreferences.learningPath.replace('-', ' ')} approach for optimal progress
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Condensed results rendering (maintaining all functionality)
  const renderResults = () => {
    if (!data) return null;
    
    return (
      <div style={{ marginTop: 'var(--space-8)' }}>
        {/* Enhanced Content Summary */}
        {data.summary && (
          <div className="content-summary-section">
            <div className="summary-header">
              <div className="summary-title">
                <span className="summary-icon">📋</span>
                <h3>Content Summary</h3>
              </div>
              <div className="summary-meta">
                <span className="reading-time">⏱️ ~{Math.ceil(data.summary.split(' ').length / 200)} min read</span>
              </div>
            </div>
            
            <div className="summary-content">
              <div className="summary-text">
                {data.summary}
              </div>
              
              <div className="summary-actions">
                <button 
                  className="summary-action-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(data.summary);
                    alert('Summary copied to clipboard!');
                  }}
                >
                  📋 Copy Summary
                </button>
                <button 
                  className="summary-action-btn"
                  onClick={() => setTab('chat')}
                >
                  💬 Discuss Summary
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Key Concepts Visualization */}
        {data.key_concepts && data.key_concepts.length > 0 && (
          <div className="key-concepts-section">
            <div className="concepts-header">
              <div className="concepts-title">
                <span className="concepts-icon">🔑</span>
                <h3>Key Concepts</h3>
              </div>
              <div className="concepts-count">
                {data.key_concepts.length} concepts identified
              </div>
            </div>
            
            <div className="concepts-grid">
              {data.key_concepts.map((concept, index) => (
                <div key={index} className="concept-card">
                  <div className="concept-number">{index + 1}</div>
                  <div className="concept-content">
                    <div className="concept-text">{concept}</div>
                    <button 
                      className="concept-action"
                      onClick={() => {
                        setChatInput(`Can you explain more about: ${concept}`);
                        setTab('chat');
                      }}
                      title="Ask AI about this concept"
                    >
                      🤖 Ask AI
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="concepts-visualization">
              <h4>Concept Map</h4>
              <div className="concept-map">
                <div className="concept-center">
                  <span className="main-topic">Learning Topic</span>
                </div>
                {data.key_concepts.slice(0, 6).map((concept, index) => (
                  <div 
                    key={index} 
                    className={`concept-node concept-node-${index + 1}`}
                    style={{
                      '--angle': `${(360 / Math.min(data.key_concepts.length, 6)) * index}deg`,
                      '--radius': '120px'
                    }}
                  >
                    <span className="node-text">{concept.length > 25 ? concept.substring(0, 25) + '...' : concept}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Quiz Section with Detailed Feedback */}
        {(data.question1 || data.question2 || data.question3) && (
          <div className="quiz-container">
            <div className="quiz-header">
              <h2 className="quiz-title">🎓 Knowledge Assessment</h2>
              <p className="quiz-subtitle">Test your understanding with interactive questions</p>
            </div>
            
            {!quizCompleted ? (
              <>
                <div className="quiz-progress-enhanced">
                  <div className={`progress-bar-enhanced progress-${currentQuestion - 1}`}>
                    {[1, 2, 3].map((num) => (
                      <div 
                        key={num} 
                        className={`progress-step-enhanced ${num < currentQuestion ? 'completed' : num === currentQuestion ? 'active' : 'upcoming'}`}
                      >
                        <div className="step-number">{num}</div>
                        <div className="step-label">
                          {num < currentQuestion ? '✓' : num === currentQuestion ? 'Current' : 'Upcoming'}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="progress-info-enhanced">
                    <span className="current-progress">Question {currentQuestion} of 3</span>
                    <span className="answers-count">{Object.keys(quizAnswers).length} answered</span>
                  </div>
                </div>
                
                <div className="question-container-enhanced">
                  {(() => {
                    const question = data[`question${currentQuestion}`];
                    const options = data[`options${currentQuestion}`] || [];
                    const bloomLevel = data[`bloom_level${currentQuestion}`] || 'Remember';
                    if (!question) return null;
                    
                    return (
                      <>
                        <div className="question-header-enhanced">
                          <div className="question-meta">
                            <span className="question-number">Question {currentQuestion}</span>
                            <span className={`bloom-level bloom-${bloomLevel.toLowerCase()}`}>
                              {bloomLevel}
                            </span>
                          </div>
                        </div>
                        <div className="question-text-enhanced">{question}</div>
                        <div className="quiz-options-enhanced">
                          {options.map((option, optionIndex) => (
                            <div 
                              key={optionIndex} 
                              className={`quiz-option-enhanced ${quizAnswers[currentQuestion] === optionIndex ? 'selected' : ''}`}
                              onClick={() => handleQuizAnswer(currentQuestion, optionIndex)}
                            >
                              <div className="option-indicator">
                                {String.fromCharCode(65 + optionIndex)}
                              </div>
                              <span className="option-text-enhanced">{option}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </>
            ) : (
              <div className="quiz-results-enhanced">
                <div className="results-summary-improved">
                  <div className="score-section">
                    <div className="score-circle">
                      <div className="score-percentage">{Math.round((quizScore / 3) * 100)}%</div>
                      <div className="score-label">Overall Score</div>
                    </div>
                    <div className="score-breakdown">
                      <div className="score-stat">
                        <span className="stat-number">{quizScore}</span>
                        <span className="stat-label">Correct</span>
                      </div>
                      <div className="score-divider">•</div>
                      <div className="score-stat">
                        <span className="stat-number">{3 - quizScore}</span>
                        <span className="stat-label">Incorrect</span>
                      </div>
                      <div className="score-divider">•</div>
                      <div className="score-stat">
                        <span className="stat-number">3</span>
                        <span className="stat-label">Total</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="assessment-summary">
                    <h3>🎉 Assessment Complete!</h3>
                    <p className="results-text">
                      You answered <strong>{quizScore} out of 3</strong> questions correctly
                    </p>
                    <div className="performance-badge">
                      {quizScore === 3 ? (
                        <span className="performance excellent">🌟 Excellent work!</span>
                      ) : quizScore >= 2 ? (
                        <span className="performance good">👍 Good job!</span>
                      ) : (
                        <span className="performance needs-improvement">📚 Keep practicing!</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="detailed-feedback-section">
                  <div className="feedback-header-section">
                    <h4>📝 Detailed Question Analysis</h4>
                    <p className="feedback-subtitle">Review your answers and learn from explanations</p>
                  </div>
                  
                  <div className="feedback-grid">
                    {[1, 2, 3].map((questionNum) => {
                    const question = data[`question${questionNum}`];
                    const options = data[`options${questionNum}`] || [];
                    const userAnswer = quizAnswers[questionNum];
                    const correctAnswer = data[`correct_option${questionNum}`] || 0;
                    const explanation = data[`explanation${questionNum}`] || '';
                    const isCorrect = userAnswer === correctAnswer;
                    
                    if (!question) return null;
                    
                    return (
                      <div key={questionNum} className="feedback-item">
                        <div className="feedback-header">
                          <span className="feedback-question-num">Q{questionNum}</span>
                          <span className={`feedback-result ${isCorrect ? 'correct' : 'incorrect'}`}>
                            {isCorrect ? '✅ Correct' : '❌ Incorrect'}
                          </span>
                        </div>
                        
                        <div className="feedback-question">{question}</div>
                        
                        <div className="feedback-answers">
                          <div className="answer-comparison">
                            {userAnswer !== undefined && (
                              <div className={`user-answer ${isCorrect ? 'correct' : 'incorrect'}`}>
                                <span className="answer-label">Your answer:</span>
                                <span className="answer-text">
                                  {String.fromCharCode(65 + userAnswer)}. {options[userAnswer]}
                                </span>
                              </div>
                            )}
                            
                            {!isCorrect && (
                              <div className="correct-answer">
                                <span className="answer-label">Correct answer:</span>
                                <span className="answer-text">
                                  {String.fromCharCode(65 + correctAnswer)}. {options[correctAnswer]}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          {explanation && (
                            <div className="explanation">
                              <span className="explanation-label">💡 Explanation:</span>
                              <p className="explanation-text">{explanation}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                    })}
                  </div>
                </div>
                
                <div className="quiz-actions">
                  <button className="btn btn-primary btn-large" onClick={resetQuiz}>
                    🔄 Retake Assessment
                  </button>
                  <button className="btn btn-secondary" onClick={() => setTab('chat')}>
                    💬 Discuss Results with AI
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Enhanced Interactive Flashcards */}
        {data.flashcards && data.flashcards.length > 0 && (
          <div className="flashcard-section">
            <div className="flashcard-header">
              <div className="flashcard-title">
                <span className="flashcard-icon">📚</span>
                <h3>Study Flashcards</h3>
              </div>
              <div className="flashcard-counter">
                <span className="current-card">{currentFlashcard + 1}</span>
                <span className="card-separator">of</span>
                <span className="total-cards">{data.flashcards.length}</span>
              </div>
            </div>
            
            <div className="flashcard-container-enhanced">
              <div className="flashcard-navigation">
                <button 
                  className={`nav-btn prev-btn ${currentFlashcard === 0 ? 'disabled' : ''}`}
                  onClick={() => {
                    if (currentFlashcard > 0) {
                      setCurrentFlashcard(currentFlashcard - 1);
                      setShowFlashcardAnswer(false);
                    }
                  }}
                  disabled={currentFlashcard === 0}
                >
                  <span className="nav-icon">‹</span>
                  <span className="nav-text">Previous</span>
                </button>
                
                <div className="flashcard-wrapper">
                  <div className="flashcard-enhanced">
                    <div className={`flashcard-inner ${showFlashcardAnswer ? 'flipped' : ''}`}>
                      <div className="flashcard-front-enhanced">
                        <div className="card-type-indicator">Question</div>
                        <div className="flashcard-content">
                          <div className="content-text">
                            {data.flashcards[currentFlashcard]?.front || data.flashcards[currentFlashcard]?.question}
                          </div>
                        </div>
                        <button 
                          className="reveal-btn" 
                          onClick={() => setShowFlashcardAnswer(true)}
                        >
                          <span className="reveal-icon">👁️</span>
                          Reveal Answer
                        </button>
                      </div>
                      
                      <div className="flashcard-back-enhanced">
                        <div className="card-type-indicator answer">Answer</div>
                        <div className="flashcard-content">
                          <div className="content-text">
                            {data.flashcards[currentFlashcard]?.back || data.flashcards[currentFlashcard]?.answer}
                          </div>
                        </div>
                        
                        <div className="flashcard-actions-enhanced">
                          <div className="action-prompt">How well did you know this?</div>
                          <div className="action-buttons">
                            <button 
                              className="action-btn difficult" 
                              onClick={() => handleFlashcardReview(false)}
                            >
                              <span className="action-icon">😓</span>
                              <span className="action-text">Difficult</span>
                            </button>
                            <button 
                              className="action-btn easy" 
                              onClick={() => handleFlashcardReview(true)}
                            >
                              <span className="action-icon">😊</span>
                              <span className="action-text">Easy</span>
                            </button>
                          </div>
                          <button 
                            className="hide-answer-btn" 
                            onClick={() => setShowFlashcardAnswer(false)}
                          >
                            Hide Answer
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <button 
                  className={`nav-btn next-btn ${currentFlashcard === data.flashcards.length - 1 ? 'disabled' : ''}`}
                  onClick={() => {
                    if (currentFlashcard < data.flashcards.length - 1) {
                      setCurrentFlashcard(currentFlashcard + 1);
                      setShowFlashcardAnswer(false);
                    }
                  }}
                  disabled={currentFlashcard === data.flashcards.length - 1}
                >
                  <span className="nav-text">Next</span>
                  <span className="nav-icon">›</span>
                </button>
              </div>
              
              <div className="flashcard-progress-enhanced">
                <div className="progress-bar-flashcards">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${((currentFlashcard + 1) / data.flashcards.length) * 100}%` }}
                  ></div>
                </div>
                <div className="progress-dots-enhanced">
                  {data.flashcards.map((_, index) => (
                    <button
                      key={index}
                      className={`progress-dot-enhanced ${index === currentFlashcard ? 'active' : index < currentFlashcard ? 'completed' : 'upcoming'}`}
                      onClick={() => {
                        setCurrentFlashcard(index);
                        setShowFlashcardAnswer(false);
                      }}
                      title={`Go to card ${index + 1}`}
                    >
                      {index < currentFlashcard ? '✓' : index + 1}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flashcard-controls">
                <button 
                  className="control-btn shuffle-btn"
                  onClick={() => {
                    const randomIndex = Math.floor(Math.random() * data.flashcards.length);
                    setCurrentFlashcard(randomIndex);
                    setShowFlashcardAnswer(false);
                  }}
                >
                  🔀 Shuffle
                </button>
                <button 
                  className="control-btn restart-btn"
                  onClick={() => {
                    setCurrentFlashcard(0);
                    setShowFlashcardAnswer(false);
                  }}
                >
                  🔄 Restart
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          {/* Logo and Logout on Left */}
          <div className="header-left">
            <div className="logo">
              <span className="logo-icon">🧠</span>
              <span>MicroLearn AI</span>
            </div>
            <button onClick={logout} className="logout-btn">
              Logout
            </button>
          </div>

          {/* Navigation in Center */}
          <nav className="nav-tabs">
            <div className="nav-left">
              <button
                className={tab === 'home' ? 'active' : ''}
                onClick={() => setTab('home')}
              >
                Home
              </button>
              <button
                className={tab === 'generator' ? 'active' : ''}
                onClick={() => setTab('generator')}
              >
                Create
              </button>
              <button
                className={tab === 'chat' ? 'active' : ''}
                onClick={() => setTab('chat')}
              >
                Assistant
              </button>
              <button
                className={tab === 'preferences' ? 'active' : ''}
                onClick={() => setTab('preferences')}
              >
                Settings
              </button>
            </div>
          </nav>

          {/* User Profile on Right */}
          <div className="user-profile-bar">
            {currentUser && (
              <div className="user-info">
                <div className="user-avatar">
                  {currentUser.photoURL ? (
                    <img src={currentUser.photoURL} alt="Profile" />
                  ) : (
                    currentUser.displayName?.[0] || currentUser.email?.[0] || 'U'
                  )}
                </div>
                <div className="user-details">
                  <div className="user-name">
                    {currentUser.displayName || 'User'}
                  </div>
                  <div className="user-email">
                    {currentUser.email}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      {tab === 'home' && renderHome()}
      {tab === 'generator' && renderGenerator()}
      {tab === 'chat' && renderChatInterface()}
      {tab === 'preferences' && renderPreferencesPanel()}
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const AppContent = () => {
  const { currentUser } = useAuth();
  
  if (!currentUser) {
    return <Auth />;
  }

  return <MainApp />;
};

export default App;