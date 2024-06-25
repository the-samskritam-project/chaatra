class FlashCardService {
    constructor(storageKey = 'chaatra_flashcards') {
      this.storageKey = storageKey;
    }
  
    // Utility to get current flashcards from local storage
    _getFlashCards() {
      const flashcards = localStorage.getItem(this.storageKey);
      return flashcards ? JSON.parse(flashcards) : [];
    }
  
    // Utility to save flashcards to local storage
    _saveFlashCards(flashcards) {
      localStorage.setItem(this.storageKey, JSON.stringify(flashcards));
    }
  
    // Create a new flashcard
    createFlashCard({ title, body, tags }) {
      const flashcards = this._getFlashCards();
      if (flashcards.some(fc => fc.title === title)) {
        throw new Error('Flashcard with this title already exists.');
      }
  
      const newFlashCard = {
        title,
        body,
        tags,
        createdAt: new Date().toISOString(),
      };
  
      flashcards.push(newFlashCard);
      this._saveFlashCards(flashcards);
    }
  
    // Get a paginated list of flashcards sorted alphabetically
    getFlashCards(page = 1, pageSize = 10) {
      const flashcards = this._getFlashCards();
      flashcards.sort((a, b) => a.title.localeCompare(b.title));
  
      const start = (page - 1) * pageSize;
      const end = page * pageSize;
  
      return flashcards.slice(start, end);
    }
  
    // Retrieve a flashcard by title
    getFlashCardByTitle(title) {
      const flashcards = this._getFlashCards();
      return flashcards.find(fc => fc.title === title);
    }
  
    // Delete a flashcard by title
    deleteFlashCard(title) {
      let flashcards = this._getFlashCards();
      flashcards = flashcards.filter(fc => fc.title !== title);
      this._saveFlashCards(flashcards);
    }
  }
  
  export default FlashCardService;
  