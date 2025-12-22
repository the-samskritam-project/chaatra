import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import AuthService from '../../services/AuthService';
import './Auth.css';

const SignInModal = ({ onClose, onSignInSuccess, apiUrl }) => {
  const [email, setEmail] = useState('');
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

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const result = await authService.signIn(email);
      setSuccess(true);
      setUserName(result.user.name);
      
      // Call success callback after a short delay to show success message
      setTimeout(() => {
        onSignInSuccess(result);
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Sign-in failed. Please try again.');
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
            <form onSubmit={handleSubmit} className="signin-form">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                disabled={loading}
                autoFocus
                required
                className="signin-input"
              />
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="signin-submit-btn"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            {error && (
              <div className="error-message">
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

