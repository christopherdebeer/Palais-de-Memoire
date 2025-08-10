import React, { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCog, faTimes, faGamepad, faKey, faBrain, faImage, faSave, faDownload, faUpload, faTrash } from '@fortawesome/free-solid-svg-icons'
import { faBorderAll } from '@fortawesome/free-solid-svg-icons'
import settingsManager from '../services/SettingsManager.js'

const SettingsPanel = ({ 
  onWireframeToggle, 
  onNippleToggle, 
  wireframeEnabled = false, 
  nippleEnabled = false 
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [settings, setSettings] = useState(settingsManager.getAllSettings())
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Load settings on mount
  useEffect(() => {
    const loadedSettings = settingsManager.getAllSettings()
    setSettings(loadedSettings)

    // Listen for settings changes
    const handleSettingsChange = () => {
      setSettings(settingsManager.getAllSettings())
      setHasUnsavedChanges(false)
    }

    settingsManager.addEventListener(handleSettingsChange)
    return () => settingsManager.removeEventListener(handleSettingsChange)
  }, [])

  const togglePanel = () => {
    setIsOpen(!isOpen)
  }

  const handleWireframeToggle = () => {
    const newValue = !wireframeEnabled
    onWireframeToggle(newValue)
    settingsManager.set('wireframeMode', newValue)
  }

  const handleNippleToggle = () => {
    const newValue = !nippleEnabled
    onNippleToggle(newValue)
    settingsManager.set('touchJoystick', newValue)
  }

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setHasUnsavedChanges(true)
  }

  const handleSaveSettings = () => {
    settingsManager.updateSettings(settings)
    setHasUnsavedChanges(false)
  }

  const handleResetSettings = () => {
    if (window.confirm('Reset all settings to defaults? This cannot be undone.')) {
      settingsManager.resetSettings()
      setHasUnsavedChanges(false)
    }
  }

  const handleExportSettings = () => {
    settingsManager.exportSettings()
  }

  const handleImportSettings = (event) => {
    const file = event.target.files[0]
    if (file) {
      settingsManager.importSettings(file)
      event.target.value = '' // Reset file input
    }
  }

  const apiConfigured = settingsManager.isApiConfigured()
  const validation = settingsManager.validateApiConfiguration()

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
            {/* API Configuration */}
            <div className="setting-group">
              <h4>
                <FontAwesomeIcon icon={faKey} />
                API Configuration
                {!apiConfigured && <span className="status-badge error">Not Configured</span>}
                {apiConfigured && <span className="status-badge success">Configured</span>}
              </h4>
              
              <div className="setting-item">
                <div className="setting-info">
                  <label htmlFor="anthropic-key">Anthropic API Key</label>
                  <p>Required for AI voice processing and command interpretation</p>
                </div>
                <input
                  type="password"
                  id="anthropic-key"
                  value={settings.anthropicApiKey || ''}
                  onChange={(e) => handleSettingChange('anthropicApiKey', e.target.value)}
                  placeholder="Enter your Anthropic API key"
                  className="api-key-input"
                />
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label htmlFor="replicate-key">Replicate API Key</label>
                  <p>Required for generating room skybox images</p>
                </div>
                <input
                  type="password"
                  id="replicate-key"
                  value={settings.replicateApiKey || ''}
                  onChange={(e) => handleSettingChange('replicateApiKey', e.target.value)}
                  placeholder="Enter your Replicate API key"
                  className="api-key-input"
                />
              </div>

              {!validation.isValid && (
                <div className="validation-errors">
                  {validation.errors.map((error, index) => (
                    <p key={index} className="error-text">⚠️ {error}</p>
                  ))}
                </div>
              )}
            </div>

            {/* AI Settings */}
            <div className="setting-group">
              <h4>
                <FontAwesomeIcon icon={faBrain} />
                AI & Voice Settings
              </h4>

              <div className="setting-item">
                <div className="setting-info">
                  <label htmlFor="system-prompt">System Prompt</label>
                  <p>Instructions for the AI assistant behavior</p>
                </div>
                <textarea
                  id="system-prompt"
                  value={settings.systemPrompt || ''}
                  onChange={(e) => handleSettingChange('systemPrompt', e.target.value)}
                  rows={3}
                  className="settings-textarea"
                />
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label htmlFor="response-temperature">
                    AI Creativity: <span className="range-value">{settings.responseTemperature}</span>
                  </label>
                  <p>Higher values make responses more creative</p>
                </div>
                <input
                  type="range"
                  id="response-temperature"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.responseTemperature || 0.7}
                  onChange={(e) => handleSettingChange('responseTemperature', parseFloat(e.target.value))}
                  className="range-input"
                />
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label htmlFor="speech-rate">
                    Speech Rate: <span className="range-value">{settings.speechRate}</span>
                  </label>
                  <p>Speed of text-to-speech output</p>
                </div>
                <input
                  type="range"
                  id="speech-rate"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={settings.speechRate || 1.0}
                  onChange={(e) => handleSettingChange('speechRate', parseFloat(e.target.value))}
                  className="range-input"
                />
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label htmlFor="speech-pitch">
                    Speech Pitch: <span className="range-value">{settings.speechPitch}</span>
                  </label>
                  <p>Pitch of text-to-speech voice</p>
                </div>
                <input
                  type="range"
                  id="speech-pitch"
                  min="0"
                  max="2"
                  step="0.1"
                  value={settings.speechPitch || 1.0}
                  onChange={(e) => handleSettingChange('speechPitch', parseFloat(e.target.value))}
                  className="range-input"
                />
              </div>
            </div>

            {/* Image Generation */}
            <div className="setting-group">
              <h4>
                <FontAwesomeIcon icon={faImage} />
                Image Generation
              </h4>

              <div className="setting-item">
                <div className="setting-info">
                  <label htmlFor="aesthetic-prompt">Visual Style Prompt</label>
                  <p>Style instructions added to all room image generation</p>
                </div>
                <textarea
                  id="aesthetic-prompt"
                  value={settings.aestheticPrompt || ''}
                  onChange={(e) => handleSettingChange('aestheticPrompt', e.target.value)}
                  rows={3}
                  className="settings-textarea"
                  placeholder="e.g., Professional architectural photography, soft lighting..."
                />
              </div>
            </div>

            {/* 3D Rendering */}
            <div className="setting-group">
              <h4>
                <FontAwesomeIcon icon={faBorderAll} />
                3D Rendering
              </h4>
              
              <div className="setting-item">
                <div className="setting-info">
                  <label htmlFor="wireframe-toggle">Wireframe Mode</label>
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

              <div className="setting-item">
                <div className="setting-info">
                  <label htmlFor="render-quality">Render Quality</label>
                  <p>Higher quality uses more system resources</p>
                </div>
                <select
                  id="render-quality"
                  value={settings.renderQuality || 'high'}
                  onChange={(e) => handleSettingChange('renderQuality', e.target.value)}
                  className="settings-select"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label htmlFor="particle-effects">Particle Effects</label>
                  <p>Enable visual particle markers for objects</p>
                </div>
                <button 
                  id="particle-effects"
                  className={`toggle-switch ${settings.particleEffects ? 'active' : ''}`}
                  onClick={() => handleSettingChange('particleEffects', !settings.particleEffects)}
                  aria-pressed={settings.particleEffects}
                >
                  <span className="toggle-slider"></span>
                </button>
              </div>
            </div>

            {/* Controls */}
            <div className="setting-group">
              <h4>
                <FontAwesomeIcon icon={faGamepad} />
                Controls
              </h4>
              
              <div className="setting-item">
                <div className="setting-info">
                  <label htmlFor="nipple-toggle">Touch Joystick</label>
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

              <div className="setting-item">
                <div className="setting-info">
                  <label htmlFor="audio-feedback">Audio Feedback</label>
                  <p>Play sounds for interactions and confirmations</p>
                </div>
                <button 
                  id="audio-feedback"
                  className={`toggle-switch ${settings.audioFeedback ? 'active' : ''}`}
                  onClick={() => handleSettingChange('audioFeedback', !settings.audioFeedback)}
                  aria-pressed={settings.audioFeedback}
                >
                  <span className="toggle-slider"></span>
                </button>
              </div>
            </div>

            {/* Settings Actions */}
            <div className="setting-group">
              <h4>Settings Management</h4>
              
              <div className="settings-actions">
                <button 
                  className={`primary-btn ${hasUnsavedChanges ? 'pulse' : ''}`}
                  onClick={handleSaveSettings}
                  disabled={!hasUnsavedChanges}
                >
                  <FontAwesomeIcon icon={faSave} />
                  {hasUnsavedChanges ? 'Save Changes' : 'Saved'}
                </button>

                <button className="secondary-btn" onClick={handleExportSettings}>
                  <FontAwesomeIcon icon={faDownload} />
                  Export Settings
                </button>

                <div className="file-input-wrapper">
                  <input
                    type="file"
                    id="import-settings"
                    accept=".json"
                    onChange={handleImportSettings}
                    style={{ display: 'none' }}
                  />
                  <button 
                    className="secondary-btn"
                    onClick={() => document.getElementById('import-settings').click()}
                  >
                    <FontAwesomeIcon icon={faUpload} />
                    Import Settings
                  </button>
                </div>

                <button className="danger-btn" onClick={handleResetSettings}>
                  <FontAwesomeIcon icon={faTrash} />
                  Reset to Defaults
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