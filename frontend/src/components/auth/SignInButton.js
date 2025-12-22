import React, { useState } from 'react';
import SignInModal from './SignInModal';
import './Auth.css';

const SignInButton = ({ user, onSignInSuccess, onSignOut, apiUrl }) => {
  const [showModal, setShowModal] = useState(false);

  const handleSignInClick = () => {
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
  };

  const handleSignInSuccess = (result) => {
    onSignInSuccess(result);
    setShowModal(false);
  };

  const handleSignOut = () => {
    if (onSignOut) {
      onSignOut();
    }
  };

  return (
    <>
      <div className="signin-button-container">
        {user ? (
          <button className="signout-button" onClick={handleSignOut}>
            Sign Out
          </button>
        ) : (
          <button className="signin-button" onClick={handleSignInClick}>
            Sign In
          </button>
        )}
      </div>

      {showModal && (
        <SignInModal
          onClose={handleModalClose}
          onSignInSuccess={handleSignInSuccess}
          apiUrl={apiUrl}
        />
      )}
    </>
  );
};

export default SignInButton;

