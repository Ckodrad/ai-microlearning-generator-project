import pytest
import json
import os
import tempfile
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

from modalities import (
    transcribe_audio,
    caption_image,
    generate_enhanced_content,
    generate_mock_enhanced_content,
    create_progress_tracker,
    update_progress
)

@pytest.mark.unit
class TestAudioTranscription:
    """Test audio transcription functionality."""
    
    def test_transcribe_audio_success(self, sample_audio_file, mock_whisper_model):
        """Test successful audio transcription."""
        result = transcribe_audio(sample_audio_file)
        
        assert result == 'This is a test transcription of audio content about machine learning.'
        mock_whisper_model.transcribe.assert_called_once_with(sample_audio_file)

    def test_transcribe_audio_empty_result(self, sample_audio_file):
        """Test audio transcription with empty result."""
        with patch('modalities.whisper.load_model') as mock_load:
            mock_model = Mock()
            mock_model.transcribe.return_value = {'text': ''}
            mock_load.return_value = mock_model
            
            with pytest.raises(RuntimeError, match="No transcription result"):
                transcribe_audio(sample_audio_file)

    def test_transcribe_audio_missing_text_key(self, sample_audio_file):
        """Test audio transcription with missing text key."""
        with patch('modalities.whisper.load_model') as mock_load:
            mock_model = Mock()
            mock_model.transcribe.return_value = {}
            mock_load.return_value = mock_model
            
            with pytest.raises(RuntimeError, match="No transcription result"):
                transcribe_audio(sample_audio_file)

    def test_transcribe_audio_nonexistent_file(self):
        """Test audio transcription with nonexistent file."""
        with patch('modalities.whisper.load_model') as mock_load:
            mock_model = Mock()
            mock_model.transcribe.side_effect = Exception("File not found")
            mock_load.return_value = mock_model
            
            with pytest.raises(Exception):
                transcribe_audio("nonexistent.wav")

@pytest.mark.unit
class TestImageCaptioning:
    """Test image captioning functionality."""
    
    def test_caption_image_success(self, sample_image_file, mock_blip_model):
        """Test successful image captioning."""
        result = caption_image(sample_image_file)
        
        assert result == 'A diagram showing machine learning concepts'
        
        # Verify the BLIP pipeline was called correctly
        mock_blip_model['processor'].assert_called()
        mock_blip_model['model'].generate.assert_called()

    def test_caption_image_empty_result(self, sample_image_file):
        """Test image captioning with empty result."""
        with patch('modalities.BlipProcessor.from_pretrained') as mock_processor, \
             patch('modalities.BlipForConditionalGeneration.from_pretrained') as mock_model:
            
            mock_processor_instance = Mock()
            mock_model_instance = Mock()
            
            mock_processor.return_value = mock_processor_instance
            mock_model.return_value = mock_model_instance
            
            mock_processor_instance.decode.return_value = ''
            
            with pytest.raises(RuntimeError, match="No caption generated"):
                caption_image(sample_image_file)

    def test_caption_image_invalid_file(self):
        """Test image captioning with invalid file."""
        with patch('modalities.Image.open', side_effect=Exception("Cannot identify image file")):
            with pytest.raises(Exception):
                caption_image("invalid.jpg")

@pytest.mark.unit
class TestContentGeneration:
    """Test enhanced content generation."""
    
    def test_generate_enhanced_content_success(self, mock_openai_api, mock_openai_response):
        """Test successful content generation with OpenAI."""
        result = generate_enhanced_content("Machine learning is a subset of AI.")
        
        assert result["summary"] == mock_openai_response["summary"]
        assert len(result["questions"]) == 2
        assert len(result["flashcards"]) == 2
        assert result["difficulty_level"] == "intermediate"

    def test_generate_enhanced_content_api_error(self):
        """Test content generation when OpenAI API fails."""
        with patch('modalities.openai.chat.completions.create', side_effect=Exception("API Error")):
            result = generate_enhanced_content("Test content")
            
            # Should return mock content
            assert "This is a demo summary" in result["summary"]
            assert len(result["questions"]) == 3
            assert "difficulty_level" in result

    def test_generate_enhanced_content_no_api_key(self):
        """Test content generation without API key."""
        with patch('modalities.OPENAI_API_KEY', 'sk-demo-key-not-set'):
            result = generate_enhanced_content("Test content")
            
            # Should return mock content
            assert "This is a demo summary" in result["summary"]

    def test_generate_enhanced_content_invalid_json(self):
        """Test content generation with invalid JSON response."""
        with patch('modalities.openai.chat.completions.create') as mock_create:
            mock_response = Mock()
            mock_response.choices = [Mock()]
            mock_response.choices[0].message.content = "Invalid JSON response"
            mock_create.return_value = mock_response
            
            result = generate_enhanced_content("Test content")
            
            # Should fall back to mock content
            assert "This is a demo summary" in result["summary"]

    def test_generate_mock_enhanced_content(self):
        """Test mock content generation."""
        result = generate_mock_enhanced_content("Test input")
        
        assert "summary" in result
        assert "learning_objectives" in result
        assert "questions" in result
        assert "flashcards" in result
        assert "key_concepts" in result
        assert "difficulty_level" in result
        
        # Verify structure
        assert len(result["questions"]) == 3
        assert len(result["flashcards"]) == 5
        assert len(result["key_concepts"]) == 7
        
        # Verify question structure
        for question in result["questions"]:
            assert "question" in question
            assert "answer" in question
            assert "bloom_level" in question
            assert "explanation" in question
            assert "options" in question

@pytest.mark.unit
class TestProgressTracking:
    """Test progress tracking functionality."""
    
    def test_create_progress_tracker(self):
        """Test creating a new progress tracker."""
        progress = create_progress_tracker()
        
        assert "session_id" in progress
        assert "created_at" in progress
        assert progress["completed_modules"] == 0
        assert progress["total_modules"] == 0
        assert progress["quiz_scores"] == {}
        assert progress["flashcard_progress"] == {}
        assert progress["learning_objectives_completed"] == []
        assert progress["time_spent"] == 0
        assert progress["streak_days"] == 0
        assert "last_activity" in progress

    def test_update_progress_module_completed(self, sample_progress_data):
        """Test updating progress for module completion."""
        initial_completed = sample_progress_data["completed_modules"]
        
        updated = update_progress(sample_progress_data, "module_completed")
        
        assert updated["completed_modules"] == initial_completed + 1
        assert "last_activity" in updated

    def test_update_progress_quiz_completed(self, sample_progress_data):
        """Test updating progress for quiz completion."""
        quiz_data = {"quiz_id": "new_quiz", "score": 95.0}
        
        updated = update_progress(sample_progress_data, "quiz_completed", quiz_data)
        
        assert updated["quiz_scores"]["new_quiz"] == 95.0
        assert "last_activity" in updated

    def test_update_progress_flashcard_reviewed_new_card(self, sample_progress_data):
        """Test updating progress for new flashcard review."""
        card_data = {"card_id": "new_card", "correct": True}
        
        updated = update_progress(sample_progress_data, "flashcard_reviewed", card_data)
        
        assert "new_card" in updated["flashcard_progress"]
        card_progress = updated["flashcard_progress"]["new_card"]
        assert card_progress["reviewed_count"] == 1
        assert card_progress["correct_count"] == 1
        assert "last_reviewed" in card_progress

    def test_update_progress_flashcard_reviewed_existing_card(self, sample_progress_data):
        """Test updating progress for existing flashcard review."""
        # Set up existing card data
        sample_progress_data["flashcard_progress"]["existing_card"] = {
            "reviewed_count": 3,
            "correct_count": 2,
            "last_reviewed": "2024-01-01T10:00:00.000Z"
        }
        
        card_data = {"card_id": "existing_card", "correct": False}
        
        updated = update_progress(sample_progress_data, "flashcard_reviewed", card_data)
        
        card_progress = updated["flashcard_progress"]["existing_card"]
        assert card_progress["reviewed_count"] == 4
        assert card_progress["correct_count"] == 2  # No change for incorrect answer

    def test_update_progress_unknown_action(self, sample_progress_data):
        """Test updating progress with unknown action."""
        initial_data = sample_progress_data.copy()
        
        updated = update_progress(sample_progress_data, "unknown_action")
        
        # Should only update last_activity
        assert updated["completed_modules"] == initial_data["completed_modules"]
        assert "last_activity" in updated

    def test_update_progress_missing_flashcard_progress(self, sample_progress_data):
        """Test flashcard update when flashcard_progress doesn't exist."""
        # Remove flashcard_progress key
        del sample_progress_data["flashcard_progress"]
        
        card_data = {"card_id": "test_card", "correct": True}
        
        updated = update_progress(sample_progress_data, "flashcard_reviewed", card_data)
        
        assert "flashcard_progress" in updated
        assert "test_card" in updated["flashcard_progress"]

@pytest.mark.unit
class TestUtilityFunctions:
    """Test utility and helper functions."""
    
    def test_json_parsing_with_code_fences(self):
        """Test JSON parsing with markdown code fences."""
        # This would test the JSON parsing logic in generate_enhanced_content
        # that strips code fences and extracts JSON
        json_with_fences = '''```json
        {
            "summary": "Test summary",
            "questions": []
        }
        ```'''
        
        # Extract JSON parsing logic
        content = json_with_fences
        if content.startswith("```"):
            import re
            content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content, flags=re.IGNORECASE).strip()
        
        start = content.find("{")
        end = content.rfind("}")
        if start != -1 and end != -1:
            json_str = content[start:end+1]
        else:
            json_str = content
        
        parsed = json.loads(json_str)
        assert parsed["summary"] == "Test summary"

    def test_datetime_handling_in_progress(self):
        """Test that datetime handling works correctly in progress updates."""
        progress = create_progress_tracker()
        
        # Verify datetime format
        created_at = datetime.fromisoformat(progress["created_at"])
        assert isinstance(created_at, datetime)
        
        # Update progress and verify last_activity updates
        original_time = progress["last_activity"]
        updated = update_progress(progress, "module_completed")
        
        # last_activity should be updated (different from created_at)
        assert updated["last_activity"] != original_time

@pytest.mark.unit
@pytest.mark.slow
class TestLargeContentProcessing:
    """Test processing of large content."""
    
    def test_large_text_processing(self, mock_openai_api):
        """Test processing very large text content."""
        large_text = "Machine learning content. " * 1000  # Very long text
        
        result = generate_enhanced_content(large_text)
        
        assert "summary" in result
        assert len(result["summary"]) > 0

    def test_multiple_concurrent_requests(self, mock_openai_api):
        """Test handling multiple concurrent content generation requests."""
        import threading
        import time
        
        results = []
        
        def generate_content(text):
            result = generate_enhanced_content(f"Content {text}")
            results.append(result)
        
        # Start multiple threads
        threads = []
        for i in range(5):
            thread = threading.Thread(target=generate_content, args=(i,))
            threads.append(thread)
            thread.start()
        
        # Wait for completion
        for thread in threads:
            thread.join()
        
        assert len(results) == 5
        for result in results:
            assert "summary" in result

@pytest.mark.unit
class TestErrorHandling:
    """Test error handling across all functions."""
    
    def test_transcribe_audio_file_not_found(self):
        """Test audio transcription with non-existent file."""
        with pytest.raises(Exception):
            transcribe_audio("/nonexistent/path/file.wav")

    def test_caption_image_file_not_found(self):
        """Test image captioning with non-existent file."""
        with pytest.raises(Exception):
            caption_image("/nonexistent/path/image.jpg")

    def test_generate_content_empty_input(self, mock_openai_api):
        """Test content generation with empty input."""
        result = generate_enhanced_content("")
        
        # Should still generate content (mock or real)
        assert "summary" in result

    def test_progress_update_with_none_data(self, sample_progress_data):
        """Test progress update with None data."""
        updated = update_progress(sample_progress_data, "quiz_completed", None)
        
        # Should not crash, just update last_activity
        assert "last_activity" in updated 