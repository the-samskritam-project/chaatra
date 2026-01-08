class ConversationService {
  constructor(apiUrl = null) {
    this.apiUrl = apiUrl || process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL || 'http://localhost:8081';
  }

  /**
   * Send a message to the conversation tutor
   * @param {string} corpus - Corpus name (e.g., "bhagavad_gita", "subhashita")
   * @param {string} shlokaID - Verse ID
   * @param {string} userMessage - User's message
   * @param {object} state - Current translation state
   * @returns {Promise<{message: string, suggested_action: object, updated_state: object}>}
   * @throws {Error} If conversation fails
   */
  async sendMessage(corpus, shlokaID, userMessage, state) {
    if (!corpus || !shlokaID || !userMessage) {
      throw new Error('Corpus, shloka ID, and user message are required');
    }

    try {
      const response = await fetch(`${this.apiUrl}/v2/${corpus}/shloka/${shlokaID}/conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_message: userMessage,
          state: state,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Conversation failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      // Handle network errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check your connection.');
      }
      throw error;
    }
  }

  /**
   * Evaluate a user's translation
   * @param {string} corpus - Corpus name (e.g., "bhagavad_gita", "subhashita")
   * @param {string} shlokaID - Verse ID
   * @param {string} userTranslation - User's translation
   * @param {object} hintsUsed - Hints that were used
   * @returns {Promise<{score: number, feedback: string, strengths: string[], areas_for_improvement: string[]}>}
   * @throws {Error} If evaluation fails
   */
  async evaluateTranslation(corpus, shlokaID, userTranslation, hintsUsed) {
    if (!corpus || !shlokaID || !userTranslation) {
      throw new Error('Corpus, shloka ID, and user translation are required');
    }

    try {
      const response = await fetch(`${this.apiUrl}/v2/${corpus}/shloka/${shlokaID}/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_translation: userTranslation,
          hints_used: hintsUsed,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Evaluation failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      // Handle network errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check your connection.');
      }
      throw error;
    }
  }
}

export default ConversationService;

