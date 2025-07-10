#!/bin/bash

# Development startup script for AI Microlearning Generator
echo "🚀 Starting AI Microlearning Generator Development Environment"

# Function to kill background processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    kill $(jobs -p) 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Check if required dependencies are installed
echo "📋 Checking dependencies..."

# Check Python and backend dependencies
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed"
    exit 1
fi

# Check Node.js and frontend dependencies
if ! command -v npm &> /dev/null; then
    echo "❌ Node.js/npm is not installed"
    exit 1
fi

# Install backend dependencies if needed
echo "🐍 Setting up backend..."
cd backend
if [ ! -f "requirements.txt" ]; then
    echo "❌ Backend requirements.txt not found"
    exit 1
fi

pip install -r requirements.txt > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "⚠️  Some backend dependencies might be missing, but continuing..."
fi

# Start backend server
echo "🖥️  Starting backend server on http://localhost:8000..."
python3 server.py &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Install frontend dependencies if needed
echo "⚛️  Setting up frontend..."
cd ../frontend
if [ ! -f "package.json" ]; then
    echo "❌ Frontend package.json not found"
    exit 1
fi

npm install > /dev/null 2>&1

# Start frontend server
echo "🌐 Starting frontend server on http://localhost:5173..."
npm run dev &
FRONTEND_PID=$!

# Display startup information
echo ""
echo "✅ Development environment started successfully!"
echo ""
echo "📊 Server Information:"
echo "   Backend:  http://localhost:8000"
echo "   Frontend: http://localhost:5173"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "🛠️  Available Commands:"
echo "   Ctrl+C: Stop all servers"
echo ""
echo "📝 Logs will appear below..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Wait for all background processes
wait 