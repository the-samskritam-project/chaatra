class UserTranslationsService {
  constructor(apiUrl) {
    this.apiUrl = apiUrl || process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL || 'http://localhost:8081';
  }

  async getAllTranslations(token) {
    try {
      const response = await fetch(`${this.apiUrl}/v2/translations`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please sign in.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch translations.');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('UserTranslationsService getAllTranslations error:', error);
      throw error;
    }
  }
}

export default UserTranslationsService;

