import './App.css';
import React, { useEffect, useState } from 'react';
import Entries from './Entries';
import SearchKeyboard from './SearchKeyboard';

function App() {
  const [slp1SearchStr, setSlp1SearchStr] = useState('');
  const [devSearchStr, setDevSearchStr] = useState('');
  const [entries, setEntries] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage] = useState(3); // Adjust number per page as needed
  const totalPages = Math.ceil(entries.length / entriesPerPage);

  const handleSearch = (slp1Str, devanagariStr) => {
    setSlp1SearchStr(slp1Str);
    setDevSearchStr(devanagariStr);
  };


  useEffect(() => {
    if (slp1SearchStr) {
      const fetchResults = async () => {
        const url = `http://localhost:8081/search?slp1=${encodeURIComponent(slp1SearchStr)}&dev=${encodeURIComponent(devSearchStr)}`;
        const response = await fetch(url);
        const data = await response.json();
        setEntries(data);
        setCurrentPage(1); // Reset to first page with new data
      };

      fetchResults();
    }
  }, [slp1SearchStr, devSearchStr]);

  const nextPage = () => {
    setCurrentPage(prev => (prev < totalPages ? prev + 1 : prev));
  };

  const prevPage = () => {
    setCurrentPage(prev => (prev > 1 ? prev - 1 : prev));
  };

  return (
    <div className="main-container">
      <div class="heading">
        <span class="devanagari">छात्रः</span>
        <span class="english">A pupil, disciple.</span>
      </div>


      <SearchKeyboard handleSearch={handleSearch} />

      <Entries
        entries={entries.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage)} 
        devSearchStr={devSearchStr}
      />
      <div className="pagination">
        <button onClick={prevPage} disabled={currentPage === 1} className="pagination-button">←</button>
        <button onClick={nextPage} disabled={currentPage === totalPages} className="pagination-button">→</button>
      </div>
    </div>
  );
}

export default App;
