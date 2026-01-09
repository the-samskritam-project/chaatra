import React, { useState } from 'react';

const UploadRecording = ({ corpusName, verseId, apiUrl, token, onUploadSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg', 'audio/aac', 'audio/flac'];
      const allowedExtensions = ['.mp3', '.wav', '.m4a', '.ogg', '.aac', '.flac'];
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        setError('Invalid file type. Please select an audio file (mp3, wav, m4a, ogg, aac, or flac).');
        setSelectedFile(null);
        return;
      }

      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size exceeds 10MB limit.');
        setSelectedFile(null);
        return;
      }

      setError('');
      setSuccess(false);
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first.');
      return;
    }

    if (!token) {
      setError('Authentication required. Please sign in.');
      return;
    }

    setIsUploading(true);
    setError('');
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append('audio', selectedFile);

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
        
        // Provide more helpful error messages
        if (response.status === 401) {
          throw new Error('Authentication failed. Please sign out and sign back in to refresh your token.');
        } else if (response.status === 403) {
          throw new Error('Admin access required. Please ensure your account has admin privileges.');
        }
        
        throw new Error(errorText || `Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      setSuccess(true);
      setSelectedFile(null);
      
      // Reset file input
      const fileInput = document.getElementById('audio-file-input');
      if (fileInput) {
        fileInput.value = '';
      }

      // Call success callback
      if (onUploadSuccess) {
        onUploadSuccess(result);
      }

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err) {
      setError(err.message || 'Failed to upload recording. Please try again.');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="upload-recording p-4 bg-white border border-gray-200 rounded-lg">
      <h3 className="text-lg font-semibold mb-3 text-gray-800">Upload Recording</h3>
      
      <div className="space-y-3">
        {/* File Input */}
        <div>
          <label htmlFor="audio-file-input" className="block text-sm font-medium text-gray-700 mb-1">
            Select Audio File
          </label>
          <input
            id="audio-file-input"
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac"
            onChange={handleFileChange}
            disabled={isUploading}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-gray-500">
            Supported formats: MP3, WAV, M4A, OGG, AAC, FLAC (max 10MB)
          </p>
        </div>

        {/* Selected File Info */}
        {selectedFile && (
          <div className="p-2 bg-gray-50 rounded border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setError('');
                  const fileInput = document.getElementById('audio-file-input');
                  if (fileInput) fileInput.value = '';
                }}
                className="ml-2 text-gray-400 hover:text-gray-600"
                disabled={isUploading}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isUploading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Uploading...
            </span>
          ) : (
            'Upload Recording'
          )}
        </button>

        {/* Success Message */}
        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Recording uploaded successfully!
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadRecording;

