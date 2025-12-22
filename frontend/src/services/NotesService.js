class NotesService {
  constructor(apiUrl) {
    this.apiUrl = apiUrl || process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL || 'http://localhost:8081';
  }

  async fetchNotes(corpusName, corpusUnit, corpusUnitID, token) {
    try {
      const params = new URLSearchParams({
        corpus_name: corpusName,
        corpus_unit: corpusUnit,
        ...(corpusUnitID && { corpus_unit_id: corpusUnitID }),
      });

      const response = await fetch(`${this.apiUrl}/v2/notes?${params.toString()}`, {
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
        throw new Error(errorData.message || 'Failed to fetch notes.');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('NotesService fetchNotes error:', error);
      throw error;
    }
  }

  async createNote(corpusName, corpusUnit, corpusUnitID, content, token) {
    try {
      const response = await fetch(`${this.apiUrl}/v2/notes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          corpus_name: corpusName,
          corpus_unit: corpusUnit,
          corpus_unit_id: corpusUnitID,
          content: content,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please sign in.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create note.');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('NotesService createNote error:', error);
      throw error;
    }
  }

  async updateNote(noteID, content, token) {
    try {
      const response = await fetch(`${this.apiUrl}/v2/notes/${noteID}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please sign in.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update note.');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('NotesService updateNote error:', error);
      throw error;
    }
  }
}

export default NotesService;

