# 🎓 AI-Powered Microlearning Generator

An advanced educational technology platform that transforms multimodal content into comprehensive learning experiences using cutting-edge AI technologies.

## 🌟 Features

### 🎯 **Core Functionality**
- **Multimodal Content Processing**: Upload audio, images, or text files
- **AI-Powered Content Generation**: Generate summaries, quizzes, and flashcards
- **Bloom's Taxonomy Alignment**: Questions aligned with Remember, Understand, and Apply levels
- **Interactive Learning Materials**: Engaging flashcards and progress tracking

### 💬 **AI Chat Assistant** 
- **Conversational Learning**: Interactive AI assistant inspired by Socrat.ai
- **Context-Aware Responses**: AI understands your learning materials and progress
- **Personalized Guidance**: Adaptive responses based on user preferences and performance
- **Learning Support**: Study tips, motivation, and concept explanations

### ⚙️ **Personalization Features** (New!)
- **Learning Style Adaptation**: Visual, Auditory, Kinesthetic, or Reading/Writing preferences
- **Difficulty Levels**: Beginner, Intermediate, or Advanced content
- **Study Preferences**: Custom pace and daily study time settings
- **Learning Interests**: 8 different subject areas to tailor content
- **Adaptive Learning Paths**: 
  - Balanced Approach
  - Practice-Heavy
  - Theory-Focused
  - Rapid Review

### 📊 **Enhanced Dashboard**
- **Learning Analytics**: Comprehensive progress tracking and insights
- **Personalized Welcome**: Dynamic greetings and study recommendations
- **Progress Visualization**: Interactive charts and statistics
- **Performance Insights**: AI-powered recommendations based on learning patterns

### 🎨 **Modern UI/UX**
- **Alice.tech-Inspired Design**: Clean, modern interface with card-based layouts
- **Mobile Responsive**: Fully optimized for all screen sizes
- **Smooth Animations**: Engaging transitions and interactive elements
- **Accessibility**: WCAG-compliant design with keyboard navigation

## 🚀 Technologies Used

### Backend
- **FastAPI**: High-performance Python web framework
- **OpenAI GPT-4o**: Advanced language model for content generation
- **Whisper**: State-of-the-art speech recognition
- **BLIP**: Image captioning and visual understanding
- **Transformers**: Hugging Face model library

### Frontend
- **React 19**: Latest React with modern hooks and features
- **Vite**: Fast build tool and development server
- **Modern CSS**: CSS Grid, Flexbox, and custom properties
- **Responsive Design**: Mobile-first approach

## 📋 Prerequisites

- **Python 3.8+**
- **Node.js 16+**
- **npm or yarn**
- **OpenAI API Key** (optional, mock data available)

## 🛠️ Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd Project\ Code
```

### 2. Backend Setup
```bash
cd backend

# Install Python dependencies
pip install fastapi uvicorn whisper transformers torch torchvision pillow openai

# Set OpenAI API key (optional)
export OPENAI_API_KEY="your-api-key-here"

# Start the backend server
python server.py
```

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

### 4. Access the Application
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000

## 🎯 Usage Guide

### 1. **Dashboard** 🏠
- View your learning analytics and progress
- Access personalized recommendations
- Quick navigation to all features

### 2. **Generator** 🎯
- Upload audio files (lectures, recordings)
- Upload images (diagrams, charts, photos)
- Upload text files or paste content directly
- Generate comprehensive learning modules

### 3. **AI Assistant** 💬
- Ask questions about your learning materials
- Get explanations and study guidance
- Receive personalized learning recommendations
- Interactive chat with context awareness

### 4. **Preferences** ⚙️
- Set your learning style and preferences
- Choose difficulty level and pace
- Select areas of interest
- Configure adaptive learning paths
- View AI-powered insights

## 🔧 API Endpoints

### Content Processing
- `POST /process` - Upload and process multimodal content
- `POST /update-progress` - Update learning progress
- `GET /progress/{session_id}` - Retrieve progress data

### Learning Analytics
- `POST /flashcard-review` - Record flashcard interactions
- `POST /quiz-complete` - Submit quiz results
- `GET /health` - Health check endpoint


## 🧠 AI Features

### Content Analysis
- **Speech-to-Text**: Whisper-powered transcription
- **Image Understanding**: BLIP-based visual analysis
- **Text Processing**: Advanced NLP for summaries

### Educational Content Generation
- **Bloom's Taxonomy Questions**: Cognitive level alignment
- **Flashcard Creation**: Spaced repetition materials
- **Learning Objectives**: Clear goal setting
- **Progress Tracking**: Detailed analytics

### Personalization Engine
- **Learning Style Adaptation**: Content presentation optimization
- **Difficulty Adjustment**: Adaptive content complexity
- **Interest-Based Recommendations**: Tailored learning paths
- **Performance Analysis**: AI-powered insights

## 📱 Mobile Optimization

- **Responsive Design**: Optimized for phones and tablets
- **Touch-Friendly**: Large buttons and touch targets
- **Performance**: Optimized for mobile networks
- **Accessibility**: Screen reader compatible

## 🔒 Privacy & Security

- **Local Storage**: User preferences stored locally
- **No Personal Data Collection**: Privacy-first approach
- **Secure API Communication**: HTTPS and CORS protection
- **Optional API Keys**: Mock data available without external APIs

---
