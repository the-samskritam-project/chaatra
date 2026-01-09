import React, { useRef, useState } from 'react';

const UploadRecording = ({ corpusName, verseId, apiUrl, token, onUploadSuccess }) => {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg', 'audio/aac', 'audio/flac'];
    const allowedExtensions = ['.mp3', '.wav', '.m4a', '.ogg', '.aac', '.flac'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      alert('Invalid file type. Please select an audio file (mp3, wav, m4a, ogg, aac, or flac).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds 10MB limit.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (!token) {
      alert('Authentication required. Please sign in.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('audio', file);

      const url = `${apiUrl}/v2/${corpusName}/verses/${verseId}/recording`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        if (response.status === 401) {
          throw new Error('Authentication failed. Please sign out and sign back in to refresh your token.');
        } else if (response.status === 403) {
          throw new Error('Admin access required. Please ensure your account has admin privileges.');
        }
        
        throw new Error(errorText || `Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Call success callback
      if (onUploadSuccess) {
        onUploadSuccess(result);
      }
    } catch (err) {
      alert(err.message || 'Failed to upload recording. Please try again.');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleButtonClick = () => {
    if (fileInputRef.current && !isUploading) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="upload-recording">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac"
        onChange={handleFileChange}
        disabled={isUploading}
        style={{ display: 'none' }}
      />
      <button
        onClick={handleButtonClick}
        disabled={isUploading}
        className="upload-button"
        title="Upload recording"
      >
        {isUploading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Uploading...
          </span>
        ) : (
          'Upload'
        )}
      </button>
    </div>
  );
};

export default UploadRecording;

// Add styles to match app's button style
const style = document.createElement('style');
style.textContent = `
  .upload-button {
    padding: 4px 8px;
    font-size: 12px;
    background-color: #007bff;
    color: white;
    border: 1px solid #007bff;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.3s, border-color 0.3s;
    font-family: 'Roboto', sans-serif;
  }
  .upload-button:hover:not(:disabled) {
    background-color: #0056b3;
    border-color: #004495;
  }
  .upload-button:disabled {
    background-color: #ccc;
    border-color: #ccc;
    cursor: not-allowed;
  }
`;
if (!document.getElementById('upload-button-styles')) {
  style.id = 'upload-button-styles';
  document.head.appendChild(style);
}

