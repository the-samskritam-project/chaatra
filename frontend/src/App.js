import './App.css';
import Dictionary from './Dictionary';

function App() {
  return (
    <div className="main-container">
      <div class="heading">
        <span class="devanagari">छात्रः</span>
        <span class="english">A pupil, disciple.</span>
      </div>
      <Dictionary />
    </div>
  );
}

export default App;
