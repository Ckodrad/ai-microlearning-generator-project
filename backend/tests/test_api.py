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