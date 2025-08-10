import React, { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCog, faTimes, faGamepad } from '@fortawesome/free-solid-svg-icons'
import { faBorderAll } from '@fortawesome/free-solid-svg-icons'

const SettingsPanel = ({ 
  onWireframeToggle, 
  onNippleToggle, 
  wireframeEnabled = false, 
  nippleEnabled = false 
}) => {
  const [isOpen, setIsOpen] = useState(false)

  const togglePanel = () => {
    setIsOpen(!isOpen)
  }

  const handleWireframeToggle = () => {
    const newValue = !wireframeEnabled
    onWireframeToggle(newValue)
  }

  const handleNippleToggle = () => {
    const newValue = !nippleEnabled
    onNippleToggle(newValue)
  }

  return (
    <>
      {/* Settings Toggle Button */}
      <button 
        className="settings-toggle"
        onClick={togglePanel}
        aria-label="Toggle settings"
      >
        <FontAwesomeIcon icon={faCog} />
      </button>

      {/* Settings Panel */}
      {isOpen && (
        <div className="settings-panel">
          <div className="settings-header">
            <h3>Settings</h3>
            <button 
              className="close-settings-btn"
              onClick={togglePanel}
              aria-label="Close settings"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
          
          <div className="settings-content">
            <div className="setting-group">
              <h4>3D Rendering</h4>
              
              <div className="setting-item">
                <div className="setting-info">
                  <label htmlFor="wireframe-toggle">
                    <FontAwesomeIcon icon={faBorderAll} />
                    Wireframe Mode
                  </label>
                  <p>Show wireframe overlay for debugging</p>
                </div>
                <button 
                  id="wireframe-toggle"
                  className={`toggle-switch ${wireframeEnabled ? 'active' : ''}`}
                  onClick={handleWireframeToggle}
                  aria-pressed={wireframeEnabled}
                >
                  <span className="toggle-slider"></span>
                </button>
              </div>
            </div>

            <div className="setting-group">
              <h4>Controls</h4>
              
              <div className="setting-item">
                <div className="setting-info">
                  <label htmlFor="nipple-toggle">
                    <FontAwesomeIcon icon={faGamepad} />
                    Touch Joystick
                  </label>
                  <p>Enable virtual joystick for mobile navigation</p>
                </div>
                <button 
                  id="nipple-toggle"
                  className={`toggle-switch ${nippleEnabled ? 'active' : ''}`}
                  onClick={handleNippleToggle}
                  aria-pressed={nippleEnabled}
                >
                  <span className="toggle-slider"></span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="settings-backdrop" 
          onClick={togglePanel}
          aria-hidden="true"
        />
      )}
    </>
  )
}

export default SettingsPanel