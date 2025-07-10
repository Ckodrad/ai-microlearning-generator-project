import React, { useState, useRef } from 'react';
import './App.css';

function App() {
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
  const textPreview = useRef("");
  
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
    adaptiveMode: true
  });
  const [showPersonalization, setShowPersonalization] = useState(false);

  // Load preferences from localStorage on component mount
  React.useEffect(() => {
    const savedPreferences = localStorage.getItem('userPreferences');
    if (savedPreferences) {
      try {
        setUserPreferences(JSON.parse(savedPreferences));
      } catch (error) {
        console.error('Failed to load preferences:', error);
      }
    }
  }, []);

  // Analytics for dashboard
  const getAnalytics = () => {
    if (!data) return { totalQuestions: 0, flashcards: 0, concepts: 0, progress: 0 };
    
    const totalQuestions = [data.question1, data.question2, data.question3].filter(Boolean).length;
    const flashcardsCount = data.flashcards?.length || 0;
    const conceptsCount = data.key_concepts?.length || 0;
    const progressPercent = quizCompleted ? Math.round((quizScore / totalQuestions) * 100) : 0;
    
    return {
      totalQuestions,
      flashcards: flashcardsCount,
      concepts: conceptsCount,
      progress: progressPercent
    };
  };

  // Drag-and-drop handlers
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

  // File input handler
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

  // Submit handler
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
      }
    } catch (e) {
      setError('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // File preview helpers
  const renderPreview = (type) => {
    if (!files[type]) return null;
    if (type === 'image') {
      return <img src={URL.createObjectURL(files.image)} alt="preview" className="preview-img" />;
    }
    if (type === 'audio') {
      return <span className="file-info">{files.audio.name}</span>;
    }
    if (type === 'text') {
      return <pre className="file-info">{textPreview.current || files.text.name}</pre>;
    }
    return null;
  };

  // Flashcard handlers
  const nextFlashcard = () => {
    if (data?.flashcards && currentFlashcard < data.flashcards.length - 1) {
      setCurrentFlashcard(currentFlashcard + 1);
      setShowFlashcardAnswer(false);
    }
  };

  const prevFlashcard = () => {
    if (currentFlashcard > 0) {
      setCurrentFlashcard(currentFlashcard - 1);
      setShowFlashcardAnswer(false);
    }
  };

  const handleFlashcardReview = async (correct) => {
    if (!progress?.session_id) return;
    
    const form = new FormData();
    form.append('session_id', progress.session_id);
    form.append('card_id', `card_${currentFlashcard}`);
    form.append('correct', correct);
    
    try {
      await fetch('http://localhost:8000/flashcard-review', {
        method: 'POST',
        body: form,
      });
    } catch (e) {
      console.error('Failed to update flashcard progress:', e);
    }
  };

  // Quiz handlers
  const handleQuizAnswer = (questionNum, selectedOption) => {
    setQuizAnswers(prev => ({
      ...prev,
      [questionNum]: selectedOption
    }));
    
    // Automatically move to next question after a short delay
    setTimeout(() => {
      if (questionNum < 3) {
        setCurrentQuestion(questionNum + 1);
      } else {
        // If it's the last question, submit the quiz
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
      
      results[num] = {
        userAnswer,
        correctOption,
        isCorrect,
        explanation: data[`explanation${num}`] || ''
      };
      
      if (isCorrect) correctAnswers++;
    });
    
    setQuizResults(results);
    setQuizCompleted(true);
    setQuizScore(correctAnswers);
    
    // Update progress if session exists
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
    setQuizAnswers({});
    setQuizResults({});
    setQuizCompleted(false);
    setQuizScore(0);
    setCurrentQuestion(1);
  };

  // AI Chat handlers
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
      // Simulate AI response with context from current data
      const contextInfo = data ? {
        hasQuiz: !!(data.question1 || data.question2 || data.question3),
        hasFlashcards: !!(data.flashcards && data.flashcards.length > 0),
        summary: data.summary,
        concepts: data.key_concepts,
        currentProgress: quizCompleted ? Math.round((quizScore / 3) * 100) : 0
      } : null;
      
      setTimeout(() => {
        const aiResponse = generateAIResponse(userMessage.content, contextInfo);
        const aiMessage = {
          id: Date.now() + 1,
          type: 'ai',
          content: aiResponse,
          timestamp: new Date().toLocaleTimeString()
        };
        
        setChatMessages(prev => [...prev, aiMessage]);
        setChatLoading(false);
      }, 1000 + Math.random() * 2000); // Simulate response time
      
    } catch (error) {
      setChatLoading(false);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: 'I apologize, but I\'m having trouble connecting right now. Please try again in a moment.',
        timestamp: new Date().toLocaleTimeString()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    }
  };

  const generateAIResponse = (userInput, context) => {
    const input = userInput.toLowerCase();
    
    // Context-aware responses
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
      
      if (input.includes('flashcard') || input.includes('review')) {
        if (context.hasFlashcards) {
          return `Perfect! You have ${context.hasFlashcards ? 'flashcards' : 'review materials'} ready. Spaced repetition is one of the most effective learning techniques. I recommend reviewing them multiple times over several days. Need help with any specific concept?`;
        }
        return 'Flashcards are excellent for memorization! Generate some learning materials first, and I\'ll help you create an effective review strategy.';
      }
      
      if (input.includes('summary') || input.includes('understand')) {
        if (context.summary) {
          return `Based on your content, the key points are: ${context.summary.slice(0, 150)}... Would you like me to elaborate on any specific aspect or explain how these concepts connect?`;
        }
      }
      
      if (input.includes('concept') || input.includes('explain')) {
        if (context.concepts && context.concepts.length > 0) {
          const conceptList = context.concepts.slice(0, 3).join(', ');
          return `I can help explain these key concepts from your material: ${conceptList}. Which one would you like to explore in more depth?`;
        }
      }
    }
    
    // General learning assistance
    if (input.includes('help') || input.includes('how')) {
      return 'I\'m here to support your learning journey! I can help you understand concepts, prepare for assessments, create study plans, or answer questions about the material. What specific area would you like assistance with?';
    }
    
    if (input.includes('study') || input.includes('learn')) {
      return `Great mindset! Effective studying involves active engagement. I recommend: 1) Breaking content into small chunks, 2) Testing yourself regularly, 3) Connecting new info to what you know, 4) Teaching concepts back to me. What\'s your preferred learning style?`;
    }
    
    if (input.includes('motivation') || input.includes('difficult')) {
      return 'Learning can be challenging, but every expert was once a beginner! Remember that difficulty often signals growth. Try breaking complex topics into smaller parts, celebrate small wins, and don\'t hesitate to ask for help. What specific challenge are you facing?';
    }
    
    if (input.includes('time') || input.includes('schedule')) {
      return 'Time management is crucial for learning! I recommend the Pomodoro Technique: 25-minute focused study sessions with 5-minute breaks. Consistency beats intensity - even 15 minutes daily can make a huge difference. What\'s your current study schedule like?';
    }
    
    // Default responses
    const responses = [
      'That\'s an interesting question! Can you provide more context about what you\'d like to learn?',
      'I\'m here to help you succeed! What specific aspect of the material would you like to explore?',
      'Learning is a journey, and I\'m glad to be part of yours! How can I assist you today?',
      'Great question! I can help you understand concepts, review material, or plan your studies. What would be most helpful?',
      'I love your curiosity! The best way I can help is if you share what you\'re trying to understand or achieve.'
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  };

  // Personalization handlers
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

  const savePreferences = () => {
    // In a real app, this would save to backend/localStorage
    localStorage.setItem('userPreferences', JSON.stringify(userPreferences));
    alert('Preferences saved successfully!');
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
      adaptiveMode: true
    });
  };

  const getAdaptiveInsights = () => {
    const insights = [];
    
    if (quizCompleted) {
      if (quizScore >= 2) {
        insights.push({
          icon: '🎯',
          text: 'Strong performance on assessments! Consider advancing to more challenging material.'
        });
      } else {
        insights.push({
          icon: '📚',
          text: 'Focus on reviewing core concepts. Repetition will strengthen understanding.'
        });
      }
    }
    
    if (userPreferences.learningStyle === 'visual' && data?.flashcards) {
      insights.push({
        icon: '🖼️',
        text: 'Visual learner detected! Flashcards and diagrams are perfect for your style.'
      });
    }
    
    if (userPreferences.pace === 'fast' && data) {
      insights.push({
        icon: '⚡',
        text: 'Fast learner! Consider exploring advanced topics or additional practice problems.'
      });
    }
    
    return insights;
  };

  const nextQuestion = () => {
    if (currentQuestion < 3) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const prevQuestion = () => {
    if (currentQuestion > 1) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  // Enhanced home page with dashboard
  const renderHome = () => {
    const analytics = getAnalytics();
    
    return (
      <div className="home-page">
        <div className="hero-section">
          <h1 className="main-title">
            🎓 {userPreferences.name ? `Welcome back, ${userPreferences.name}!` : 'AI-Powered Microlearning Generator'}
          </h1>
          <p className="hero-subtitle">
            {userPreferences.name 
              ? `Ready for your ${userPreferences.studyTime}-minute learning session? Let's continue your ${userPreferences.learningPath} journey!`
              : 'Transform your educational content into comprehensive learning modules with advanced AI technology'
            }
          </p>
          {userPreferences.name && (
            <div style={{ 
              background: 'linear-gradient(135deg, var(--accent-color) 0%, #059669 100%)',
              color: 'white',
              padding: '1rem 2rem',
              borderRadius: 'var(--radius-lg)',
              margin: '1rem auto',
              maxWidth: '600px',
              textAlign: 'center',
              fontWeight: 500
            }}>
              🎯 Personalized for {userPreferences.learningStyle} learning • {userPreferences.difficulty} difficulty • {userPreferences.pace} pace
            </div>
          )}
        </div>

        {data && (
          <div className="dashboard-stats">
            <div className="stat-card">
              <span className="stat-value">{analytics.totalQuestions}</span>
              <span className="stat-label">Quiz Questions</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{analytics.flashcards}</span>
              <span className="stat-label">Flashcards</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{analytics.concepts}</span>
              <span className="stat-label">Key Concepts</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{analytics.progress}%</span>
              <span className="stat-label">Progress</span>
            </div>
          </div>
        )}
        
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🎤</div>
            <h3>Audio Processing</h3>
            <p>Upload lecture recordings and get instant transcriptions with AI-powered speech recognition using Whisper technology</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🖼️</div>
            <h3>Image Analysis</h3>
            <p>Upload diagrams, charts, or photos and receive detailed descriptions and explanations powered by advanced vision models</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">📝</div>
            <h3>Text Processing</h3>
            <p>Paste notes or upload text files to generate concise summaries and targeted learning objectives</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">❓</div>
            <h3>Bloom's Taxonomy Quizzes</h3>
            <p>Automatically generate questions aligned with Remember, Understand, and Apply cognitive levels</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📚</div>
            <h3>Interactive Flashcards</h3>
            <p>Review key concepts with AI-generated flashcards and track your learning progress over time</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Progress Analytics</h3>
            <p>Monitor your learning journey with detailed progress analytics and performance insights</p>
          </div>
        </div>
        
        <div className="how-it-works">
          <h2>How It Works</h2>
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <h3>Upload Content</h3>
              <p>Upload your educational materials including audio, images, or text documents</p>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>AI Processing</h3>
              <p>Our advanced AI analyzes and processes your materials using state-of-the-art models</p>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>Learn & Practice</h3>
              <p>Get comprehensive learning modules with summaries, quizzes, and interactive flashcards</p>
            </div>
            <div className="step">
              <div className="step-number">4</div>
              <h3>Track Progress</h3>
              <p>Monitor your learning progress and identify areas for improvement</p>
            </div>
          </div>
        </div>
        
        <div className="cta-section">
          <button 
            className="btn btn-primary"
            style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}
            onClick={() => setTab('generator')}
          >
            <span>🚀</span>
            Start Creating Your Learning Module
          </button>
        </div>
      </div>
    );
  };

  // Enhanced generator page
  const renderGenerator = () => (
    <div className="generator-page">
      <div className="generator-header">
        <h2>🎯 Create Your Enhanced Learning Module</h2>
        <p>Upload your educational content and let AI create comprehensive learning materials tailored to your needs</p>
      </div>
      
      <div className="upload-card">
        <h3>📁 Upload Your Educational Content</h3>
        <div className="upload-grid">
          {[
            { type: 'audio', icon: '🎤', label: 'Audio File', accept: 'audio/*', desc: 'Lectures, recordings' },
            { type: 'image', icon: '🖼️', label: 'Image File', accept: 'image/*', desc: 'Diagrams, charts' },
            { type: 'text', icon: '📝', label: 'Text File', accept: '.txt', desc: 'Notes, documents' }
          ].map(({ type, icon, label, accept, desc }) => (
            <div
              key={type}
              className={`dropzone${dragActive[type] ? ' active' : ''}`}
              onDragEnter={(e) => handleDrag(e, type)}
              onDragOver={(e) => handleDrag(e, type)}
              onDragLeave={(e) => handleDrag(e, type)}
              onDrop={(e) => handleDrop(e, type)}
            >
              <div className="dropzone-header">
                <span className="dropzone-icon">{icon}</span>
                <label htmlFor={`file-${type}`}>{label}</label>
              </div>
              <input
                id={`file-${type}`}
                type="file"
                name={type}
                accept={accept}
                onChange={handleFile}
                style={{ display: 'none' }}
              />
              <div
                className="dropzone-content"
                onClick={() => document.getElementById(`file-${type}`).click()}
                tabIndex={0}
                role="button"
                aria-label={`Upload ${type}`}
              >
                {files[type] ? (
                  <div className="file-preview">
                    {renderPreview(type)}
                    <button className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); handleRemove(type); }}>
                      ✕ Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <span>Drag & drop or click to select</span>
                    <small style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>{desc}</small>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        
        <div className="prompt-section">
          <label htmlFor="prompt-input" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span className="prompt-icon">💭</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Or enter your content directly:</span>
          </label>
          <textarea
            id="prompt-input"
            className="prompt-input"
            rows={4}
            placeholder="Type or paste your lecture notes, questions, or educational content here..."
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            style={{
              width: '100%',
              borderRadius: 'var(--radius-lg)',
              border: '2px solid var(--border-color)',
              padding: '1rem',
              fontSize: '1rem',
              background: 'var(--background)',
              resize: 'vertical',
              minHeight: '100px',
              transition: 'border-color 0.2s ease',
              fontFamily: 'inherit'
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--primary-color)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
          />
        </div>
        
        <button className="submit-btn" onClick={handleSubmit} disabled={loading}>
          {loading ? (
            <>
              <span className="spinner" style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
              <span>AI is analyzing your content...</span>
            </>
          ) : (
            <>
              <span>🚀</span>
              <span>Generate Enhanced Learning Module</span>
            </>
          )}
        </button>
        
        {error && (
          <div className="error-msg" style={{
            color: 'var(--error-color)',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 'var(--radius-lg)',
            padding: '1rem',
            marginTop: '1rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            ⚠️ {error}
          </div>
        )}
      </div>
      
      {loading && (
        <div className="loading-section" style={{ textAlign: 'center', padding: '3rem 0' }}>
          <div className="loading-animation" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div className="loading-dots" style={{ display: 'flex', gap: '0.5rem' }}>
              <span style={{ width: '12px', height: '12px', background: 'var(--primary-color)', borderRadius: '50%', animation: 'bounce 1.4s ease-in-out infinite both' }}></span>
              <span style={{ width: '12px', height: '12px', background: 'var(--primary-color)', borderRadius: '50%', animation: 'bounce 1.4s ease-in-out infinite both', animationDelay: '-0.16s' }}></span>
              <span style={{ width: '12px', height: '12px', background: 'var(--primary-color)', borderRadius: '50%', animation: 'bounce 1.4s ease-in-out infinite both', animationDelay: '-0.32s' }}></span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Creating your personalized learning experience...</p>
          </div>
        </div>
      )}
      
      {renderResults()}
      
      {!loading && !data && !error && (
        <div className="empty-state" style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
          <div className="empty-icon" style={{ fontSize: '4rem', marginBottom: '1rem', display: 'block' }}>📚</div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Ready to Create Your Learning Module?</h3>
          <p>Upload your educational content above to get started with AI-powered learning!</p>
        </div>
      )}
    </div>
  );

  // Enhanced results display (keeping existing functionality)
  const renderResults = () => {
    if (!data) return null;
    
    return (
      <div className="results-section">
        <div className="results-header">
          <h2>🎓 Your Personalized Learning Module</h2>
          <p className="results-subtitle">Your AI-generated educational content is ready for learning!</p>
        </div>
        
        {data.caption && (
          <div className="result-card">
            <div className="result-icon">🖼️</div>
            <div className="result-content">
              <h3>Image Analysis</h3>
              <p>{data.caption}</p>
            </div>
          </div>
        )}
        
        {data.summary && (
          <div className="result-card">
            <div className="result-icon">📝</div>
            <div className="result-content">
              <h3>Key Summary</h3>
              <p>{data.summary}</p>
            </div>
          </div>
        )}

        {data.learning_objectives && data.learning_objectives.length > 0 && (
          <div className="result-card">
            <div className="result-icon">🎯</div>
            <div className="result-content">
              <h3>Learning Objectives</h3>
              <ul className="objectives-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {data.learning_objectives.map((objective, index) => (
                  <li key={index} style={{
                    background: '#f0f9ff',
                    borderLeft: '4px solid var(--primary-color)',
                    padding: '0.75rem 1rem',
                    marginBottom: '0.5rem',
                    borderRadius: '0 var(--radius-md) var(--radius-md) 0',
                    color: 'var(--text-primary)',
                    fontWeight: 500
                  }}>{objective}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {data.key_concepts && data.key_concepts.length > 0 && (
          <div className="result-card">
            <div className="result-icon">🔑</div>
            <div className="result-content">
              <h3>Key Concepts</h3>
              <div className="concepts-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                {data.key_concepts.map((concept, index) => (
                  <span key={index} className="concept-tag" style={{
                    background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%)',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '0.875rem',
                    fontWeight: 600
                  }}>{concept}</span>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Rest of the results components remain the same but with enhanced styling */}
        {(data.question1 || data.question2 || data.question3) && (
          <div className="quiz-container">
            <div className="quiz-header">
              <h3>🎯 Knowledge Assessment</h3>
              <p className="quiz-subtitle">Test your understanding with Bloom's Taxonomy-aligned questions</p>
            </div>
            
            {!quizCompleted ? (
              <>
                <div className="quiz-progress">
                  <div className="progress-container">
                    <div className="progress-bar">
                      {[1, 2, 3].map((num) => (
                        <div 
                          key={num} 
                          className={`progress-step ${num <= currentQuestion ? 'active' : ''} ${quizAnswers[num] !== undefined ? 'answered' : ''}`}
                        />
                      ))}
                    </div>
                    <div className="progress-labels">
                      <span className="progress-label">Question {currentQuestion} of 3</span>
                      <span className="progress-label">{Object.keys(quizAnswers).length} answered</span>
                    </div>
                  </div>
                </div>
                
                <div className="quiz-question-container">
                  {(() => {
                    const question = data[`question${currentQuestion}`];
                    const options = data[`options${currentQuestion}`] || [];
                    const bloomLevel = data[`bloom_level${currentQuestion}`] || 'Remember';
                    if (!question) return null;
                    
                    return (
                      <>
                        <div className="question-header">
                          <span className="question-number">Question {currentQuestion}</span>
                          <span className={`bloom-level ${bloomLevel.toLowerCase()}`}>
                            {bloomLevel}
                          </span>
                        </div>
                        <p className="question-text">{question}</p>
                        <div className="quiz-options">
                          {options.map((option, optionIndex) => (
                            <div 
                              key={optionIndex} 
                              className={`quiz-option ${quizAnswers[currentQuestion] === optionIndex ? 'selected' : ''} ${quizCompleted ? 'quiz-completed' : ''}`}
                              onClick={() => handleQuizAnswer(currentQuestion, optionIndex)}
                            >
                              <span className="option-text">{option}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
                
                <div className="quiz-navigation" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginTop: '2rem', position: 'relative' }}>
                  <button 
                    className="btn btn-secondary"
                    onClick={prevQuestion}
                    disabled={currentQuestion === 1}
                    style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'white', border: '2px solid rgba(255, 255, 255, 0.2)' }}
                  >
                    ← Previous
                  </button>
                  <div className="quiz-instructions" style={{ flex: 1, textAlign: 'center' }}>
                    <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                      Click an option to answer and automatically proceed
                    </p>
                  </div>
                  {currentQuestion < 3 && quizAnswers[currentQuestion] !== undefined && (
                    <button
                      className="btn btn-secondary"
                      style={{ position: 'absolute', right: 0, background: 'rgba(255, 255, 255, 0.1)', color: 'white', border: '2px solid rgba(255, 255, 255, 0.2)' }}
                      onClick={nextQuestion}
                    >
                      Next →
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="quiz-results" style={{ background: 'var(--background)', borderRadius: 'var(--radius-xl)', padding: '2rem', boxShadow: 'var(--shadow-lg)' }}>
                <div className="quiz-score" style={{
                  textAlign: 'center',
                  padding: '2rem',
                  background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%)',
                  color: 'white',
                  borderRadius: 'var(--radius-xl)',
                  marginBottom: '2rem'
                }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', fontWeight: 700 }}>🎉 Assessment Complete!</h4>
                  <p style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', opacity: 0.9 }}>You answered {quizScore} out of 3 questions correctly!</p>
                  <div className="score-percentage" style={{ fontSize: '3.5rem', fontWeight: 800, margin: 0, textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
                    {Math.round((quizScore / 3) * 100)}%
                  </div>
                </div>
                
                <div className="quiz-results-navigation">
                  <div className="results-progress" style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    {[1, 2, 3].map((num) => (
                      <button
                        key={num}
                        className={`result-step ${num === currentQuestion ? 'active' : ''} ${quizResults[num]?.isCorrect ? 'correct' : 'incorrect'}`}
                        onClick={() => setCurrentQuestion(num)}
                        style={{
                          width: '60px',
                          height: '60px',
                          borderRadius: '50%',
                          background: quizResults[num]?.isCorrect ? 'var(--accent-color)' : 'var(--error-color)',
                          color: 'white',
                          border: `3px solid ${num === currentQuestion ? (quizResults[num]?.isCorrect ? 'var(--accent-color)' : 'var(--error-color)') : 'transparent'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '1.2rem',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          boxShadow: 'var(--shadow-md)',
                          transform: num === currentQuestion ? 'scale(1.1)' : 'scale(1)'
                        }}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  
                  <div className="quiz-question-container">
                    {(() => {
                      const question = data[`question${currentQuestion}`];
                      const options = data[`options${currentQuestion}`] || [];
                      const bloomLevel = data[`bloom_level${currentQuestion}`] || 'Remember';
                      const result = quizResults[currentQuestion];
                      if (!question) return null;
                      
                      return (
                        <>
                          <div className="question-header">
                            <span className="question-number">Question {currentQuestion}</span>
                            <span className={`bloom-level ${bloomLevel.toLowerCase()}`}>
                              {bloomLevel}
                            </span>
                            <span className={`result-indicator ${result?.isCorrect ? 'correct' : 'incorrect'}`} style={{
                              fontSize: '1.5rem',
                              marginLeft: 'auto',
                              color: result?.isCorrect ? 'var(--accent-color)' : 'var(--error-color)'
                            }}>
                              {result?.isCorrect ? '✅' : '❌'}
                            </span>
                          </div>
                          <p className="question-text">{question}</p>
                          <div className="quiz-options">
                            {options.map((option, optionIndex) => {
                              const isUserAnswer = optionIndex === result?.userAnswer;
                              const isCorrectAnswer = optionIndex === result?.correctOption;
                              const isIncorrectUserAnswer = isUserAnswer && !isCorrectAnswer;
                              
                              return (
                                <div 
                                  key={optionIndex} 
                                  className={`quiz-option ${
                                    isUserAnswer ? 'selected' : ''
                                  } ${
                                    isCorrectAnswer ? 'correct' : ''
                                  } ${
                                    isIncorrectUserAnswer ? 'incorrect' : ''
                                  }`}
                                >
                                  <span className="option-text">{option}</span>
                                </div>
                              );
                            })}
                          </div>
                          {result?.explanation && (
                            <div className="explanation-text" style={{
                              background: 'var(--surface)',
                              borderLeft: '4px solid var(--primary-color)',
                              padding: '1rem',
                              marginTop: '1rem',
                              borderRadius: '0 var(--radius-md) var(--radius-md) 0',
                              color: 'var(--text-primary)',
                              fontSize: '0.95rem',
                              lineHeight: 1.6
                            }}>
                              <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Explanation:</strong> {result.explanation}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
                
                <div className="quiz-navigation" style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
                  <button className="btn btn-primary" onClick={resetQuiz} style={{ padding: '0.75rem 2rem' }}>
                    Retake Assessment
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Keep existing flashcard and progress sections with enhanced styling */}
        {data.flashcards && data.flashcards.length > 0 && (
          <div className="result-card flashcard-section">
            <div className="result-icon">📚</div>
            <div className="result-content">
              <h3>Interactive Flashcards</h3>
              <div className="flashcard-container">
                <div className="flashcard" style={{
                  background: 'var(--background)',
                  borderRadius: 'var(--radius-xl)',
                  padding: '2rem',
                  boxShadow: 'var(--shadow-md)',
                  marginBottom: '1rem',
                  border: '1px solid var(--border-color)'
                }}>
                  <div className="flashcard-header" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1.5rem',
                    paddingBottom: '1rem',
                    borderBottom: '1px solid var(--border-color)'
                  }}>
                    <span className="flashcard-counter" style={{
                      background: 'var(--primary-color)',
                      color: 'white',
                      padding: '0.25rem 0.75rem',
                      borderRadius: 'var(--radius-lg)',
                      fontSize: '0.875rem',
                      fontWeight: 600
                    }}>
                      {currentFlashcard + 1} / {data.flashcards.length}
                    </span>
                    <span className="flashcard-category" style={{
                      background: '#f0f9ff',
                      color: 'var(--primary-color)',
                      padding: '0.25rem 0.75rem',
                      borderRadius: 'var(--radius-lg)',
                      fontSize: '0.875rem',
                      fontWeight: 600
                    }}>
                      {data.flashcards[currentFlashcard]?.category || 'Learning'}
                    </span>
                  </div>
                  <div className="flashcard-content">
                    <div className="flashcard-front">
                      <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontWeight: 700 }}>Question/Concept</h4>
                      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '1.1rem' }}>{data.flashcards[currentFlashcard]?.front}</p>
                    </div>
                    {showFlashcardAnswer && (
                      <div className="flashcard-back" style={{
                        marginTop: '1rem',
                        paddingTop: '1rem',
                        borderTop: '1px solid var(--border-color)'
                      }}>
                        <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontWeight: 700 }}>Answer/Explanation</h4>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '1.1rem' }}>{data.flashcards[currentFlashcard]?.back}</p>
                      </div>
                    )}
                  </div>
                  <div className="flashcard-controls" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <button 
                      className="btn btn-primary"
                      onClick={() => setShowFlashcardAnswer(!showFlashcardAnswer)}
                      style={{ padding: '0.75rem 1.5rem' }}
                    >
                      {showFlashcardAnswer ? 'Hide Answer' : 'Show Answer'}
                    </button>
                    {showFlashcardAnswer && (
                      <div className="flashcard-feedback" style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '1rem',
                        background: 'var(--surface)',
                        borderRadius: 'var(--radius-md)'
                      }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Was this helpful?</span>
                        <button 
                          className="btn btn-secondary"
                          onClick={() => handleFlashcardReview(true)}
                          style={{ background: 'var(--accent-color)', color: 'white', border: 'none' }}
                        >
                          ✅ Yes
                        </button>
                        <button 
                          className="btn btn-secondary"
                          onClick={() => handleFlashcardReview(false)}
                          style={{ background: 'var(--error-color)', color: 'white', border: 'none' }}
                        >
                          ❌ No
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flashcard-navigation" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <button 
                    className="btn btn-secondary"
                    onClick={prevFlashcard}
                    disabled={currentFlashcard === 0}
                  >
                    ← Previous
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={nextFlashcard}
                    disabled={currentFlashcard === data.flashcards.length - 1}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {progress && (
          <div className="result-card progress-section">
            <div className="result-icon">📊</div>
            <div className="result-content">
              <h3>Learning Analytics</h3>
              <div className="progress-stats" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginTop: '1rem'
              }}>
                <div className="progress-item" style={{
                  background: 'var(--surface)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span className="progress-label" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Session ID:</span>
                  <span className="progress-value" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{progress.session_id.slice(0, 8)}...</span>
                </div>
                <div className="progress-item" style={{
                  background: 'var(--surface)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span className="progress-label" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Modules Completed:</span>
                  <span className="progress-value" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{progress.completed_modules}</span>
                </div>
                <div className="progress-item" style={{
                  background: 'var(--surface)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span className="progress-label" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Flashcards Reviewed:</span>
                  <span className="progress-value" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    {Object.keys(progress.flashcard_progress || {}).length}
                  </span>
                </div>
                <div className="progress-item" style={{
                  background: 'var(--surface)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span className="progress-label" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Last Activity:</span>
                  <span className="progress-value" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    {new Date(progress.last_activity).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="raw-data-toggle" style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button 
            className="btn btn-secondary"
            onClick={() => setExpanded(prev => ({ ...prev, rawData: !prev.rawData }))}
          >
            {expanded.rawData ? 'Hide' : 'Show'} Raw JSON Data
          </button>
          {expanded.rawData && (
            <div className="raw-data" style={{
              marginTop: '1rem',
              background: 'var(--text-primary)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              overflowX: 'auto'
            }}>
              <pre className="json-viewer" style={{
                color: '#e2e8f0',
                fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
                fontSize: '0.875rem',
                lineHeight: 1.5,
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
              }}>{JSON.stringify(data, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Chat interface component
  const renderChatInterface = () => (
    <div className="chat-interface">
      <div className="chat-header">
        <div className="chat-avatar">🤖</div>
        <div className="chat-title">
          <h3>AI Learning Assistant</h3>
          <p>Ask questions, get explanations, and receive personalized guidance</p>
        </div>
        <div className="chat-status">
          <div className="status-indicator"></div>
          <span>Online</span>
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
            <div className="typing-indicator">
              <div className="typing-dots">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
              <span>AI is thinking...</span>
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
            className="chat-send-btn"
            onClick={sendChatMessage}
            disabled={chatLoading || !chatInput.trim()}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );

  // Personalization panel component
  const renderPersonalizationPanel = () => {
    const insights = getAdaptiveInsights();
    
    return (
      <div className="personalization-panel">
        <div className="personalization-header">
          <span style={{ fontSize: '2rem' }}>⚙️</span>
          <h3>Learning Preferences</h3>
        </div>
        
        <div className="personalization-grid">
          <div className="preference-section">
            <h4>👤 Personal Information</h4>
            <div className="preference-group">
              <label className="preference-label">Name</label>
              <input
                type="text"
                className="preference-input"
                value={userPreferences.name}
                onChange={(e) => updatePreference('name', e.target.value)}
                placeholder="Enter your name"
              />
            </div>
          </div>
          
          <div className="preference-section">
            <h4>🎯 Learning Style</h4>
            <div className="preference-group">
              <label className="preference-label">Preferred Learning Style</label>
              <select
                className="preference-select"
                value={userPreferences.learningStyle}
                onChange={(e) => updatePreference('learningStyle', e.target.value)}
              >
                <option value="visual">Visual (Images, Diagrams)</option>
                <option value="auditory">Auditory (Sound, Music)</option>
                <option value="kinesthetic">Kinesthetic (Hands-on)</option>
                <option value="reading">Reading/Writing</option>
              </select>
            </div>
            
            <div className="preference-group">
              <label className="preference-label">Difficulty Level</label>
              <select
                className="preference-select"
                value={userPreferences.difficulty}
                onChange={(e) => updatePreference('difficulty', e.target.value)}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>
          
          <div className="preference-section">
            <h4>⏱️ Study Preferences</h4>
            <div className="preference-group">
              <label className="preference-label">Learning Pace</label>
              <select
                className="preference-select"
                value={userPreferences.pace}
                onChange={(e) => updatePreference('pace', e.target.value)}
              >
                <option value="slow">Slow & Thorough</option>
                <option value="moderate">Moderate</option>
                <option value="fast">Fast & Efficient</option>
              </select>
            </div>
            
            <div className="preference-group">
              <label className="preference-label">Daily Study Time (minutes)</label>
              <div className="slider-group">
                <input
                  type="range"
                  className="slider-input"
                  min="15"
                  max="120"
                  step="15"
                  value={userPreferences.studyTime}
                  onChange={(e) => updatePreference('studyTime', parseInt(e.target.value))}
                />
                <div className="slider-value">{userPreferences.studyTime} minutes</div>
              </div>
            </div>
          </div>
          
          <div className="preference-section">
            <h4>🎓 Learning Interests</h4>
            <div className="checkbox-group">
              {[
                'Science & Technology',
                'Business & Finance', 
                'Arts & Literature',
                'History & Culture',
                'Health & Medicine',
                'Mathematics',
                'Languages',
                'Programming'
              ].map((interest) => (
                <div key={interest} className="checkbox-item">
                  <input
                    type="checkbox"
                    className="checkbox-input"
                    checked={userPreferences.interests.includes(interest)}
                    onChange={(e) => updateInterests(interest, e.target.checked)}
                  />
                  <label className="checkbox-label">{interest}</label>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="learning-paths">
          <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🛤️ Adaptive Learning Paths
          </h4>
          
          {[
            {
              id: 'balanced',
              title: 'Balanced Approach',
              description: 'Mix of theory and practice with regular assessments',
              features: ['Mixed content', 'Regular quizzes', 'Progress tracking']
            },
            {
              id: 'practice-heavy',
              title: 'Practice-Heavy',
              description: 'Focus on hands-on exercises and practical applications',
              features: ['More exercises', 'Real examples', 'Applied learning']
            },
            {
              id: 'theory-focused',
              title: 'Theory-Focused',
              description: 'Deep conceptual understanding with comprehensive explanations',
              features: ['Detailed explanations', 'Concept mapping', 'Critical thinking']
            },
            {
              id: 'rapid-review',
              title: 'Rapid Review',
              description: 'Quick summaries and frequent testing for fast learning',
              features: ['Concise content', 'Frequent testing', 'Quick feedback']
            }
          ].map((path) => (
            <div
              key={path.id}
              className={`learning-path-card ${userPreferences.learningPath === path.id ? 'selected' : ''}`}
              onClick={() => updatePreference('learningPath', path.id)}
            >
              <div className="learning-path-title">{path.title}</div>
              <div className="learning-path-description">{path.description}</div>
              <div className="learning-path-features">
                {path.features.map((feature, index) => (
                  <span key={index} className="feature-tag">{feature}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        {insights.length > 0 && (
          <div className="adaptive-insights">
            <h4>🧠 AI Insights & Recommendations</h4>
            <div className="insight-list">
              {insights.map((insight, index) => (
                <div key={index} className="insight-item">
                  <span className="insight-icon">{insight.icon}</span>
                  <span className="insight-text">{insight.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="preferences-actions">
          <button className="btn-save" onClick={savePreferences}>
            💾 Save Preferences
          </button>
          <button className="btn-reset" onClick={resetPreferences}>
            🔄 Reset to Default
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      <nav className="nav-tabs">
        <button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>
          🏠 Dashboard
        </button>
        <button className={tab === 'generator' ? 'active' : ''} onClick={() => setTab('generator')}>
          🎯 Generator
        </button>
        <button className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>
          💬 AI Assistant
        </button>
        <button className={tab === 'preferences' ? 'active' : ''} onClick={() => setTab('preferences')}>
          ⚙️ Preferences
        </button>
      </nav>
      
      {tab === 'home' && renderHome()}
      {tab === 'generator' && renderGenerator()}
      {tab === 'chat' && renderChatInterface()}
      {tab === 'preferences' && renderPersonalizationPanel()}
    </div>
  );
}

export default App;