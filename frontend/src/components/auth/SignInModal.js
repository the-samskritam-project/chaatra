import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import AuthService from '../../services/AuthService';
import './Auth.css';

const SignInModal = ({ onClose, onSignInSuccess, apiUrl }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [userName, setUserName] = useState('');

  const authService = new AuthService(apiUrl);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    if (!password) {
      setError('Please enter your password');
      return;
    }

    if (isSignUp && !name.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      let result;
      if (isSignUp) {
        result = await authService.signUp(email, name, password);
      } else {
        result = await authService.signIn(email, password);
      }
      
      setSuccess(true);
      setUserName(result.user.name);
      
      // Call success callback after a short delay to show success message
      setTimeout(() => {
        onSignInSuccess(result);
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message || (isSignUp ? 'Sign-up failed. Please try again.' : 'Sign-in failed. Please try again.'));
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content signin-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={handleClose} disabled={loading}>
          ×
        </button>
        
        {success ? (
          <div className="signin-success">
            <p className="success-message">✓ Success! Welcome, {userName}</p>
          </div>
        ) : (
          <div className="signin-content">
            <h2 style={{ margin: '0 0 20px 0', fontFamily: 'Roboto, sans-serif' }}>
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </h2>
            <form onSubmit={handleSubmit} className="signin-form">
              {isSignUp && (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  disabled={loading}
                  required
                  className="signin-input"
                  style={{ width: '100%', marginBottom: '10px' }}
                />
              )}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                disabled={loading}
                autoFocus
                required
                className="signin-input"
                style={{ width: '100%', marginBottom: '10px' }}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={loading}
                required
                className="signin-input"
                style={{ width: '100%', marginBottom: '10px' }}
              />
              <button
                type="submit"
                disabled={loading || !email.trim() || !password || (isSignUp && !name.trim())}
                className="signin-submit-btn"
                style={{ width: '100%' }}
              >
                {loading ? (isSignUp ? 'Signing up...' : 'Signing in...') : (isSignUp ? 'Sign Up' : 'Sign In')}
              </button>
            </form>

            <div style={{ marginTop: '15px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError('');
                  setPassword('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#007bff',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: '14px',
                  fontFamily: 'Roboto, sans-serif'
                }}
                disabled={loading}
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>

            {error && (
              <div className="error-message" style={{ marginTop: '15px' }}>
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default SignInModal;

