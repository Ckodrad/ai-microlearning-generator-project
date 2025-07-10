#!/usr/bin/env python3
"""
modalities.py

Enhanced multimodal microlearning prototype with:
  1. Transcribes audio with Whisper
  2. Captions images with BLIP
  3. Generates summary + Bloom's-level quiz via GPT-4o
  4. Creates flashcards for learning support
  5. Tracks learning progress

Usage:
  python modalities.py \
    --audio lecture.wav \
    --image diagram.png \
    --text notes.txt \
    --output result.json
"""

import argparse
import json
import os
import sys
import re
import uuid
from datetime import datetime
from typing import Dict, List, Any

# 1) Whisper for speech-to-text
import whisper

# 2) BLIP for image captioning
from PIL import Image
from transformers import BlipProcessor, BlipForConditionalGeneration

# 3) GPT-based generation (OpenAI API)
import openai

# Ensure PyTorch is available for transformers models
try:
    import torch
except ImportError:
    print("❌ PyTorch is not installed. Please run `pip install torch torchvision` to use image captioning.", file=sys.stderr)
    sys.exit(1)

# ─── Configuration ──────────────────────────────────────────────────────────────

# Get OpenAI API key from environment variable
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    print("⚠️  Warning: OPENAI_API_KEY environment variable not set.")
    print("   Set your OpenAI API key: export OPENAI_API_KEY='your-api-key-here'")
    print("   Or get one from: https://platform.openai.com/account/api-keys")
    OPENAI_API_KEY = "sk-demo-key-not-set"  # Fallback for demo

openai.api_key = OPENAI_API_KEY

# Choose Whisper and BLIP model sizes as needed
WHISPER_MODEL = "base"
BLIP_MODEL    = "Salesforce/blip-image-captioning-base"
GPT_MODEL     = "gpt-4o"

# ─── Step Functions ─────────────────────────────────────────────────────────────

def transcribe_audio(audio_path: str) -> str:
    """Transcribe an audio file to text using Whisper."""
    model = whisper.load_model(WHISPER_MODEL)
    result = model.transcribe(audio_path)
    text   = result.get("text", "").strip()
    if not text:
        raise RuntimeError(f"No transcription result from {audio_path}")
    return text

def caption_image(image_path: str) -> str:
    """Generate a descriptive caption from an image using BLIP."""
    processor = BlipProcessor.from_pretrained(BLIP_MODEL)
    model = BlipForConditionalGeneration.from_pretrained(BLIP_MODEL)
    image = Image.open(image_path).convert("RGB")
    inputs = processor(images=image, return_tensors="pt")
    out_ids = model.generate(**inputs)
    caption = processor.decode(out_ids[0], skip_special_tokens=True).strip()
    if not caption:
        raise RuntimeError(f"No caption generated for {image_path}")
    return caption

def generate_mock_enhanced_content(text: str) -> Dict[str, Any]:
    """Generate mock enhanced content when OpenAI API is not available."""
    return {
        "summary": "This is a demo summary of the provided content. In a real implementation, GPT-4o would analyze the text and generate a comprehensive summary.",
        "learning_objectives": [
            "Understand the key concepts presented in the content",
            "Apply the knowledge to real-world scenarios",
            "Demonstrate comprehension through assessment activities"
        ],
        "questions": [
            {
                "question": "What is the main topic discussed in this content?",
                "answer": "The main topic is machine learning and its applications in artificial intelligence.",
                "bloom_level": "Remember",
                "explanation": "This question tests basic recall of the primary subject matter.",
                "options": [
                    "The main topic is machine learning and its applications in artificial intelligence.",
                    "The main topic is web development and programming languages.",
                    "The main topic is database management systems.",
                    "The main topic is network security protocols."
                ]
            },
            {
                "question": "How does supervised learning differ from unsupervised learning?",
                "answer": "Supervised learning uses labeled data to train models, while unsupervised learning works with unlabeled data to find patterns.",
                "bloom_level": "Understand",
                "explanation": "This question requires understanding and comparison of different concepts.",
                "options": [
                    "Supervised learning uses labeled data to train models, while unsupervised learning works with unlabeled data to find patterns.",
                    "Supervised learning is faster than unsupervised learning.",
                    "Supervised learning requires more computational resources.",
                    "Supervised learning only works with numerical data."
                ]
            },
            {
                "question": "If you were building a spam detection system, which type of learning would you use and why?",
                "answer": "Supervised learning would be used because we have labeled examples of spam and non-spam emails to train the model.",
                "bloom_level": "Apply",
                "explanation": "This question requires applying knowledge to a new situation.",
                "options": [
                    "Supervised learning would be used because we have labeled examples of spam and non-spam emails to train the model.",
                    "Unsupervised learning would be used because it's more efficient.",
                    "Reinforcement learning would be used because it adapts to new threats.",
                    "Deep learning would be used because it's the most advanced method."
                ]
            }
        ],
        "flashcards": [
            {
                "front": "What is machine learning?",
                "back": "A subset of AI that enables computers to learn from experience without explicit programming.",
                "category": "definition"
            },
            {
                "front": "Name the three main types of machine learning",
                "back": "Supervised learning, unsupervised learning, and reinforcement learning.",
                "category": "key concept"
            },
            {
                "front": "What is the purpose of data preprocessing?",
                "back": "To clean and prepare raw data for analysis by removing errors and standardizing formats.",
                "category": "application"
            },
            {
                "front": "What is feature engineering?",
                "back": "The process of creating meaningful features from raw data to improve model performance.",
                "category": "definition"
            },
            {
                "front": "Give an example of a supervised learning application",
                "back": "Email spam detection, where the model learns from labeled examples of spam and legitimate emails.",
                "category": "example"
            }
        ],
        "key_concepts": [
            "Machine Learning",
            "Supervised Learning",
            "Unsupervised Learning",
            "Reinforcement Learning",
            "Data Preprocessing",
            "Feature Engineering",
            "Model Training"
        ],
        "difficulty_level": "intermediate"
    }

def generate_enhanced_content(text: str) -> Dict[str, Any]:
    """
    Call GPT-4o to produce:
      - a concise summary
      - three Bloom's-aligned questions (Remember, Understand, Apply)
      - flashcards for learning support
      - learning objectives
    """
    # Check if we have a valid API key
    if not OPENAI_API_KEY or OPENAI_API_KEY == "sk-demo-key-not-set":
        print("⚠️  Using mock content (OpenAI API key not configured)")
        return generate_mock_enhanced_content(text)
    
    system_prompt = """
    You are an expert educational content creator specializing in microlearning and Bloom's Taxonomy.
    
    Create comprehensive learning content from the provided text. Respond with a JSON object containing:
    
    {
      "summary": "concise summary of the content",
      "learning_objectives": ["list of 3-4 clear learning objectives"],
      "questions": [
        {
          "question": "question text",
          "answer": "correct answer",
          "bloom_level": "Remember|Understand|Apply",
          "explanation": "brief explanation of why this answer is correct"
        }
      ],
      "flashcards": [
        {
          "front": "question or concept",
          "back": "answer or explanation",
          "category": "key concept|definition|example|application"
        }
      ],
      "key_concepts": ["list of 5-7 key concepts from the content"],
      "difficulty_level": "beginner|intermediate|advanced"
    }
    
    Ensure questions follow Bloom's Taxonomy:
    - Remember: Recall facts, terms, basic concepts
    - Understand: Explain ideas, compare, describe
    - Apply: Use information in new situations, solve problems
    
    Make flashcards diverse and useful for learning.
    """

    user_prompt = f"Here is the educational content:\n\"\"\"\n{text}\n\"\"\"\n"

    try:
        response = openai.chat.completions.create(
            model=GPT_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt}
            ],
            max_tokens=2000,
            temperature=0.7,
        )
        out = response.choices[0].message.content.strip()

        # Strip code fences if present
        if out.startswith("```"):
            out = re.sub(r"^```(?:json)?\s*|\s*```$", "", out, flags=re.IGNORECASE).strip()

        # Extract the first JSON object in the text
        start = out.find("{")
        end = out.rfind("}")
        if start != -1 and end != -1:
            json_str = out[start:end+1]
        else:
            json_str = out

        try:
            payload = json.loads(json_str)
        except json.JSONDecodeError as e:
            print(f"⚠️  Failed to parse GPT response, using mock content: {e}")
            return generate_mock_enhanced_content(text)

        return payload
        
    except Exception as e:
        print(f"⚠️  OpenAI API error, using mock content: {e}")
        return generate_mock_enhanced_content(text)

def create_progress_tracker() -> Dict[str, Any]:
    """Create a progress tracking structure."""
    return {
        "session_id": str(uuid.uuid4()),
        "created_at": datetime.now().isoformat(),
        "completed_modules": 0,
        "total_modules": 0,
        "quiz_scores": {},
        "flashcard_progress": {},
        "learning_objectives_completed": [],
        "time_spent": 0,  # in minutes
        "streak_days": 0,
        "last_activity": datetime.now().isoformat()
    }

def update_progress(progress_data: Dict[str, Any], action: str, data: Any = None) -> Dict[str, Any]:
    """Update progress tracking data."""
    progress_data["last_activity"] = datetime.now().isoformat()
    
    if action == "module_completed":
        progress_data["completed_modules"] += 1
    elif action == "quiz_completed":
        if "quiz_scores" not in progress_data:
            progress_data["quiz_scores"] = {}
        progress_data["quiz_scores"][data.get("quiz_id", "default")] = data.get("score", 0)
    elif action == "flashcard_reviewed":
        if "flashcard_progress" not in progress_data:
            progress_data["flashcard_progress"] = {}
        card_id = data.get("card_id", "default")
        if card_id not in progress_data["flashcard_progress"]:
            progress_data["flashcard_progress"][card_id] = {
                "reviewed_count": 0,
                "correct_count": 0,
                "last_reviewed": None
            }
        progress_data["flashcard_progress"][card_id]["reviewed_count"] += 1
        progress_data["flashcard_progress"][card_id]["last_reviewed"] = datetime.now().isoformat()
        if data.get("correct", False):
            progress_data["flashcard_progress"][card_id]["correct_count"] += 1
    
    return progress_data

# ─── Main & CLI ────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="Enhanced Multimodal Microlearning Prototype")
    p.add_argument("--audio",  type=str, help="Path to .wav audio file")
    p.add_argument("--image",  type=str, help="Path to image file (png/jpg)")
    p.add_argument("--text",   type=str, help="Path to plain-text notes file")
    p.add_argument("--output", type=str, default="result.json", help="Where to save JSON output")
    args = p.parse_args()

    if not (args.audio or args.image or args.text):
        p.error("At least one of --audio, --image or --text must be provided.")

    result = {}
    progress = create_progress_tracker()

    try:
        if args.audio:
            print(f"[1/4] Transcribing audio: {args.audio}...")
            result["summary_input_text"] = transcribe_audio(args.audio)
        if args.image:
            print(f"[2/4] Captioning image: {args.image}...")
            result["caption"] = caption_image(args.image)
        if args.text:
            print(f"[3/4] Reading text from: {args.text}...")
            with open(args.text, "r", encoding="utf-8") as f:
                result.setdefault("summary_input_text", "")
                result["summary_input_text"] += "\n" + f.read()

        # Combine text sources for enhanced content generation
        combined_text = result.get("summary_input_text", "").strip()
        if combined_text:
            print("[4/4] Generating enhanced learning content...")
            enhanced_content = generate_enhanced_content(combined_text)

            # Extract all components
            result["summary"] = enhanced_content.get("summary", "")
            result["learning_objectives"] = enhanced_content.get("learning_objectives", [])
            result["key_concepts"] = enhanced_content.get("key_concepts", [])
            result["difficulty_level"] = enhanced_content.get("difficulty_level", "intermediate")
            
            # Extract questions with Bloom's levels
            questions = enhanced_content.get("questions", [])
            for idx, q in enumerate(questions[:3], start=1):
                result[f"question{idx}"] = q.get("question", "")
                result[f"answer{idx}"] = q.get("answer", "")
                result[f"bloom_level{idx}"] = q.get("bloom_level", "Remember")
                result[f"explanation{idx}"] = q.get("explanation", "")
            
            # Extract flashcards
            flashcards = enhanced_content.get("flashcards", [])
            result["flashcards"] = flashcards[:10]  # Limit to 10 flashcards
            
            # Update progress
            progress["total_modules"] = 1
            result["progress"] = progress

        # Save JSON
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"✔️ Enhanced output saved to {args.output}")

    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()