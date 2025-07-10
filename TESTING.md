# Testing Framework Documentation

## Overview

This project implements a comprehensive testing framework covering frontend, backend, and integration testing with automated CI/CD pipelines.

## 🏗️ Testing Architecture

### Frontend Testing (React/Vitest)
- **Unit Tests**: Component behavior and user interactions
- **Integration Tests**: API interactions and user workflows
- **E2E Tests**: Complete user journeys (planned with Playwright)

### Backend Testing (Python/Pytest)
- **Unit Tests**: Individual function testing with mocks
- **API Tests**: Endpoint testing with FastAPI TestClient
- **Integration Tests**: Complete workflow testing

## 📁 Test Structure

```
Project Code/
├── frontend/
│   ├── src/
│   │   ├── __tests__/
│   │   │   ├── App.test.jsx              # Main app tests
│   │   │   ├── components/
│   │   │   │   └── QuizComponent.test.jsx # Quiz-specific tests
│   │   │   └── utils/
│   │   │       └── testUtils.js          # Test utilities & mocks
│   │   └── setupTests.js                 # Test configuration
│   ├── vite.config.js                    # Vitest configuration
│   └── package.json                      # Test scripts
└── backend/
    ├── tests/
    │   ├── __init__.py
    │   ├── conftest.py                   # Pytest fixtures
    │   ├── test_api.py                   # API endpoint tests
    │   ├── test_modalities.py            # Unit tests
    │   └── test_integration.py           # Integration tests
    ├── pytest.ini                       # Pytest configuration
    └── requirements.txt                  # Dependencies
```

## 🚀 Running Tests

### Frontend Tests

```bash
cd frontend

# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui

# Run specific test file
npm test App.test.jsx

# Run tests in watch mode
npm test -- --watch
```

### Backend Tests

```bash
cd backend

# Run all tests
pytest

# Run specific test categories
pytest -m unit          # Unit tests only
pytest -m api           # API tests only
pytest -m integration   # Integration tests only

# Run with coverage
pytest --cov=. --cov-report=html

# Run specific test file
pytest tests/test_api.py

# Run tests with verbose output
pytest -v

# Run tests excluding slow tests
pytest -m "not slow"
```

## 🔧 Test Configuration

### Frontend (Vitest)

**vite.config.js**:
```javascript
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    css: true,
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/setupTests.js']
    }
  }
})
```

### Backend (Pytest)

**pytest.ini**:
```ini
[tool:pytest]
testpaths = tests
addopts = --verbose --tb=short --cov=. --cov-report=html
asyncio_mode = auto
markers =
    slow: marks tests as slow
    integration: marks tests as integration tests
    unit: marks tests as unit tests
    api: marks tests as API tests
```

## 🧪 Test Categories

### Unit Tests
Test individual components and functions in isolation.

**Frontend Example**:
```javascript
it('displays welcome message without user name', () => {
  render(<App />)
  expect(screen.getByText(/Transform your educational content/i)).toBeInTheDocument()
})
```

**Backend Example**:
```python
def test_create_progress_tracker():
    progress = create_progress_tracker()
    assert "session_id" in progress
    assert progress["completed_modules"] == 0
```

### Integration Tests
Test complete workflows and component interactions.

**Example**:
```python
def test_complete_content_processing_workflow(client, mock_openai_api):
    # Step 1: Process content
    response = client.post("/process", data={"prompt": "Test content"})
    session_id = response.json()["progress"]["session_id"]
    
    # Step 2: Complete quiz
    response = client.post("/quiz-complete", data={
        "session_id": session_id,
        "quiz_id": "test_quiz",
        "score": 85.0
    })
    assert response.status_code == 200
```

### API Tests
Test all REST endpoints with various scenarios.

**Example**:
```python
def test_process_with_text_prompt(client, mock_openai_api):
    response = client.post("/process", data={"prompt": "Machine learning basics"})
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "question1" in data
```

## 🏃‍♂️ CI/CD Pipeline

### GitHub Actions Workflow

The CI/CD pipeline automatically runs on:
- Push to `main` or `develop` branches
- Pull requests to `main`

**Pipeline Stages**:

1. **Frontend Tests**
   - Install dependencies
   - Run ESLint
   - Execute tests with coverage
   - Build application

2. **Backend Tests**
   - Install Python dependencies
   - Run unit tests
   - Run API tests
   - Run integration tests

3. **Security Scan**
   - Trivy vulnerability scanning
   - npm audit
   - Python safety check

4. **Code Quality**
   - ESLint (frontend)
   - flake8, black, isort (backend)
   - SonarCloud analysis

5. **E2E Tests** (when implemented)
   - Start backend server
   - Build and serve frontend
   - Run Playwright tests

6. **Deployment**
   - Staging (develop branch)
   - Production (main branch)

## 🛠️ Mock Data and Fixtures

### Frontend Mocks

**testUtils.js** provides:
- `mockLearningData`: Complete learning module data
- `mockUserPreferences`: User preference settings
- `mockApiResponses`: API response templates
- Setup functions for localStorage, fetch, etc.

### Backend Fixtures

**conftest.py** provides:
- `client`: FastAPI test client
- `sample_audio_file`: Temporary audio file
- `sample_image_file`: Temporary image file
- `mock_whisper_model`: Mocked Whisper transcription
- `mock_blip_model`: Mocked BLIP image captioning
- `mock_openai_api`: Mocked OpenAI API responses

## 📊 Coverage Reports

### Frontend Coverage
Generated in `frontend/coverage/`:
- `index.html`: Interactive HTML report
- `lcov.info`: Coverage data for CI

### Backend Coverage
Generated in `backend/htmlcov/`:
- `index.html`: Interactive HTML report
- `coverage.xml`: Coverage data for CI

## 🐛 Testing Best Practices

### 1. Test Organization
- Group related tests in classes
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

### 2. Mocking Strategy
- Mock external dependencies (APIs, files)
- Use realistic mock data
- Test both success and error scenarios

### 3. Test Data Management
- Use fixtures for reusable test data
- Clean up temporary files
- Isolate test data between tests

### 4. Assertion Guidelines
- Use specific assertions
- Test both positive and negative cases
- Verify error messages and status codes

## 🔍 Debugging Tests

### Frontend
```bash
# Debug specific test
npm test -- --debug App.test.jsx

# Use test UI for debugging
npm run test:ui
```

### Backend
```bash
# Debug with pdb
pytest -s tests/test_api.py::TestProcessEndpoint::test_process_with_text_prompt

# Verbose output
pytest -v -s

# Show print statements
pytest -s
```

## 📈 Performance Testing

### Load Testing with Locust
```python
# tests/performance/locustfile.py
from locust import HttpUser, task, between

class ApiUser(HttpUser):
    wait_time = between(1, 3)
    
    @task
    def process_content(self):
        self.client.post("/process", data={"prompt": "Test content"})
```

Run with:
```bash
locust -f tests/performance/locustfile.py --host=http://localhost:8000
```

## 🚨 Common Issues and Solutions

### 1. Frontend Tests Failing
- Check mock implementations
- Verify async operations with `waitFor`
- Ensure proper cleanup

### 2. Backend Tests Timing Out
- Mock external API calls
- Use appropriate timeouts
- Check for resource leaks

### 3. CI/CD Failures
- Verify environment variables
- Check dependency versions
- Review test isolation

## 📝 Writing New Tests

### Frontend Test Template
```javascript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('ComponentName', () => {
  beforeEach(() => {
    // Setup
  })
  
  it('should do something specific', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<ComponentName />)
    
    // Act
    await user.click(screen.getByRole('button', { name: /click me/i }))
    
    // Assert
    await waitFor(() => {
      expect(screen.getByText(/expected result/i)).toBeInTheDocument()
    })
  })
})
```

### Backend Test Template
```python
import pytest

@pytest.mark.unit
class TestFunctionName:
    def test_should_do_something_specific(self, fixture_name):
        # Arrange
        input_data = "test input"
        
        # Act
        result = function_name(input_data)
        
        # Assert
        assert result == "expected output"
        
    def test_should_handle_error_case(self):
        # Arrange & Act & Assert
        with pytest.raises(ValueError, match="expected error message"):
            function_name(invalid_input)
```

## 🎯 Test Metrics and Goals

### Coverage Targets
- **Frontend**: 80%+ line coverage
- **Backend**: 85%+ line coverage
- **Critical paths**: 95%+ coverage

### Quality Metrics
- All tests pass on CI/CD
- No security vulnerabilities
- Code quality scores > 8/10
- Performance within acceptable limits

## 🔗 Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Pytest Documentation](https://docs.pytest.org/)
- [FastAPI Testing](https://fastapi.tiangolo.com/tutorial/testing/)
- [GitHub Actions](https://docs.github.com/en/actions) 