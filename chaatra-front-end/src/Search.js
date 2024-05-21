function SearchBar({ devanagariString, onInputChange, onFocus, handleKeyPress }) {
    console.log(devanagariString);

    return (
        <div className="search-bar">
            <input
                type="text"
                className="search-input"
                placeholder="Search..."
                value={devanagariString}
                onChange={onInputChange}
                onFocus={onFocus}
                onKeyDown={handleKeyPress}
            />
            <button className="search-button">Search</button>
        </div>
    );
}


export default SearchBar;
