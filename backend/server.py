# server.py
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from modalities import transcribe_audio, caption_image, generate_enhanced_content, create_progress_tracker, update_progress
import json
import os
from typing import Dict, Any

app = FastAPI()

# Allow your React dev server to talk to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # lock this down in production!
    allow_methods=["POST","GET"],
    allow_headers=["*"],
)

# In-memory storage for progress (in production, use a database)
progress_store: Dict[str, Dict[str, Any]] = {}

@app.post("/process")
async def process_modalities(
    audio: UploadFile = File(None),
    image: UploadFile = File(None),
    text:  UploadFile = File(None),
    prompt: str = Form(None),
):
    result = {}
    try:
        if audio:
            # save to disk (or process in-memory)
            a_path = f"/tmp/{audio.filename}"
            with open(a_path, "wb") as f:
                f.write(await audio.read())
            result["input_audio"] = await transcribe_audio(a_path)

        if image:
            i_path = f"/tmp/{image.filename}"
            with open(i_path, "wb") as f:
                f.write(await image.read())
            result["caption"] = caption_image(i_path)

        if text:
            text_str = (await text.read()).decode("utf-8")
            # we'll merge into a single blob:
            result["input_text"] = text_str

        if prompt:
            result["input_prompt"] = prompt

        # combine any text sources
        combined = "\n".join([
            result.get("input_audio",""),
            result.get("input_text",""),
            result.get("input_prompt","")
        ]).strip()
        
        print(f"DEBUG: Combined text length: {len(combined)}")
        print(f"DEBUG: Combined text: {combined[:100]}...")
        print(f"DEBUG: Result keys: {list(result.keys())}")
        
        if combined:
            print("DEBUG: Generating enhanced content...")
            try:
                enhanced_content = generate_enhanced_content(combined)
                print(f"DEBUG: Enhanced content keys: {list(enhanced_content.keys())}")
                
                # Convert questions array to individual fields for frontend compatibility
                if "questions" in enhanced_content and enhanced_content["questions"]:
                    questions = enhanced_content["questions"]
                    for i, question_data in enumerate(questions[:3], 1):  # Limit to 3 questions
                        result[f"question{i}"] = question_data.get("question", "")
                        result[f"answer{i}"] = question_data.get("answer", "")
                        result[f"bloom_level{i}"] = question_data.get("bloom_level", "Remember")
                        result[f"explanation{i}"] = question_data.get("explanation", "")
                        
                        # Generate multiple choice options
                        options = question_data.get("options", [])
                        if not options:
                            # Create mock options if none provided
                            correct_answer = question_data.get("answer", "")
                            options = [
                                correct_answer,
                                f"Option B for question {i}",
                                f"Option C for question {i}",
                                f"Option D for question {i}"
                            ]
                        
                        # Randomize options and track correct answer position
                        import random
                        correct_answer = question_data.get("answer", "")
                        correct_index = 0
                        
                        # Find the correct answer in options
                        for idx, option in enumerate(options):
                            if option == correct_answer:
                                correct_index = idx
                                break
                        
                        # Shuffle options
                        random.shuffle(options)
                        
                        # Update correct index after shuffling
                        for idx, option in enumerate(options):
                            if option == correct_answer:
                                correct_index = idx
                                break
                        
                        result[f"options{i}"] = options
                        result[f"correct_option{i}"] = correct_index
                
                # Add other enhanced content
                result.update({
                    "summary": enhanced_content.get("summary", ""),
                    "learning_objectives": enhanced_content.get("learning_objectives", []),
                    "key_concepts": enhanced_content.get("key_concepts", []),
                    "flashcards": enhanced_content.get("flashcards", []),
                    "difficulty_level": enhanced_content.get("difficulty_level", "intermediate")
                })
                
                # Create progress tracker for this session
                progress = create_progress_tracker()
                result["progress"] = progress
                progress_store[progress["session_id"]] = progress
                print("DEBUG: Successfully updated result with enhanced content")
            except Exception as e:
                print(f"DEBUG: Error in enhanced content generation: {e}")
                import traceback
                traceback.print_exc()
        else:
            print("DEBUG: No combined text to process")

        return JSONResponse(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/update-progress")
async def update_user_progress(
    session_id: str = Form(...),
    action: str = Form(...),
    data: str = Form(None)
):
    """Update user progress for various learning activities."""
    try:
        if session_id not in progress_store:
            raise HTTPException(status_code=404, detail="Session not found")
        
        progress_data = progress_store[session_id]
        
        # Parse data if provided
        parsed_data = None
        if data:
            try:
                parsed_data = json.loads(data)
            except json.JSONDecodeError:
                parsed_data = {"data": data}
        
        # Update progress
        updated_progress = update_progress(progress_data, action, parsed_data)
        progress_store[session_id] = updated_progress
        
        return JSONResponse({
            "success": True,
            "progress": updated_progress
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/progress/{session_id}")
async def get_progress(session_id: str):
    """Get progress for a specific session."""
    try:
        if session_id not in progress_store:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return JSONResponse({
            "progress": progress_store[session_id]
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/flashcard-review")
async def review_flashcard(
    session_id: str = Form(...),
    card_id: str = Form(...),
    correct: bool = Form(...)
):
    """Record flashcard review results."""
    try:
        if session_id not in progress_store:
            raise HTTPException(status_code=404, detail="Session not found")
        
        progress_data = progress_store[session_id]
        data = {
            "card_id": card_id,
            "correct": correct
        }
        
        updated_progress = update_progress(progress_data, "flashcard_reviewed", data)
        progress_store[session_id] = updated_progress
        
        return JSONResponse({
            "success": True,
            "progress": updated_progress
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/quiz-complete")
async def complete_quiz(
    session_id: str = Form(...),
    quiz_id: str = Form(...),
    score: float = Form(...)
):
    """Record quiz completion results."""
    try:
        if session_id not in progress_store:
            raise HTTPException(status_code=404, detail="Session not found")
        
        progress_data = progress_store[session_id]
        data = {
            "quiz_id": quiz_id,
            "score": score
        }
        
        updated_progress = update_progress(progress_data, "quiz_completed", data)
        progress_store[session_id] = updated_progress
        
        return JSONResponse({
            "success": True,
            "progress": updated_progress
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def ai_chat(
    message: str = Form(...),
    session_id: str = Form(None),
    context: str = Form(None)
):
    """AI chat endpoint for conversational learning."""
    try:
        # Parse context if provided
        context_data = None
        if context:
            try:
                context_data = json.loads(context)
            except json.JSONDecodeError:
                context_data = None
        
        # Generate AI response (using simple rule-based system for now)
        response = generate_chat_response(message, context_data, session_id)
        
        return JSONResponse({
            "success": True,
            "response": response,
            "timestamp": json.dumps({"$date": {"$numberLong": str(int(__import__('time').time() * 1000))}})
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/preferences")
async def save_user_preferences(
    session_id: str = Form(...),
    preferences: str = Form(...)
):
    """Save user preferences."""
    try:
        preferences_data = json.loads(preferences)
        
        # Store preferences in progress store for now (in production, use proper DB)
        if session_id not in progress_store:
            progress_store[session_id] = create_progress_tracker()
        
        progress_store[session_id]["preferences"] = preferences_data
        progress_store[session_id]["last_activity"] = __import__('datetime').datetime.now().isoformat()
        
        return JSONResponse({
            "success": True,
            "message": "Preferences saved successfully"
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/preferences/{session_id}")
async def get_user_preferences(session_id: str):
    """Get user preferences."""
    try:
        if session_id not in progress_store:
            return JSONResponse({"preferences": None})
        
        preferences = progress_store[session_id].get("preferences", None)
        return JSONResponse({
            "success": True,
            "preferences": preferences
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analytics/{session_id}")
async def get_learning_analytics(session_id: str):
    """Get comprehensive learning analytics."""
    try:
        if session_id not in progress_store:
            raise HTTPException(status_code=404, detail="Session not found")
        
        progress_data = progress_store[session_id]
        
        # Calculate analytics
        total_questions = sum(1 for score in progress_data.get("quiz_scores", {}).values())
        avg_score = sum(progress_data.get("quiz_scores", {}).values()) / max(1, total_questions)
        total_flashcards = len(progress_data.get("flashcard_progress", {}))
        flashcard_accuracy = 0
        
        if total_flashcards > 0:
            total_correct = sum(card.get("correct_count", 0) for card in progress_data.get("flashcard_progress", {}).values())
            total_reviewed = sum(card.get("reviewed_count", 0) for card in progress_data.get("flashcard_progress", {}).values())
            flashcard_accuracy = (total_correct / max(1, total_reviewed)) * 100
        
        analytics = {
            "session_id": session_id,
            "total_modules": progress_data.get("completed_modules", 0),
            "total_quizzes": total_questions,
            "average_quiz_score": round(avg_score, 1),
            "total_flashcards": total_flashcards,
            "flashcard_accuracy": round(flashcard_accuracy, 1),
            "total_study_time": progress_data.get("time_spent", 0),
            "learning_streak": progress_data.get("streak_days", 0),
            "last_activity": progress_data.get("last_activity", ""),
            "learning_objectives_completed": len(progress_data.get("learning_objectives_completed", [])),
            "progress_by_day": generate_progress_timeline(progress_data),
            "concept_mastery": calculate_concept_mastery(progress_data)
        }
        
        return JSONResponse({
            "success": True,
            "analytics": analytics
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/study-session")
async def start_study_session(
    session_id: str = Form(...),
    duration: int = Form(30)  # Default 30 minutes
):
    """Start a new study session."""
    try:
        if session_id not in progress_store:
            progress_store[session_id] = create_progress_tracker()
        
        progress_data = progress_store[session_id]
        
        # Track study session start
        study_session = {
            "start_time": __import__('datetime').datetime.now().isoformat(),
            "planned_duration": duration,
            "active": True
        }
        
        if "study_sessions" not in progress_data:
            progress_data["study_sessions"] = []
        
        progress_data["study_sessions"].append(study_session)
        progress_data["last_activity"] = study_session["start_time"]
        
        return JSONResponse({
            "success": True,
            "session": study_session,
            "message": f"Study session started for {duration} minutes"
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/study-session/complete")
async def complete_study_session(
    session_id: str = Form(...),
    actual_duration: int = Form(...)
):
    """Complete the current study session."""
    try:
        if session_id not in progress_store:
            raise HTTPException(status_code=404, detail="Session not found")
        
        progress_data = progress_store[session_id]
        
        # Find and complete the active study session
        study_sessions = progress_data.get("study_sessions", [])
        for session in reversed(study_sessions):
            if session.get("active", False):
                session["end_time"] = __import__('datetime').datetime.now().isoformat()
                session["actual_duration"] = actual_duration
                session["active"] = False
                break
        
        # Update total study time
        progress_data["time_spent"] = progress_data.get("time_spent", 0) + actual_duration
        progress_data["last_activity"] = __import__('datetime').datetime.now().isoformat()
        
        return JSONResponse({
            "success": True,
            "total_study_time": progress_data["time_spent"],
            "message": f"Study session completed: {actual_duration} minutes"
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return JSONResponse({
        "status": "healthy",
        "service": "Enhanced Microlearning API",
        "version": "2.0.0"
    })

def generate_chat_response(message: str, context_data: dict = None, session_id: str = None) -> str:
    """Generate AI chat response based on message and context."""
    message_lower = message.lower()
    
    # Context-aware responses
    if context_data:
        if "quiz" in message_lower or "question" in message_lower:
            if context_data.get("hasQuiz"):
                progress = context_data.get("currentProgress", 0)
                if progress > 0:
                    if progress >= 80:
                        return f"Excellent work! You scored {progress}% on the quiz. Your understanding is strong. Would you like to explore advanced concepts or tackle more challenging questions?"
                    else:
                        return f"Good effort! You scored {progress}%. I can help you understand the concepts you found challenging. Which specific area would you like to review?"
                return "I see you have quiz questions available! Taking assessments helps reinforce learning. Would you like some study tips before starting?"
            return "Quizzes are great for testing understanding! Once you generate some content, I can help you prepare for assessments."
        
        if "summary" in message_lower or "explain" in message_lower:
            if context_data.get("summary"):
                return f"Based on your learning material: {context_data['summary'][:200]}... Would you like me to elaborate on any specific concept or explain how these ideas connect?"
        
        if "flashcard" in message_lower:
            if context_data.get("hasFlashcards"):
                return "Flashcards are excellent for memory retention! I recommend the spaced repetition technique - review cards at increasing intervals. Would you like tips on effective flashcard strategies?"
            return "Flashcards are powerful learning tools! Once you generate some content, I can help you create effective study strategies using your flashcards."
    
    # General responses based on keywords
    if any(word in message_lower for word in ["help", "how", "what", "explain"]):
        return "I'm here to support your learning journey! I can help you understand concepts, prepare for assessments, create study plans, or answer questions about your material. What specific area interests you?"
    
    if any(word in message_lower for word in ["study", "learn", "practice"]):
        return "Great attitude towards learning! I can suggest study techniques like active recall, spaced repetition, or the Feynman technique. What type of material are you working with?"
    
    if any(word in message_lower for word in ["difficult", "hard", "struggle", "confused"]):
        return "Learning challenges are normal and part of the growth process! I can help break down complex concepts into smaller, manageable parts. What specific topic is giving you trouble?"
    
    if any(word in message_lower for word in ["motivation", "encourage", "goal"]):
        return "Your commitment to learning is admirable! Setting small, achievable goals and celebrating progress helps maintain motivation. What learning goal would you like to work towards?"
    
    # Default responses
    responses = [
        "That's an interesting point! Can you tell me more about what you'd like to explore?",
        "I'm here to help you succeed in your learning journey. What specific aspect would you like assistance with?",
        "Learning is most effective when it's interactive. How can I support your understanding of this topic?",
        "Every question is a step towards deeper understanding. What would you like to know more about?"
    ]
    
    import random
    return random.choice(responses)

def generate_progress_timeline(progress_data: dict) -> list:
    """Generate progress timeline for analytics."""
    timeline = []
    
    # Add quiz completions
    for quiz_id, score in progress_data.get("quiz_scores", {}).items():
        timeline.append({
            "date": progress_data.get("last_activity", ""),
            "type": "quiz",
            "description": f"Completed {quiz_id}",
            "score": score
        })
    
    # Add flashcard reviews
    for card_id, card_data in progress_data.get("flashcard_progress", {}).items():
        if card_data.get("last_reviewed"):
            timeline.append({
                "date": card_data["last_reviewed"],
                "type": "flashcard",
                "description": f"Reviewed flashcard",
                "accuracy": (card_data.get("correct_count", 0) / max(1, card_data.get("reviewed_count", 1))) * 100
            })
    
    return sorted(timeline, key=lambda x: x["date"], reverse=True)[:10]

def calculate_concept_mastery(progress_data: dict) -> dict:
    """Calculate mastery level for different concepts."""
    mastery = {}
    
    # Base mastery on quiz performance and flashcard accuracy
    for quiz_id, score in progress_data.get("quiz_scores", {}).items():
        concept = quiz_id.replace("_", " ").title()
        mastery[concept] = {
            "level": "Mastered" if score >= 90 else "Developing" if score >= 70 else "Learning",
            "score": score
        }
    
    return mastery

if __name__=="__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)