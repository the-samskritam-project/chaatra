function SearchBar({ devanagariString, onInputChange, onFocus, handleBlur }) {
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
            <button className="search-button">Search</button>
        </div>
    );
}


export default SearchBar;
