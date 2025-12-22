class FavoritesService {
  constructor(apiUrl) {
    this.apiUrl = apiUrl || process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL || 'http://localhost:8081';
  }

  async starVerse(corpusName, corpusUnit, corpusUnitID, token) {
    try {
      const response = await fetch(`${this.apiUrl}/v2/favorites`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          corpus_name: corpusName,
          corpus_unit: corpusUnit,
          corpus_unit_id: corpusUnitID,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please sign in.');
        }
        if (response.status === 409) {
          // Already favorited - this is okay, return success
          const data = await response.json();
          return data;
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to star verse.');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('FavoritesService starVerse error:', error);
      throw error;
    }
  }

  async unstarVerse(corpusName, corpusUnit, corpusUnitID, token) {
    try {
      const params = new URLSearchParams({
        corpus_name: corpusName,
        corpus_unit: corpusUnit,
        corpus_unit_id: corpusUnitID,
      });

      const response = await fetch(`${this.apiUrl}/v2/favorites?${params.toString()}`, {
        method: 'DELETE',
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
        throw new Error(errorData.message || 'Failed to unstar verse.');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('FavoritesService unstarVerse error:', error);
      throw error;
    }
  }

  async getFavoriteStatus(corpusName, corpusUnit, corpusUnitID, token) {
    try {
      const params = new URLSearchParams({
        corpus_name: corpusName,
        corpus_unit: corpusUnit,
        corpus_unit_id: corpusUnitID,
      });

      const response = await fetch(`${this.apiUrl}/v2/favorites/status?${params.toString()}`, {
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
        throw new Error(errorData.message || 'Failed to get favorite status.');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('FavoritesService getFavoriteStatus error:', error);
      throw error;
    }
  }

  async getFavorites(filters, token) {
    try {
      const params = new URLSearchParams();
      if (filters.corpusName) {
        params.append('corpus_name', filters.corpusName);
      }
      if (filters.corpusUnit) {
        params.append('corpus_unit', filters.corpusUnit);
      }

      const response = await fetch(`${this.apiUrl}/v2/favorites?${params.toString()}`, {
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
        throw new Error(errorData.message || 'Failed to fetch favorites.');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('FavoritesService getFavorites error:', error);
      throw error;
    }
  }
}

export default FavoritesService;

