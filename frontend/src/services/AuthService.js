class AuthService {
  constructor(apiUrl = null) {
    // Get API URL from environment or use default
    this.apiUrl = apiUrl || process.env.REACT_APP_API_URL || 'http://localhost:8081';
  }

  /**
   * Sign in with email and password
   * @param {string} email - User email address
   * @param {string} password - User password
   * @returns {Promise<{token: string, user: {email: string, name: string}}>}
   * @throws {Error} If sign-in fails
   */
  async signIn(email, password) {
    if (!email || !email.trim()) {
      throw new Error('Email is required');
    }

    if (!password) {
      throw new Error('Password is required');
    }

    try {
      const response = await fetch(`${this.apiUrl}/v2/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email: email.trim(),
          password: password
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid email or password');
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
      if (error.message === 'Invalid email or password') {
        throw error;
      }
      // Handle network errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check your connection.');
      }
      throw error;
    }
  }

  /**
   * Sign up with email, name, and password
   * @param {string} email - User email address
   * @param {string} name - User name
   * @param {string} password - User password
   * @returns {Promise<{token: string, user: {email: string, name: string}}>}
   * @throws {Error} If sign-up fails
   */
  async signUp(email, name, password) {
    if (!email || !email.trim()) {
      throw new Error('Email is required');
    }

    if (!name || !name.trim()) {
      throw new Error('Name is required');
    }

    if (!password) {
      throw new Error('Password is required');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    try {
      const response = await fetch(`${this.apiUrl}/v2/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email: email.trim(),
          name: name.trim(),
          password: password
        }),
      });

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error('An account with this email already exists');
        }
        const errorText = await response.text();
        throw new Error(errorText || `Sign-up failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        token: data.token,
        user: data.user,
      };
    } catch (error) {
      // Re-throw with user-friendly message if it's our custom error
      if (error.message === 'An account with this email already exists') {
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

