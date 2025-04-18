function SearchBar({ devanagariString, slp1LatinStr, onInputChange, onFocus, handleBlur, handleSearch }) {
    return (
        <div className="search-bar">
            <input
                type="text"
                className="search-input"
                placeholder="Search..."
                value={devanagariString}
                onChange={onInputChange}
                onFocus={onFocus}
                onBlur={handleBlur}
            />
            <button className="search-button" onClick={() => {handleSearch(slp1LatinStr, devanagariString)}}>Search</button>
        </div>
    );
}


export default SearchBar;
