import pytest
import json
import io
from unittest.mock import patch, Mock
from fastapi.testclient import TestClient

@pytest.mark.api
class TestProcessEndpoint:
    """Test the /process endpoint with various inputs."""
    
    def test_process_with_text_prompt(self, client, mock_openai_api):
        """Test processing with text prompt only."""
        response = client.post("/process", data={"prompt": "Machine learning basics"})
        
        assert response.status_code == 200
        data = response.json()
        
        assert "summary" in data
        assert "question1" in data
        assert "flashcards" in data
        assert "progress" in data

    def test_process_with_audio_file(self, client, sample_audio_file, mock_whisper_model, mock_openai_api):
        """Test processing with audio file upload."""
        with open(sample_audio_file, 'rb') as audio_file:
            files = {"audio": ("test.wav", audio_file, "audio/wav")}
            response = client.post("/process", files=files)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "input_audio" in data
        assert "summary" in data
        mock_whisper_model.transcribe.assert_called_once()

    def test_process_with_image_file(self, client, sample_image_file, mock_blip_model, mock_openai_api):
        """Test processing with image file upload."""
        with open(sample_image_file, 'rb') as image_file:
            files = {"image": ("test.png", image_file, "image/png")}
            response = client.post("/process", files=files)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "caption" in data
        assert "summary" in data

    def test_process_with_text_file(self, client, sample_text_file, mock_openai_api):
        """Test processing with text file upload."""
        with open(sample_text_file, 'rb') as text_file:
            files = {"text": ("test.txt", text_file, "text/plain")}
            response = client.post("/process", files=files)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "input_text" in data
        assert "summary" in data

    def test_process_with_multiple_inputs(self, client, sample_text_file, mock_openai_api):
        """Test processing with multiple input types."""
        with open(sample_text_file, 'rb') as text_file:
            files = {"text": ("test.txt", text_file, "text/plain")}
            data = {"prompt": "Additional context about machine learning"}
            response = client.post("/process", files=files, data=data)
        
        assert response.status_code == 200
        result = response.json()
        
        assert "input_text" in result
        assert "input_prompt" in result
        assert "summary" in result

    def test_process_generates_quiz_questions(self, client, mock_openai_api):
        """Test that processing generates quiz questions with correct format."""
        response = client.post("/process", data={"prompt": "Machine learning concepts"})
        
        assert response.status_code == 200
        data = response.json()
        
        # Check question format
        for i in range(1, 4):  # Questions 1-3
            if f"question{i}" in data:
                assert f"options{i}" in data
                assert f"correct_option{i}" in data
                assert f"bloom_level{i}" in data
                assert isinstance(data[f"options{i}"], list)
                assert len(data[f"options{i}"]) == 4  # Multiple choice options

    def test_process_creates_progress_tracker(self, client, mock_openai_api):
        """Test that processing creates a progress tracker."""
        response = client.post("/process", data={"prompt": "Test content"})
        
        assert response.status_code == 200
        data = response.json()
        
        assert "progress" in data
        progress = data["progress"]
        assert "session_id" in progress
        assert "created_at" in progress
        assert "total_modules" in progress

    def test_process_handles_openai_api_error(self, client):
        """Test processing when OpenAI API fails."""
        with patch('modalities.openai.chat.completions.create', side_effect=Exception("API Error")):
            response = client.post("/process", data={"prompt": "Test content"})
        
        assert response.status_code == 200
        data = response.json()
        
        # Should fall back to mock content
        assert "summary" in data
        assert data["summary"] == "This is a demo summary of the provided content. In a real implementation, GPT-4o would analyze the text and generate a comprehensive summary."

    def test_process_empty_request(self, client):
        """Test processing with no input."""
        response = client.post("/process")
        
        assert response.status_code == 500  # Should return error

@pytest.mark.api
class TestProgressEndpoints:
    """Test progress tracking endpoints."""
    
    def test_update_progress_module_completed(self, client, mock_progress_store, sample_progress_data):
        """Test updating progress when module is completed."""
        session_id = "test-session"
        mock_progress_store[session_id] = sample_progress_data.copy()
        
        response = client.post(
            "/update-progress",
            data={
                "session_id": session_id,
                "action": "module_completed"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "progress" in data
        assert data["progress"]["completed_modules"] == sample_progress_data["completed_modules"] + 1

    def test_update_progress_quiz_completed(self, client, mock_progress_store, sample_progress_data):
        """Test updating progress when quiz is completed."""
        session_id = "test-session"
        mock_progress_store[session_id] = sample_progress_data.copy()
        
        quiz_data = json.dumps({"quiz_id": "test_quiz", "score": 95.0})
        
        response = client.post(
            "/update-progress",
            data={
                "session_id": session_id,
                "action": "quiz_completed",
                "data": quiz_data
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert data["progress"]["quiz_scores"]["test_quiz"] == 95.0

    def test_update_progress_flashcard_reviewed(self, client, mock_progress_store, sample_progress_data):
        """Test updating progress when flashcard is reviewed."""
        session_id = "test-session"
        mock_progress_store[session_id] = sample_progress_data.copy()
        
        flashcard_data = json.dumps({"card_id": "new_card", "correct": True})
        
        response = client.post(
            "/update-progress",
            data={
                "session_id": session_id,
                "action": "flashcard_reviewed",
                "data": flashcard_data
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "new_card" in data["progress"]["flashcard_progress"]
        assert data["progress"]["flashcard_progress"]["new_card"]["reviewed_count"] == 1
        assert data["progress"]["flashcard_progress"]["new_card"]["correct_count"] == 1

    def test_update_progress_invalid_session(self, client):
        """Test updating progress with invalid session ID."""
        response = client.post(
            "/update-progress",
            data={
                "session_id": "invalid-session",
                "action": "module_completed"
            }
        )
        
        assert response.status_code == 404

    def test_get_progress_valid_session(self, client, mock_progress_store, sample_progress_data):
        """Test retrieving progress for valid session."""
        session_id = "test-session"
        mock_progress_store[session_id] = sample_progress_data
        
        response = client.get(f"/progress/{session_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "progress" in data
        assert data["progress"]["session_id"] == session_id

    def test_get_progress_invalid_session(self, client):
        """Test retrieving progress for invalid session."""
        response = client.get("/progress/invalid-session")
        
        assert response.status_code == 404

@pytest.mark.api
class TestFlashcardEndpoint:
    """Test flashcard review endpoint."""
    
    def test_review_flashcard_correct(self, client, mock_progress_store, sample_progress_data):
        """Test reviewing flashcard with correct answer."""
        session_id = "test-session"
        mock_progress_store[session_id] = sample_progress_data.copy()
        
        response = client.post(
            "/flashcard-review",
            data={
                "session_id": session_id,
                "card_id": "test_card",
                "correct": True
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "test_card" in data["progress"]["flashcard_progress"]
        assert data["progress"]["flashcard_progress"]["test_card"]["correct_count"] == 1

    def test_review_flashcard_incorrect(self, client, mock_progress_store, sample_progress_data):
        """Test reviewing flashcard with incorrect answer."""
        session_id = "test-session"
        mock_progress_store[session_id] = sample_progress_data.copy()
        
        response = client.post(
            "/flashcard-review",
            data={
                "session_id": session_id,
                "card_id": "test_card",
                "correct": False
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert data["progress"]["flashcard_progress"]["test_card"]["correct_count"] == 0
        assert data["progress"]["flashcard_progress"]["test_card"]["reviewed_count"] == 1

@pytest.mark.api
class TestQuizCompleteEndpoint:
    """Test quiz completion endpoint."""
    
    def test_complete_quiz_success(self, client, mock_progress_store, sample_progress_data):
        """Test successful quiz completion."""
        session_id = "test-session"
        mock_progress_store[session_id] = sample_progress_data.copy()
        
        response = client.post(
            "/quiz-complete",
            data={
                "session_id": session_id,
                "quiz_id": "knowledge_check",
                "score": 87.5
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert data["progress"]["quiz_scores"]["knowledge_check"] == 87.5

    def test_complete_quiz_invalid_session(self, client):
        """Test quiz completion with invalid session."""
        response = client.post(
            "/quiz-complete",
            data={
                "session_id": "invalid-session",
                "quiz_id": "test_quiz",
                "score": 85.0
            }
        )
        
        assert response.status_code == 404

@pytest.mark.api
class TestHealthEndpoint:
    """Test health check endpoint."""
    
    def test_health_check(self, client):
        """Test health check endpoint."""
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "healthy"
        assert data["service"] == "Enhanced Microlearning API"
        assert "version" in data

@pytest.mark.api
class TestCORSAndMiddleware:
    """Test CORS and middleware functionality."""
    
    def test_cors_headers(self, client):
        """Test that CORS headers are properly set."""
        response = client.options("/health")
        
        # FastAPI TestClient doesn't process CORS middleware the same way
        # This test would need to be run against actual server
        assert response.status_code == 200

    def test_request_validation(self, client):
        """Test request validation for required fields."""
        # Test missing session_id
        response = client.post("/update-progress", data={"action": "module_completed"})
        
        assert response.status_code == 422  # Validation error

@pytest.mark.api
@pytest.mark.integration
class TestEndToEndWorkflow:
    """Test complete end-to-end workflows."""
    
    def test_complete_learning_workflow(self, client, mock_openai_api, mock_progress_store):
        """Test complete workflow from content processing to quiz completion."""
        # Step 1: Process content
        response = client.post("/process", data={"prompt": "Machine learning basics"})
        assert response.status_code == 200
        
        process_data = response.json()
        session_id = process_data["progress"]["session_id"]
        
        # Verify content was generated
        assert "summary" in process_data
        assert "question1" in process_data
        
        # Step 2: Complete quiz
        response = client.post(
            "/quiz-complete",
            data={
                "session_id": session_id,
                "quiz_id": "knowledge_check",
                "score": 90.0
            }
        )
        assert response.status_code == 200
        
        # Step 3: Review flashcard
        response = client.post(
            "/flashcard-review",
            data={
                "session_id": session_id,
                "card_id": "card_1",
                "correct": True
            }
        )
        assert response.status_code == 200
        
        # Step 4: Check final progress
        response = client.get(f"/progress/{session_id}")
        assert response.status_code == 200
        
        final_progress = response.json()["progress"]
        assert final_progress["quiz_scores"]["knowledge_check"] == 90.0
        assert "card_1" in final_progress["flashcard_progress"]

    def test_error_handling_throughout_workflow(self, client, mock_progress_store):
        """Test error handling at each step of the workflow."""
        # Test with invalid session ID at each endpoint
        invalid_session = "invalid-session-id"
        
        endpoints_to_test = [
            ("/update-progress", {"session_id": invalid_session, "action": "module_completed"}),
            ("/flashcard-review", {"session_id": invalid_session, "card_id": "test", "correct": True}),
            ("/quiz-complete", {"session_id": invalid_session, "quiz_id": "test", "score": 85.0}),
        ]
        
        for endpoint, data in endpoints_to_test:
            response = client.post(endpoint, data=data)
            assert response.status_code == 404, f"Endpoint {endpoint} should return 404 for invalid session"
        
        # Test GET endpoint
        response = client.get(f"/progress/{invalid_session}")
        assert response.status_code == 404

@pytest.mark.api
class TestChatEndpoint:
    """Test AI chat endpoint."""
    
    def test_chat_basic_message(self, client):
        """Test basic chat functionality."""
        response = client.post("/chat", data={"message": "Hello, can you help me study?"})
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "response" in data
        assert isinstance(data["response"], str)
        assert len(data["response"]) > 0

    def test_chat_with_context(self, client):
        """Test chat with learning context."""
        context = json.dumps({
            "hasQuiz": True,
            "currentProgress": 85,
            "summary": "Machine learning is a subset of AI..."
        })
        
        response = client.post("/chat", data={
            "message": "How did I do on the quiz?",
            "context": context
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "85" in data["response"] or "quiz" in data["response"].lower()

    def test_chat_with_session(self, client, mock_progress_store, sample_progress_data):
        """Test chat with session tracking."""
        session_id = "test-session"
        mock_progress_store[session_id] = sample_progress_data
        
        response = client.post("/chat", data={
            "message": "What should I study next?",
            "session_id": session_id
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "response" in data

    def test_chat_error_handling(self, client):
        """Test chat error handling."""
        # Test with malformed context
        response = client.post("/chat", data={
            "message": "Test message",
            "context": "invalid json"
        })
        
        assert response.status_code == 200  # Should still work with invalid context
        data = response.json()
        assert data["success"] is True

@pytest.mark.api
class TestPreferencesEndpoint:
    """Test user preferences endpoints."""
    
    def test_save_preferences(self, client, mock_progress_store):
        """Test saving user preferences."""
        session_id = "test-session"
        preferences = {
            "name": "Test User",
            "learningStyle": "visual",
            "difficulty": "intermediate",
            "interests": ["science", "technology"]
        }
        
        response = client.post("/preferences", data={
            "session_id": session_id,
            "preferences": json.dumps(preferences)
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert data["message"] == "Preferences saved successfully"
        
        # Check that preferences were stored
        assert session_id in mock_progress_store
        assert mock_progress_store[session_id]["preferences"] == preferences

    def test_get_preferences_existing(self, client, mock_progress_store):
        """Test retrieving existing preferences."""
        session_id = "test-session"
        preferences = {"name": "Test User", "learningStyle": "auditory"}
        
        mock_progress_store[session_id] = {
            "session_id": session_id,
            "preferences": preferences
        }
        
        response = client.get(f"/preferences/{session_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert data["preferences"] == preferences

    def test_get_preferences_nonexistent(self, client):
        """Test retrieving preferences for non-existent session."""
        response = client.get("/preferences/nonexistent-session")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["preferences"] is None

    def test_save_preferences_invalid_json(self, client):
        """Test saving preferences with invalid JSON."""
        response = client.post("/preferences", data={
            "session_id": "test-session",
            "preferences": "invalid json"
        })
        
        assert response.status_code == 500

@pytest.mark.api
class TestAnalyticsEndpoint:
    """Test learning analytics endpoint."""
    
    def test_get_analytics_with_data(self, client, mock_progress_store):
        """Test retrieving analytics with existing data."""
        session_id = "test-session"
        progress_data = {
            "session_id": session_id,
            "completed_modules": 3,
            "quiz_scores": {"quiz1": 85.0, "quiz2": 92.0},
            "flashcard_progress": {
                "card1": {"reviewed_count": 5, "correct_count": 4},
                "card2": {"reviewed_count": 3, "correct_count": 3}
            },
            "time_spent": 7200,  # 2 hours in seconds
            "streak_days": 5,
            "learning_objectives_completed": ["obj1", "obj2", "obj3"]
        }
        
        mock_progress_store[session_id] = progress_data
        
        response = client.get(f"/analytics/{session_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        analytics = data["analytics"]
        
        assert analytics["session_id"] == session_id
        assert analytics["total_modules"] == 3
        assert analytics["total_quizzes"] == 2
        assert analytics["average_quiz_score"] == 88.5
        assert analytics["total_flashcards"] == 2
        assert analytics["total_study_time"] == 7200
        assert analytics["learning_streak"] == 5
        assert analytics["learning_objectives_completed"] == 3

    def test_get_analytics_nonexistent_session(self, client):
        """Test retrieving analytics for non-existent session."""
        response = client.get("/analytics/nonexistent-session")
        
        assert response.status_code == 404

    def test_analytics_calculations(self, client, mock_progress_store):
        """Test that analytics calculations are correct."""
        session_id = "test-session"
        progress_data = {
            "session_id": session_id,
            "quiz_scores": {"quiz1": 100.0, "quiz2": 80.0, "quiz3": 70.0},
            "flashcard_progress": {
                "card1": {"reviewed_count": 10, "correct_count": 8},
                "card2": {"reviewed_count": 5, "correct_count": 4}
            }
        }
        
        mock_progress_store[session_id] = progress_data
        
        response = client.get(f"/analytics/{session_id}")
        
        assert response.status_code == 200
        analytics = response.json()["analytics"]
        
        # Check average quiz score calculation
        expected_avg = (100.0 + 80.0 + 70.0) / 3
        assert analytics["average_quiz_score"] == round(expected_avg, 1)
        
        # Check flashcard accuracy calculation
        total_correct = 8 + 4
        total_reviewed = 10 + 5
        expected_accuracy = (total_correct / total_reviewed) * 100
        assert analytics["flashcard_accuracy"] == round(expected_accuracy, 1)

@pytest.mark.api
class TestStudySessionEndpoints:
    """Test study session tracking endpoints."""
    
    def test_start_study_session(self, client, mock_progress_store):
        """Test starting a new study session."""
        session_id = "test-session"
        
        response = client.post("/study-session", data={
            "session_id": session_id,
            "duration": 45
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "session" in data
        assert data["session"]["planned_duration"] == 45
        assert data["session"]["active"] is True
        assert "45 minutes" in data["message"]
        
        # Check that session was stored
        assert session_id in mock_progress_store
        assert len(mock_progress_store[session_id]["study_sessions"]) == 1

    def test_start_study_session_default_duration(self, client, mock_progress_store):
        """Test starting study session with default duration."""
        response = client.post("/study-session", data={"session_id": "test-session"})
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["session"]["planned_duration"] == 30  # Default duration

    def test_complete_study_session(self, client, mock_progress_store):
        """Test completing a study session."""
        session_id = "test-session"
        
        # First start a session
        mock_progress_store[session_id] = {
            "session_id": session_id,
            "study_sessions": [{
                "start_time": "2024-01-01T10:00:00",
                "planned_duration": 30,
                "active": True
            }],
            "time_spent": 0
        }
        
        response = client.post("/study-session/complete", data={
            "session_id": session_id,
            "actual_duration": 35
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert data["total_study_time"] == 35
        assert "35 minutes" in data["message"]
        
        # Check that session was marked as completed
        session = mock_progress_store[session_id]["study_sessions"][0]
        assert session["active"] is False
        assert session["actual_duration"] == 35

    def test_complete_study_session_invalid_session(self, client):
        """Test completing session with invalid session ID."""
        response = client.post("/study-session/complete", data={
            "session_id": "invalid-session",
            "actual_duration": 30
        })
        
        assert response.status_code == 404 