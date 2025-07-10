import pytest
import json
import asyncio
from unittest.mock import patch, Mock
from fastapi.testclient import TestClient

@pytest.mark.integration
class TestCompleteWorkflow:
    """Integration tests for complete learning workflow."""
    
    def test_complete_content_processing_workflow(self, client, mock_openai_api, mock_whisper_model, mock_blip_model):
        """Test complete workflow from file upload to quiz completion."""
        
        # Step 1: Process multimodal content
        with patch('modalities.transcribe_audio') as mock_transcribe:
            mock_transcribe.return_value = "This is audio content about machine learning"
            
            response = client.post(
                "/process",
                data={"prompt": "Additional context about AI"},
                files={"audio": ("test.wav", b"fake audio data", "audio/wav")}
            )
        
        assert response.status_code == 200
        process_data = response.json()
        
        # Verify content was generated
        assert "summary" in process_data
        assert "question1" in process_data
        assert "flashcards" in process_data
        assert "progress" in process_data
        
        session_id = process_data["progress"]["session_id"]
        
        # Step 2: Complete quiz
        response = client.post(
            "/quiz-complete",
            data={
                "session_id": session_id,
                "quiz_id": "knowledge_check",
                "score": 85.0
            }
        )
        
        assert response.status_code == 200
        quiz_data = response.json()
        assert quiz_data["success"] is True
        
        # Step 3: Review flashcards
        for i in range(3):
            response = client.post(
                "/flashcard-review",
                data={
                    "session_id": session_id,
                    "card_id": f"card_{i}",
                    "correct": i % 2 == 0  # Alternate correct/incorrect
                }
            )
            assert response.status_code == 200
        
        # Step 4: Update module progress
        response = client.post(
            "/update-progress",
            data={
                "session_id": session_id,
                "action": "module_completed"
            }
        )
        
        assert response.status_code == 200
        
        # Step 5: Check final progress
        response = client.get(f"/progress/{session_id}")
        assert response.status_code == 200
        
        final_progress = response.json()["progress"]
        
        # Verify all activities were recorded
        assert final_progress["quiz_scores"]["knowledge_check"] == 85.0
        assert final_progress["completed_modules"] == 1
        assert len(final_progress["flashcard_progress"]) == 3
        
        # Verify flashcard statistics
        correct_count = sum(
            card["correct_count"] 
            for card in final_progress["flashcard_progress"].values()
        )
        total_reviews = sum(
            card["reviewed_count"] 
            for card in final_progress["flashcard_progress"].values()
        )
        
        assert correct_count == 2  # 2 out of 3 correct (alternating pattern)
        assert total_reviews == 3

    def test_error_recovery_workflow(self, client, mock_progress_store):
        """Test workflow with error conditions and recovery."""
        
        # Step 1: Process content successfully
        with patch('modalities.generate_enhanced_content') as mock_generate:
            mock_generate.return_value = {
                "summary": "Test summary",
                "questions": [],
                "flashcards": [],
                "key_concepts": [],
                "difficulty_level": "intermediate"
            }
            
            response = client.post("/process", data={"prompt": "Test content"})
            assert response.status_code == 200
            session_id = response.json()["progress"]["session_id"]
        
        # Step 2: Try to access invalid session (error case)
        response = client.get("/progress/invalid-session")
        assert response.status_code == 404
        
        # Step 3: Try to update progress for invalid session (error case)
        response = client.post(
            "/update-progress",
            data={
                "session_id": "invalid-session",
                "action": "module_completed"
            }
        )
        assert response.status_code == 404
        
        # Step 4: Recover with valid session
        response = client.get(f"/progress/{session_id}")
        assert response.status_code == 200
        
        # Step 5: Continue workflow normally
        response = client.post(
            "/quiz-complete",
            data={
                "session_id": session_id,
                "quiz_id": "recovery_quiz",
                "score": 90.0
            }
        )
        assert response.status_code == 200

    def test_concurrent_user_sessions(self, client, mock_openai_api):
        """Test multiple concurrent user sessions."""
        sessions = []
        
        # Create multiple sessions
        for i in range(3):
            response = client.post(
                "/process",
                data={"prompt": f"Content for user {i}"}
            )
            assert response.status_code == 200
            sessions.append(response.json()["progress"]["session_id"])
        
        # Each session should be unique
        assert len(set(sessions)) == 3
        
        # Update progress for each session independently
        for i, session_id in enumerate(sessions):
            response = client.post(
                "/quiz-complete",
                data={
                    "session_id": session_id,
                    "quiz_id": f"quiz_{i}",
                    "score": 80.0 + i * 5  # Different scores
                }
            )
            assert response.status_code == 200
        
        # Verify each session has independent progress
        for i, session_id in enumerate(sessions):
            response = client.get(f"/progress/{session_id}")
            assert response.status_code == 200
            
            progress = response.json()["progress"]
            expected_score = 80.0 + i * 5
            assert progress["quiz_scores"][f"quiz_{i}"] == expected_score

@pytest.mark.integration
class TestDataConsistency:
    """Test data consistency across operations."""
    
    def test_progress_data_consistency(self, client, mock_openai_api):
        """Test that progress data remains consistent across operations."""
        
        # Create session
        response = client.post("/process", data={"prompt": "Test content"})
        session_id = response.json()["progress"]["session_id"]
        
        # Perform multiple operations
        operations = [
            ("quiz-complete", {"quiz_id": "quiz1", "score": 85.0}),
            ("quiz-complete", {"quiz_id": "quiz2", "score": 92.0}),
            ("flashcard-review", {"card_id": "card1", "correct": True}),
            ("flashcard-review", {"card_id": "card2", "correct": False}),
            ("update-progress", {"action": "module_completed"}),
        ]
        
        for endpoint_suffix, data in operations:
            endpoint = f"/{endpoint_suffix}"
            data["session_id"] = session_id
            
            response = client.post(endpoint, data=data)
            assert response.status_code == 200
        
        # Verify final state
        response = client.get(f"/progress/{session_id}")
        progress = response.json()["progress"]
        
        # Check quiz scores
        assert progress["quiz_scores"]["quiz1"] == 85.0
        assert progress["quiz_scores"]["quiz2"] == 92.0
        
        # Check flashcard progress
        assert progress["flashcard_progress"]["card1"]["correct_count"] == 1
        assert progress["flashcard_progress"]["card2"]["correct_count"] == 0
        
        # Check module completion
        assert progress["completed_modules"] == 1

    def test_timestamp_consistency(self, client, mock_openai_api):
        """Test that timestamps are updated consistently."""
        
        # Create session
        response = client.post("/process", data={"prompt": "Test content"})
        initial_progress = response.json()["progress"]
        session_id = initial_progress["session_id"]
        
        created_at = initial_progress["created_at"]
        initial_last_activity = initial_progress["last_activity"]
        
        # Wait a moment to ensure timestamp difference
        import time
        time.sleep(0.1)
        
        # Update progress
        response = client.post(
            "/update-progress",
            data={
                "session_id": session_id,
                "action": "module_completed"
            }
        )
        
        updated_progress = response.json()["progress"]
        
        # Verify timestamps
        assert updated_progress["created_at"] == created_at  # Should not change
        assert updated_progress["last_activity"] != initial_last_activity  # Should update

@pytest.mark.integration
class TestAPIErrorHandling:
    """Test API error handling in integration scenarios."""
    
    def test_malformed_request_handling(self, client):
        """Test handling of malformed requests."""
        
        # Test malformed JSON in data field
        response = client.post(
            "/update-progress",
            data={
                "session_id": "test-session",
                "action": "quiz_completed",
                "data": "invalid-json{"
            }
        )
        # Should still handle gracefully (might treat as string)
        assert response.status_code in [404, 422, 500]  # Expected error codes
        
        # Test missing required fields
        response = client.post("/quiz-complete", data={"session_id": "test"})
        assert response.status_code == 422  # Validation error
        
        # Test invalid data types
        response = client.post(
            "/quiz-complete",
            data={
                "session_id": "test",
                "quiz_id": "test",
                "score": "not-a-number"
            }
        )
        assert response.status_code == 422  # Validation error

    def test_resource_not_found_handling(self, client):
        """Test handling of non-existent resources."""
        
        endpoints_to_test = [
            ("GET", "/progress/nonexistent-session", {}),
            ("POST", "/update-progress", {"session_id": "nonexistent", "action": "test"}),
            ("POST", "/quiz-complete", {"session_id": "nonexistent", "quiz_id": "test", "score": 85}),
            ("POST", "/flashcard-review", {"session_id": "nonexistent", "card_id": "test", "correct": True}),
        ]
        
        for method, endpoint, data in endpoints_to_test:
            if method == "GET":
                response = client.get(endpoint)
            else:
                response = client.post(endpoint, data=data)
            
            assert response.status_code == 404, f"Endpoint {method} {endpoint} should return 404"

@pytest.mark.integration
@pytest.mark.slow
class TestPerformanceIntegration:
    """Integration tests for performance scenarios."""
    
    def test_large_content_processing(self, client, mock_openai_api):
        """Test processing of large content."""
        
        # Create large content
        large_content = "Machine learning content. " * 1000
        
        response = client.post("/process", data={"prompt": large_content})
        
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert len(data["summary"]) > 0

    def test_many_flashcard_reviews(self, client, mock_openai_api):
        """Test reviewing many flashcards in sequence."""
        
        # Create session
        response = client.post("/process", data={"prompt": "Test content"})
        session_id = response.json()["progress"]["session_id"]
        
        # Review many flashcards
        for i in range(50):
            response = client.post(
                "/flashcard-review",
                data={
                    "session_id": session_id,
                    "card_id": f"card_{i}",
                    "correct": i % 3 == 0  # Every third correct
                }
            )
            assert response.status_code == 200
        
        # Verify all reviews were recorded
        response = client.get(f"/progress/{session_id}")
        progress = response.json()["progress"]
        
        assert len(progress["flashcard_progress"]) == 50
        
        # Verify statistics
        total_correct = sum(
            card["correct_count"] 
            for card in progress["flashcard_progress"].values()
        )
        expected_correct = len([i for i in range(50) if i % 3 == 0])
        assert total_correct == expected_correct 