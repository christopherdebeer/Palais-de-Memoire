import React, { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBars, faCog, faTimes, faHome, faPlus, faList, faEye } from '@fortawesome/free-solid-svg-icons'

/**
 * SimpleUI - Consolidated UI controls replacing multiple components
 */
export default function SimpleUI({
  currentRoom,
  rooms = [],
  objects = [],
  settings,
  onCreateRoom,
  onSelectRoom,
  onCreateObject,
  onToggleWireframe,
  onToggleSetting
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const toggleMenu = () => setShowMenu(!showMenu)
  const toggleSettings = () => setShowSettings(!showSettings)

  return (
    <>
      {/* Main Menu Button */}
      <button className="ui-button menu-button" onClick={toggleMenu}>
        <FontAwesomeIcon icon={showMenu ? faTimes : faBars} />
      </button>

      {/* Side Menu */}
      {showMenu && (
        <div className="side-menu">
          <div className="menu-header">
            <h3>Memory Palace</h3>
          </div>

          {/* Current Room Info */}
          <div className="menu-section">
            <h4>Current Room</h4>
            {currentRoom ? (
              <div className="room-info">
                <p><strong>{currentRoom.name}</strong></p>
                <small>{objects.length} objects</small>
              </div>
            ) : (
              <p className="no-room">No room selected</p>
            )}
          </div>

          {/* Room List */}
          <div className="menu-section">
            <h4>Rooms ({rooms.length})</h4>
            <div className="room-list">
              {rooms.map(room => (
                <button
                  key={room.id}
                  className={`room-item ${currentRoom?.id === room.id ? 'active' : ''}`}
                  onClick={() => onSelectRoom(room.id)}
                >
                  <FontAwesomeIcon icon={faHome} />
                  {room.name}
                </button>
              ))}
            </div>
            <button className="action-button" onClick={onCreateRoom}>
              <FontAwesomeIcon icon={faPlus} />
              Create Room
            </button>
          </div>

          {/* Quick Actions */}
          <div className="menu-section">
            <h4>Actions</h4>
            <button 
              className="action-button" 
              onClick={onCreateObject}
              disabled={!currentRoom}
            >
              <FontAwesomeIcon icon={faPlus} />
              Add Object
            </button>
            
            <button className="action-button" onClick={onToggleWireframe}>
              <FontAwesomeIcon icon={faEye} />
              Toggle Wireframe
            </button>
          </div>

          {/* Settings Button */}
          <div className="menu-section">
            <button className="action-button" onClick={toggleSettings}>
              <FontAwesomeIcon icon={faCog} />
              Settings
            </button>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="settings-overlay">
          <div className="settings-panel">
            <div className="settings-header">
              <h3>Settings</h3>
              <button onClick={toggleSettings}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <div className="settings-content">
              <div className="setting-group">
                <h4>Display</h4>
                <label className="setting-item">
                  <input
                    type="checkbox"
                    checked={settings?.wireframeEnabled || false}
                    onChange={(e) => onToggleSetting('wireframeEnabled', e.target.checked)}
                  />
                  Wireframe Mode
                </label>
                
                <label className="setting-item">
                  <input
                    type="checkbox"
                    checked={settings?.minimapEnabled || false}
                    onChange={(e) => onToggleSetting('minimapEnabled', e.target.checked)}
                  />
                  Show Minimap
                </label>
              </div>

              <div className="setting-group">
                <h4>Voice</h4>
                <label className="setting-item">
                  <input
                    type="checkbox"
                    checked={settings?.voiceEnabled || false}
                    onChange={(e) => onToggleSetting('voiceEnabled', e.target.checked)}
                  />
                  Voice Recognition
                </label>
                
                <label className="setting-item">
                  <input
                    type="checkbox"
                    checked={settings?.captionsEnabled || false}
                    onChange={(e) => onToggleSetting('captionsEnabled', e.target.checked)}
                  />
                  Voice Captions
                </label>
              </div>

              <div className="setting-group">
                <h4>Interaction</h4>
                <label className="setting-item">
                  <input
                    type="checkbox"
                    checked={settings?.motionControlEnabled || false}
                    onChange={(e) => onToggleSetting('motionControlEnabled', e.target.checked)}
                  />
                  Motion Controls
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .ui-button {
          position: fixed;
          width: 50px;
          height: 50px;
          border: none;
          border-radius: 8px;
          background: var(--color-bg-secondary, rgba(0, 0, 0, 0.7));
          color: white;
          font-size: 18px;
          cursor: pointer;
          backdrop-filter: blur(10px);
          z-index: 1000;
          transition: all 0.3s ease;
        }

        .ui-button:hover {
          background: var(--color-bg-tertiary, rgba(255, 255, 255, 0.1));
          transform: scale(1.05);
        }

        .menu-button {
          top: 20px;
          left: 20px;
        }

        .side-menu {
          position: fixed;
          top: 0;
          left: 0;
          width: 300px;
          height: 100vh;
          background: var(--color-bg-primary, rgba(0, 0, 0, 0.9));
          backdrop-filter: blur(20px);
          padding: 20px;
          overflow-y: auto;
          z-index: 999;
          border-right: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
        }

        .menu-header {
          margin-bottom: 30px;
          padding-bottom: 15px;
          border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
        }

        .menu-header h3 {
          margin: 0;
          color: var(--color-text-primary, white);
          font-size: 20px;
        }

        .menu-section {
          margin-bottom: 25px;
        }

        .menu-section h4 {
          margin: 0 0 10px 0;
          color: var(--color-text-secondary, #ccc);
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .room-info {
          padding: 10px;
          background: var(--color-bg-secondary, rgba(255, 255, 255, 0.05));
          border-radius: 6px;
          margin-bottom: 10px;
        }

        .room-info p {
          margin: 0 0 5px 0;
          color: var(--color-text-primary, white);
        }

        .room-info small {
          color: var(--color-text-tertiary, #999);
        }

        .no-room {
          color: var(--color-text-tertiary, #999);
          font-style: italic;
          margin: 0;
        }

        .room-list {
          margin-bottom: 10px;
        }

        .room-item {
          width: 100%;
          padding: 8px 12px;
          background: transparent;
          border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
          border-radius: 4px;
          color: var(--color-text-secondary, #ccc);
          cursor: pointer;
          margin-bottom: 5px;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .room-item:hover {
          background: var(--color-bg-secondary, rgba(255, 255, 255, 0.05));
          border-color: var(--color-primary, #007acc);
        }

        .room-item.active {
          background: var(--color-primary, #007acc);
          border-color: var(--color-primary, #007acc);
          color: white;
        }

        .action-button {
          width: 100%;
          padding: 10px 12px;
          background: var(--color-bg-secondary, rgba(255, 255, 255, 0.1));
          border: 1px solid var(--color-border, rgba(255, 255, 255, 0.2));
          border-radius: 6px;
          color: var(--color-text-primary, white);
          cursor: pointer;
          margin-bottom: 8px;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .action-button:hover:not(:disabled) {
          background: var(--color-primary, #007acc);
        }

        .action-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .settings-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(5px);
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .settings-panel {
          width: 400px;
          max-height: 80vh;
          background: var(--color-bg-primary, #1a1a1a);
          border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
          border-radius: 12px;
          overflow: hidden;
        }

        .settings-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
        }

        .settings-header h3 {
          margin: 0;
          color: var(--color-text-primary, white);
        }

        .settings-header button {
          background: none;
          border: none;
          color: var(--color-text-secondary, #ccc);
          font-size: 18px;
          cursor: pointer;
          padding: 5px;
        }

        .settings-content {
          padding: 20px;
          max-height: 60vh;
          overflow-y: auto;
        }

        .setting-group {
          margin-bottom: 25px;
        }

        .setting-group h4 {
          margin: 0 0 15px 0;
          color: var(--color-text-secondary, #ccc);
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .setting-item {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
          color: var(--color-text-primary, white);
          cursor: pointer;
        }

        .setting-item input[type="checkbox"] {
          width: 18px;
          height: 18px;
        }
      `}</style>
    </>
  )
}