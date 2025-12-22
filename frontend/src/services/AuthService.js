class AuthService {
  constructor(apiUrl = null) {
    // Get API URL from environment or use default
    this.apiUrl = apiUrl || process.env.REACT_APP_API_URL || 'http://localhost:8081';
  }

  /**
   * Sign in with email
   * @param {string} email - User email address
   * @returns {Promise<{token: string, user: {email: string, name: string}}>}
   * @throws {Error} If sign-in fails
   */
  async signIn(email) {
    if (!email || !email.trim()) {
      throw new Error('Email is required');
    }

    try {
      const response = await fetch(`${this.apiUrl}/v2/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('You\'re not registered');
        }
        const errorText = await response.text();
        throw new Error(errorText || `Sign-in failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        token: data.token,
        user: data.user,
      };
    } catch (error) {
      // Re-throw with user-friendly message if it's our custom error
      if (error.message === 'You\'re not registered') {
        throw error;
      }
      // Handle network errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check your connection.');
      }
      throw error;
    }
  }
}

export default AuthService;

