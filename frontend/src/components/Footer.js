import React from 'react';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <p className="footer-text">
          This application uses data from{' '}
          <a
            href="https://www.sanskrit-lexicon.uni-koeln.de"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            Cologne Digital Sanskrit Dictionaries
          </a>
          , Cologne University, accessed on January 20, 2025.
        </p>
        <p className="footer-text">
          Ramayana dataset:{' '}
          <span className="footer-copyright">Copyright (c) 2025 Ashutosh Vijay</span> (MIT License)
        </p>
      </div>
    </footer>
  );
};

export default Footer;

