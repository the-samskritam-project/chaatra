import React, { useState, useRef, useEffect } from 'react';
import './VoiceRecorder.css';

const VoiceRecorder = ({ corpusName, verseId, apiUrl, token, onUploadSuccess }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [hasRecorded, setHasRecorded] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const mimeTypeRef = useRef(null);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get supported MIME type for MediaRecorder
  const getSupportedMimeType = () => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/mpeg',
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return ''; // Browser will use default
  };

  // Request microphone access and initialize MediaRecorder
  const startRecording = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      mimeTypeRef.current = mimeType || 'audio/webm';
      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setHasRecorded(true);
      };

      mediaRecorder.onerror = (event) => {
        setError('Recording error occurred');
        console.error('MediaRecorder error:', event);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setError('Failed to access microphone. Please check permissions.');
      console.error('Error accessing microphone:', err);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);

      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // Pause recording
  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // Resume recording
  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
  };

  // Play recorded audio
  const playRecording = () => {
    if (audioRef.current && audioUrl) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  // Pause recorded audio
  const pausePlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Handle audio playback ended
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      const handleEnded = () => setIsPlaying(false);
      const handlePause = () => setIsPlaying(false);
      const handlePlay = () => setIsPlaying(true);

      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('pause', handlePause);
      audio.addEventListener('play', handlePlay);

      return () => {
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('play', handlePlay);
      };
    }
  }, [audioUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Upload recording
  const handleUpload = async () => {
    if (!audioBlob) {
      setError('No recording to upload');
      return;
    }

    if (!token) {
      setError('Authentication required. Please sign in.');
      return;
    }

    if (!apiUrl) {
      setError('API URL not configured');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

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
          throw new Error('Access denied. Please ensure your account has the required permissions.');
        }
        
        throw new Error(errorText || `Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Call success callback if provided
      if (onUploadSuccess) {
        onUploadSuccess(result);
      }

      // Reset state after successful upload
      resetRecording();
    } catch (err) {
      setError(err.message || 'Failed to upload recording. Please try again.');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  // Reset recording state
  const resetRecording = () => {
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setHasRecorded(false);
    setRecordingTime(0);
    setIsPlaying(false);
    setError('');
  };

  // Discard recording
  const handleDiscard = () => {
    resetRecording();
  };

  return (
    <div className="voice-recorder">
      {!hasRecorded ? (
        // Recording interface
        <div className="voice-recorder-controls">
          {!isRecording ? (
            <button
              className="voice-recorder-button voice-recorder-start"
              onClick={startRecording}
              type="button"
              title="Start recording"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="12" cy="12" r="10" fill="currentColor" />
              </svg>
              <span>Record</span>
            </button>
          ) : (
            <div className="voice-recorder-recording">
              <div className="voice-recorder-timer">
                <span className="voice-recorder-timer-dot"></span>
                <span className="voice-recorder-timer-text">{formatTime(recordingTime)}</span>
              </div>
              <div className="voice-recorder-actions">
                {isPaused ? (
                  <button
                    className="voice-recorder-button voice-recorder-resume"
                    onClick={resumeRecording}
                    type="button"
                    title="Resume recording"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M8 5v14l11-7z"
                        fill="currentColor"
                      />
                    </svg>
                    <span>Resume</span>
                  </button>
                ) : (
                  <button
                    className="voice-recorder-button voice-recorder-pause"
                    onClick={pauseRecording}
                    type="button"
                    title="Pause recording"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"
                        fill="currentColor"
                      />
                    </svg>
                    <span>Pause</span>
                  </button>
                )}
                <button
                  className="voice-recorder-button voice-recorder-stop"
                  onClick={stopRecording}
                  type="button"
                  title="Stop recording"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect x="6" y="6" width="12" height="12" fill="currentColor" />
                  </svg>
                  <span>Stop</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        // Playback and upload interface
        <div className="voice-recorder-playback">
          <div className="voice-recorder-audio-player">
            <audio ref={audioRef} src={audioUrl} />
            <div className="voice-recorder-playback-controls">
              {isPlaying ? (
                <button
                  className="voice-recorder-button voice-recorder-pause-playback"
                  onClick={pausePlayback}
                  type="button"
                  title="Pause playback"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              ) : (
                <button
                  className="voice-recorder-button voice-recorder-play"
                  onClick={playRecording}
                  type="button"
                  title="Play recording"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M8 5v14l11-7z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              )}
              <span className="voice-recorder-duration">{formatTime(recordingTime)}</span>
            </div>
          </div>
          <div className="voice-recorder-upload-actions">
            <button
              className="voice-recorder-button voice-recorder-discard"
              onClick={handleDiscard}
              type="button"
              disabled={isUploading}
              title="Discard recording"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                  fill="currentColor"
                />
              </svg>
              <span>Discard</span>
            </button>
            <button
              className="voice-recorder-button voice-recorder-upload"
              onClick={handleUpload}
              disabled={isUploading}
              type="button"
              title="Upload recording"
            >
              {isUploading ? (
                <>
                  <svg
                    className="voice-recorder-spinner"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle
                      className="voice-recorder-spinner-circle"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="voice-recorder-spinner-path"
                      d="M12 2a10 10 0 0 1 10 10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                  </svg>
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2z"
                      fill="currentColor"
                    />
                  </svg>
                  <span>Upload</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
      {error && <div className="voice-recorder-error">{error}</div>}
    </div>
  );
};

export default VoiceRecorder;
