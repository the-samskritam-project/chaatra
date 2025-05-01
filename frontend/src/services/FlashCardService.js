import { v4 as uuidv4 } from 'uuid';

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
    createFlashCard({ title, description, front, back, tags }) {
      const flashcards = this._getFlashCards();
      if (flashcards.some(fc => fc.title === title)) {
        throw new Error('Flashcard with this title already exists.');
      }
  
      const newFlashCard = {
        id: uuidv4(),
        title,
        description,
        front,
        back,
        tags,
        createdAt: new Date().toISOString(),
      };
  
      flashcards.push(newFlashCard);
      this._saveFlashCards(flashcards);
      return newFlashCard;
    }
  
    // Get a paginated list of flashcards sorted alphabetically
    getFlashCards(page = 1, pageSize = 10) {
      const flashcards = this._getFlashCards();
      flashcards.sort((a, b) => a.title.localeCompare(b.title));
  
      const start = (page - 1) * pageSize;
      const end = page * pageSize;
  
      return flashcards.slice(start, end);
    }
  
    // Retrieve a flashcard by ID
    getFlashCardById(id) {
      const flashcards = this._getFlashCards();
      return flashcards.find(fc => fc.id === id);
    }
  
    // Delete a flashcard by ID
    deleteFlashCard(id) {
      let flashcards = this._getFlashCards();
      flashcards = flashcards.filter(fc => fc.id !== id);
      this._saveFlashCards(flashcards);
    }

    // Update an existing flashcard
    updateFlashCard(id, updatedFlashcard) {
      let flashcards = this._getFlashCards();
      
      // Find the flashcard by its ID
      const index = flashcards.findIndex(fc => fc.id === id);
      if (index === -1) {
        throw new Error('Flashcard not found');
      }

      // If title is being changed, check for duplicates
      if (flashcards[index].title !== updatedFlashcard.title && 
          flashcards.some(fc => fc.title === updatedFlashcard.title)) {
        throw new Error('A flashcard with this title already exists');
      }

      // Preserve the original ID and creation date
      updatedFlashcard.id = id;
      updatedFlashcard.createdAt = flashcards[index].createdAt;
      
      // Update the flashcard
      flashcards[index] = updatedFlashcard;
      
      this._saveFlashCards(flashcards);
      return updatedFlashcard;
    }
  }
  
  export default FlashCardService;
  