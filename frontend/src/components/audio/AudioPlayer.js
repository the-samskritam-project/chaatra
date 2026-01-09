import React from 'react';
import ReactH5AudioPlayer from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';

const AudioPlayer = ({ audioUrl, duration, className = '' }) => {
  if (!audioUrl) {
    return null;
  }

  return (
    <div className={`custom-audio-player ${className}`}>
      <ReactH5AudioPlayer
        src={audioUrl}
        showJumpControls={false}
        showDownloadControl={false}
        showFilledProgress={true}
        showFilledVolume={true}
        className="compact-player"
        style={{
          borderRadius: '0.5rem',
          padding: '0.5rem',
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
        }}
      />
      <style>{`
        .custom-audio-player .rhap_container {
          background-color: #f9fafb;
          border-radius: 0.5rem;
          padding: 0.5rem;
          box-shadow: none;
          border: 1px solid #e5e7eb;
        }
        .custom-audio-player .rhap_main-controls-button {
          width: 28px;
          height: 28px;
          color: #2563eb;
        }
        .custom-audio-player .rhap_play-pause-button {
          width: 28px;
          height: 28px;
        }
        .custom-audio-player .rhap_progress-section {
          height: auto;
        }
        .custom-audio-player .rhap_progress-container {
          height: 6px;
        }
        .custom-audio-player .rhap_progress-bar {
          height: 6px;
        }
        .custom-audio-player .rhap_progress-filled {
          background-color: #2563eb;
        }
        .custom-audio-player .rhap_progress-indicator {
          width: 12px;
          height: 12px;
          background-color: #2563eb;
          margin-left: -6px;
        }
        .custom-audio-player .rhap_volume-controls {
          flex: 0 0 auto;
        }
        .custom-audio-player .rhap_volume-button {
          width: 24px;
          height: 24px;
          color: #6b7280;
        }
        .custom-audio-player .rhap_volume-container {
          width: 60px;
        }
        .custom-audio-player .rhap_volume-bar-area {
          height: 4px;
        }
        .custom-audio-player .rhap_volume-bar {
          height: 4px;
        }
        .custom-audio-player .rhap_volume-filled {
          background-color: #2563eb;
        }
        .custom-audio-player .rhap_time {
          font-size: 0.75rem;
          color: #6b7280;
        }
        .custom-audio-player .rhap_additional-controls {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default AudioPlayer;

