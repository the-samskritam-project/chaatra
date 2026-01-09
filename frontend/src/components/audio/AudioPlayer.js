import React, { useRef, useState, useEffect } from 'react';

const AudioPlayer = ({ audioUrl, duration, className = '' }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleLoadedMetadata = () => {
      setIsLoading(false);
      setError(null);
    };
    const handleError = () => {
      setIsLoading(false);
      setError('Failed to load audio');
    };
    const handleLoadStart = () => setIsLoading(true);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('error', handleError);
    audio.addEventListener('loadstart', handleLoadStart);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('loadstart', handleLoadStart);
    };
  }, [audioUrl]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    audio.currentTime = percent * audio.duration;
  };

  const formatTime = (seconds) => {
    if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const displayDuration = duration || (audioRef.current?.duration || 0);
  const progressPercent = displayDuration > 0 ? (currentTime / displayDuration) * 100 : 0;

  if (!audioUrl) {
    return null;
  }

  return (
    <div className={`audio-player ${className}`}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlayPause}
          disabled={isLoading || error}
          className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isLoading ? (
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : error ? (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : isPlaying ? (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Progress Bar */}
        <div className="flex-1 flex flex-col gap-1">
          <div
            className="relative h-2 bg-gray-200 rounded-full cursor-pointer"
            onClick={handleSeek}
          >
            <div
              className="absolute top-0 left-0 h-full bg-blue-600 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-600">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(displayDuration)}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  );
};

export default AudioPlayer;

