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
        .custom-audio-player {
          width: 100%;
          min-width: 300px;
        }
        .custom-audio-player .rhap_container {
          background-color: #f9fafb;
          border-radius: 0.5rem;
          padding: 0.5rem;
          box-shadow: none;
          border: 1px solid #e5e7eb;
          width: 100%;
        }
        /* Fix: Change from stacked to horizontal layout */
        .custom-audio-player .rhap_main {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 0.75rem;
        }
        /* 1. Fix Play Button - Left side */
        .custom-audio-player .rhap_controls-section {
          display: flex;
          align-items: center;
          flex: 0 0 auto;
          order: 1;
          gap: 0.5rem;
        }
        .custom-audio-player .rhap_main-controls {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          margin: 0;
          padding: 0;
        }
        .custom-audio-player .rhap_main-controls-button {
          width: 32px;
          height: 32px;
          color: #2563eb;
          margin: 0;
          padding: 0;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .custom-audio-player .rhap_play-pause-button {
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .custom-audio-player .rhap_main-controls-button svg {
          width: 24px;
          height: 24px;
          display: block;
          margin: 0;
        }
        /* 2. Fix Volume Control - Right side */
        .custom-audio-player .rhap_volume-controls {
          display: flex;
          align-items: center;
          flex: 0 0 auto;
          gap: 0.5rem;
          order: 3;
        }
        .custom-audio-player .rhap_volume-button {
          width: 24px;
          height: 24px;
          color: #6b7280;
          flex-shrink: 0;
          margin: 0;
          padding: 0;
        }
        .custom-audio-player .rhap_volume-container {
          width: 70px;
          flex-shrink: 0;
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
        /* 3. Fix Playback Progress Bar - Middle */
        .custom-audio-player .rhap_progress-section {
          flex: 1 1 auto;
          min-width: 0;
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 0.5rem;
          order: 2;
        }
        .custom-audio-player .rhap_progress-container {
          flex: 1 1 auto;
          min-width: 0;
          height: 6px;
          margin: 0;
          position: relative;
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
          top: 50%;
          transform: translateY(-50%);
          position: absolute;
        }
        .custom-audio-player .rhap_time {
          font-size: 0.75rem;
          color: #6b7280;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .custom-audio-player .rhap_additional-controls {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default AudioPlayer;

