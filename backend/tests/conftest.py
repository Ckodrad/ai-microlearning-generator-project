import pytest
import asyncio
import json
import tempfile
import os
from unittest.mock import Mock, patch, MagicMock
from fastapi.testclient import TestClient
from PIL import Image
import io

# Import our application
from server import app
from modalities import (
    transcribe_audio, 
    caption_image, 
    generate_enhanced_content,
    create_progress_tracker,
    update_progress
)

@pytest.fixture
def client():
    """FastAPI test client fixture."""
    return TestClient(app)

@pytest.fixture
def sample_text_content():
    """Sample text content for testing."""
    return """
    Machine learning is a subset of artificial intelligence that enables computers 
    to learn from data without explicit programming. It includes supervised learning, 
    unsupervised learning, and reinforcement learning approaches.
    """

@pytest.fixture
def sample_audio_file():
    """Create a temporary audio file for testing."""
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        # Write minimal WAV header
        f.write(b'RIFF')
        f.write((44).to_bytes(4, 'little'))  # File size
        f.write(b'WAVE')
        f.write(b'fmt ')
        f.write((16).to_bytes(4, 'little'))  # Subchunk size
        f.write((1).to_bytes(2, 'little'))   # Audio format
        f.write((1).to_bytes(2, 'little'))   # Num channels
        f.write((44100).to_bytes(4, 'little'))  # Sample rate
        f.write((88200).to_bytes(4, 'little'))  # Byte rate
        f.write((2).to_bytes(2, 'little'))   # Block align
        f.write((16).to_bytes(2, 'little'))  # Bits per sample
        f.write(b'data')
        f.write((8).to_bytes(4, 'little'))   # Data size
        f.write(b'\x00' * 8)  # Silence data
        
        temp_path = f.name
    
    yield temp_path
    
    # Cleanup
    if os.path.exists(temp_path):
        os.unlink(temp_path)

@pytest.fixture
def sample_image_file():
    """Create a temporary image file for testing."""
    # Create a simple RGB image
    img = Image.new('RGB', (100, 100), color='red')
    
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
        img.save(f, 'PNG')
        temp_path = f.name
    
    yield temp_path
    
    # Cleanup
    if os.path.exists(temp_path):
        os.unlink(temp_path)

@pytest.fixture
def sample_text_file():
    """Create a temporary text file for testing."""
    content = "This is sample educational content about machine learning and AI."
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
        f.write(content)
        temp_path = f.name
    
    yield temp_path
    
    # Cleanup
    if os.path.exists(temp_path):
        os.unlink(temp_path)

@pytest.fixture
def mock_whisper_model():
    """Mock Whisper model for audio transcription."""
    with patch('modalities.whisper.load_model') as mock_load:
        mock_model = Mock()
        mock_model.transcribe.return_value = {
            'text': 'This is a test transcription of audio content about machine learning.'
        }
        mock_load.return_value = mock_model
        yield mock_model

@pytest.fixture
def mock_blip_model():
    """Mock BLIP model for image captioning."""
    with patch('modalities.BlipProcessor.from_pretrained') as mock_processor, \
         patch('modalities.BlipForConditionalGeneration.from_pretrained') as mock_model:
        
        mock_processor_instance = Mock()
        mock_model_instance = Mock()
        
        mock_processor.return_value = mock_processor_instance
        mock_model.return_value = mock_model_instance
        
        # Mock the processing pipeline
        mock_processor_instance.return_value = {'input_ids': Mock()}
        mock_model_instance.generate.return_value = [Mock()]
        mock_processor_instance.decode.return_value = 'A diagram showing machine learning concepts'
        
        yield {
            'processor': mock_processor_instance,
            'model': mock_model_instance
        }

@pytest.fixture
def mock_openai_response():
    """Mock OpenAI API response."""
    return {
        "summary": "Test summary of machine learning concepts",
        "learning_objectives": [
            "Understand basic ML concepts",
            "Apply ML to real problems",
            "Evaluate ML model performance"
        ],
        "questions": [
            {
                "question": "What is machine learning?",
                "answer": "A subset of AI that learns from data",
                "bloom_level": "Remember",
                "explanation": "Basic definition of machine learning",
                "options": [
                    "A subset of AI that learns from data",
                    "A programming language",
                    "A database system",
                    "A web framework"
                ]
            },
            {
                "question": "How does supervised learning work?",
                "answer": "It uses labeled training data",
                "bloom_level": "Understand",
                "explanation": "Supervised learning requires labeled examples",
                "options": [
                    "It uses labeled training data",
                    "It works without any data",
                    "It only uses images",
                    "It requires no training"
                ]
            }
        ],
        "flashcards": [
            {
                "front": "What is ML?",
                "back": "Machine Learning - AI that learns from data",
                "category": "definition"
            },
            {
                "front": "Types of ML",
                "back": "Supervised, Unsupervised, Reinforcement",
                "category": "classification"
            }
        ],
        "key_concepts": [
            "Machine Learning",
            "Supervised Learning",
            "Neural Networks",
            "Data Processing"
        ],
        "difficulty_level": "intermediate"
    }

@pytest.fixture
def mock_openai_api(mock_openai_response):
    """Mock OpenAI API calls."""
    with patch('modalities.openai.chat.completions.create') as mock_create:
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = json.dumps(mock_openai_response)
        mock_create.return_value = mock_response
        yield mock_create

@pytest.fixture
def sample_progress_data():
    """Sample progress tracking data."""
    return {
        "session_id": "test-session-123",
        "created_at": "2024-01-01T00:00:00.000Z",
        "completed_modules": 1,
        "total_modules": 3,
        "quiz_scores": {
            "quiz_1": 85.0,
            "quiz_2": 92.0
        },
        "flashcard_progress": {
            "card_1": {
                "reviewed_count": 5,
                "correct_count": 4,
                "last_reviewed": "2024-01-01T12:00:00.000Z"
            }
        },
        "learning_objectives_completed": [
            "Understand ML basics",
            "Apply ML concepts"
        ],
        "time_spent": 120,
        "streak_days": 7,
        "last_activity": "2024-01-01T12:00:00.000Z"
    }

@pytest.fixture
def mock_progress_store():
    """Mock in-memory progress store."""
    store = {}
    with patch('server.progress_store', store):
        yield store

@pytest.fixture(autouse=True)
def setup_test_environment():
    """Setup test environment variables and cleanup."""
    # Set test environment variables
    os.environ['OPENAI_API_KEY'] = 'test-api-key'
    
    yield
    
    # Cleanup after tests
    if 'OPENAI_API_KEY' in os.environ:
        del os.environ['OPENAI_API_KEY']

@pytest.fixture
def mock_file_upload():
    """Helper for creating mock file uploads."""
    def _create_upload(filename, content, content_type):
        if isinstance(content, str):
            content = content.encode('utf-8')
        
        return {
            'filename': filename,
            'file': io.BytesIO(content),
            'content_type': content_type
        }
    
    return _create_upload

# Pytest configuration
def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line(
        "markers", "slow: mark test as slow running"
    )
    config.addinivalue_line(
        "markers", "integration: mark test as integration test"
    )
    config.addinivalue_line(
        "markers", "unit: mark test as unit test"
    )
    config.addinivalue_line(
        "markers", "api: mark test as API test"
    )

# Test data cleanup
@pytest.fixture(autouse=True)
def cleanup_test_files():
    """Cleanup any test files created during testing."""
    test_files = []
    
    yield
    
    # Cleanup test files
    for file_path in test_files:
        if os.path.exists(file_path):
            try:
                os.unlink(file_path)
            except Exception:
                pass  # Ignore cleanup errors 