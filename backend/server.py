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

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return JSONResponse({
        "status": "healthy",
        "service": "Enhanced Microlearning API",
        "version": "2.0.0"
    })

if __name__=="__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)