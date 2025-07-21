import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const googleLogo = (
  <svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g>
      <path d="M44.5 20H24V28.5H36.5C35.1 32.6 31.1 35.5 26.5 35.5C20.7 35.5 16 30.8 16 25C16 19.2 20.7 14.5 26.5 14.5C29.1 14.5 31.4 15.4 33.2 16.9L39.1 11C35.7 7.9 31.4 6 26.5 6C15.8 6 7 14.8 7 25C7 35.2 15.8 44 26.5 44C36.2 44 45 35.2 45 25C45 23.7 44.8 21.8 44.5 20Z" fill="#FFC107"/>
      <path d="M7 25C7 14.8 15.8 6 26.5 6C31.4 6 35.7 7.9 39.1 11L33.2 16.9C31.4 15.4 29.1 14.5 26.5 14.5C20.7 14.5 16 19.2 16 25C16 30.8 20.7 35.5 26.5 35.5C31.1 35.5 35.1 32.6 36.5 28.5H24V20H44.5C44.8 21.8 45 23.7 45 25C45 35.2 36.2 44 26.5 44C15.8 44 7 35.2 7 25Z" fill="#FF3D00"/>
      <path d="M44.5 20H24V28.5H36.5C35.1 32.6 31.1 35.5 26.5 35.5C20.7 35.5 16 30.8 16 25C16 19.2 20.7 14.5 26.5 14.5C29.1 14.5 31.4 15.4 33.2 16.9L39.1 11C35.7 7.9 31.4 6 26.5 6C15.8 6 7 14.8 7 25C7 35.2 15.8 44 26.5 44C36.2 44 45 35.2 45 25C45 23.7 44.8 21.8 44.5 20Z" fill="#4CAF50"/>
      <path d="M44.5 20H24V28.5H36.5C35.1 32.6 31.1 35.5 26.5 35.5C20.7 35.5 16 30.8 16 25C16 19.2 20.7 14.5 26.5 14.5C29.1 14.5 31.4 15.4 33.2 16.9L39.1 11C35.7 7.9 31.4 6 26.5 6C15.8 6 7 14.8 7 25C7 35.2 15.8 44 26.5 44C36.2 44 45 35.2 45 25C45 23.7 44.8 21.8 44.5 20Z" fill="#1976D2"/>
    </g>
  </svg>
);

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState({});

  const { login, signup, signInWithGoogle } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isLogin && password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(email, password, displayName);
      }
    } catch (error) {
      let errorMessage = 'An error occurred. Please try again.';
      
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          errorMessage = 'Invalid email or password';
          break;
        case 'auth/email-already-in-use':
          errorMessage = 'Email is already registered';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password should be at least 6 characters';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address';
          break;
        default:
          errorMessage = error.message;
      }
      
      setError(errorMessage);
    }

    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      setError('Google sign-in failed. Please try again.');
    }
    setLoading(false);
  };

  const toggleMode = (mode) => {
    setIsLogin(mode === 'login');
    setError('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setDisplayName('');
    setFocused({});
  };

  const handleFocus = (field) => {
    setFocused(prev => ({ ...prev, [field]: true }));
  };

  const handleBlur = (field, value) => {
    if (!value) {
      setFocused(prev => ({ ...prev, [field]: false }));
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-content">
        <div className="auth-main">
          <div className="auth-header">
            <div className="auth-logo">
              <span className="auth-logo-icon">🧠</span>
              <span className="auth-logo-text">MicroLearn AI</span>
            </div>
            <h1 className="auth-title">
              {isLogin ? 'Welcome back' : 'Get started'}
            </h1>
            <p className="auth-subtitle">
              {isLogin 
                ? 'Sign in to your account to continue your learning journey' 
                : 'Create your account to start your personalized learning experience'
              }
            </p>
            {/* Login/Signup Toggle Slider */}
            <div className="auth-toggle">
              <button
                className={`toggle-btn${isLogin ? ' active' : ''}`}
                onClick={() => toggleMode('login')}
                disabled={isLogin || loading}
                type="button"
              >
                Login
              </button>
              <button
                className={`toggle-btn${!isLogin ? ' active' : ''}`}
                onClick={() => toggleMode('signup')}
                disabled={!isLogin || loading}
                type="button"
              >
                Signup
              </button>
            </div>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {!isLogin && (
              <div className={`input-wrapper ${focused.displayName ? 'focused' : ''}`}>
                <input
                  type="text"
                  className="auth-input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onFocus={() => handleFocus('displayName')}
                  onBlur={(e) => handleBlur('displayName', e.target.value)}
                  required
                />
                <label className="input-label">Full Name</label>
              </div>
            )}

            <div className={`input-wrapper ${focused.email ? 'focused' : ''}`}>
              <input
                type="email"
                className="auth-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => handleFocus('email')}
                onBlur={(e) => handleBlur('email', e.target.value)}
                required
              />
              <label className="input-label">Email Address</label>
            </div>

            <div className={`input-wrapper ${focused.password ? 'focused' : ''}`}>
              <input
                type="password"
                className="auth-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => handleFocus('password')}
                onBlur={(e) => handleBlur('password', e.target.value)}
                required
              />
              <label className="input-label">Password</label>
            </div>

            {!isLogin && (
              <div className={`input-wrapper ${focused.confirmPassword ? 'focused' : ''}`}>
                <input
                  type="password"
                  className="auth-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onFocus={() => handleFocus('confirmPassword')}
                  onBlur={(e) => handleBlur('confirmPassword', e.target.value)}
                  required
                />
                <label className="input-label">Confirm Password</label>
              </div>
            )}

            {error && (
              <div className="auth-error">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}

            <button 
              type="submit" 
              className="auth-button" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="loading-spinner"></div>
                  <span>{isLogin ? 'Signing In...' : 'Creating Account...'}</span>
                </>
              ) : (
                <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
              )}
            </button>
          </form>

          {/* Divider and Google Sign-In */}
          <div className="auth-divider">
            <span className="divider-line"></span>
            <span className="divider-text">or continue with</span>
            <span className="divider-line"></span>
          </div>
          <button
            type="button"
            className="auth-google-btn"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            {googleLogo}
            <span>Continue with Google</span>
          </button>

          <div className="auth-footer">
            <p className="auth-switch">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button 
                type="button" 
                className="auth-link" 
                onClick={() => toggleMode(isLogin ? 'signup' : 'login')}
                disabled={loading}
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 