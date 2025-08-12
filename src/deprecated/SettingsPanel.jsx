import React, { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCog, faTimes, faGamepad, faKey, faBrain, faImage, faSave, faDownload, faUpload, faTrash, faPlay, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { faBorderAll } from '@fortawesome/free-solid-svg-icons'
import settingsManager from '../services/SettingsManager.js'
import voiceManager from '../utils/VoiceManager.js'

const SettingsPanel = ({ 
  onWireframeToggle, 
  onNippleToggle, 
  wireframeEnabled = false, 
  nippleEnabled = false,
  isOpen = false,
  onClose
}) => {
  const [settings, setSettings] = useState(settingsManager.getAllSettings())
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [voices, setVoices] = useState([])
  const [voicesLoading, setVoicesLoading] = useState(true)
  const [voicesByLanguage, setVoicesByLanguage] = useState({})
  const [testingVoice, setTestingVoice] = useState(null)
  const [testResult, setTestResult] = useState(null) // 'success', 'error', or null
  const [testMessage, setTestMessage] = useState('')

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

  // Load voices when panel opens
  useEffect(() => {
    if (isOpen) {
      loadVoices()
    }
  }, [isOpen])

  const loadVoices = async () => {
    try {
      setVoicesLoading(true)
      
      // Load all voices
      const allVoices = await voiceManager.getVoices()
      setVoices(allVoices)
      
      // Load voices grouped by language
      const grouped = await voiceManager.getVoicesByLanguage()
      setVoicesByLanguage(grouped)
      
      console.log('[SettingsPanel] Loaded voices:', {
        total: allVoices.length,
        languages: Object.keys(grouped).length,
        voiceNames: allVoices.map(v => v.name),
        groupedStructure: Object.entries(grouped).map(([lang, group]) => ({
          language: lang,
          count: group.voices.length,
          voices: group.voices.map(v => v.name)
        }))
      })
    } catch (error) {
      console.error('[SettingsPanel] Failed to load voices:', error)
    } finally {
      setVoicesLoading(false)
    }
  }

  const handleVoiceTest = async (voiceName) => {
    if (testingVoice) return // Prevent multiple tests at once
    
    // Clear previous test results
    setTestResult(null)
    setTestMessage('')
    
    try {
      setTestingVoice(voiceName)
      
      // Find the voice from the current selection (use current state, not saved settings)
      const selectedVoice = voices.find(v => v.name === voiceName)
      
      if (!selectedVoice) {
        throw new Error('Selected voice not found')
      }
      
      console.log('[SettingsPanel] Testing voice:', selectedVoice.name)
      
      // Test the voice with current speech settings
      await voiceManager.testVoice(
        selectedVoice, 
        "Hello! This is a test of the selected voice.",
        {
          rate: settings.speechRate || 1.0,
          pitch: settings.speechPitch || 1.0
        }
      )
      
      // Show success feedback
      setTestResult('success')
      setTestMessage('Voice test completed successfully!')
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setTestResult(null)
        setTestMessage('')
      }, 3000)
      
    } catch (error) {
      console.error('[SettingsPanel] Voice test failed:', error)
      
      // Show error feedback
      setTestResult('error')
      
      // Provide user-friendly error messages
      if (error.message.includes('not found')) {
        setTestMessage('Voice not available. Please select a different voice.')
      } else if (error.message.includes('not supported')) {
        setTestMessage('Speech synthesis not supported in this browser.')
      } else {
        setTestMessage('Voice test failed. Please check your browser audio settings.')
      }
      
      // Clear error message after 5 seconds
      setTimeout(() => {
        setTestResult(null)
        setTestMessage('')
      }, 5000)
      
    } finally {
      setTestingVoice(null)
    }
  }

  const handleVoiceChange = (voiceName) => {
    handleSettingChange('voice', voiceName)
  }

  const handleClose = () => {
    if (onClose) {
      onClose()
    }
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
      {/* Settings Panel */}
      {isOpen && (
        <div className="settings-panel">
          <div className="settings-header">
            <h3>Settings</h3>
            <button 
              className="close-settings-btn"
              onClick={handleClose}
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

              {/* Voice Selection */}
              <div className="setting-item">
                <div className="setting-info">
                  <label htmlFor="voice-select">Text-to-Speech Voice</label>
                  <p>Choose the voice for AI responses and feedback</p>
                </div>
                <div className="voice-selection-container">
                  {voicesLoading ? (
                    <div className="voice-loading">
                      <FontAwesomeIcon icon={faSpinner} spin />
                      <span>Loading available voices...</span>
                    </div>
                  ) : voices.length === 0 ? (
                    <div className="voice-unavailable">
                      <span>No voices available - Speech synthesis not supported</span>
                    </div>
                  ) : (
                    <>
                      <select
                        id="voice-select"
                        value={settings.voice || ''}
                        onChange={(e) => handleVoiceChange(e.target.value)}
                        className="settings-select voice-select"
                      >
                        <option value="">Default System Voice</option>
                        {Object.entries(voicesByLanguage)
                          .filter(([langCode, langGroup]) => langGroup.voices && langGroup.voices.length > 0) // Filter out empty language groups
                          .map(([langCode, langGroup]) => (
                            <optgroup key={langCode} label={`${langGroup.name} (${langGroup.voices.length})`}>
                              {langGroup.voices
                                .filter(voice => voice.name && voice.name.trim()) // Filter out voices with invalid names
                                .map((voice, index) => (
                                  <option key={`${langCode}-${voice.name || `voice-${index}`}`} value={voice.name}>
                                    {voice.displayName}
                                  </option>
                                ))}
                            </optgroup>
                          ))}
                      </select>
                      
                      {/* Voice Test Button */}
                      {settings.voice && (
                        <button
                          className="voice-test-btn"
                          onClick={() => handleVoiceTest(settings.voice)}
                          disabled={testingVoice === settings.voice}
                          aria-label="Test selected voice"
                        >
                          {testingVoice === settings.voice ? (
                            <FontAwesomeIcon icon={faSpinner} spin />
                          ) : (
                            <FontAwesomeIcon icon={faPlay} />
                          )}
                        </button>
                      )}
                    </>
                  )}
                </div>
                
                {/* Voice Test Feedback */}
                {testMessage && (
                  <div className={`voice-test-feedback ${testResult}`}>
                    <span>{testMessage}</span>
                  </div>
                )}
                
                {/* Voice Info */}
                {settings.voice && voices.length > 0 && (
                  <div className="voice-info">
                    {(() => {
                      const selectedVoice = voices.find(v => v.name === settings.voice)
                      if (selectedVoice) {
                        return (
                          <div className="voice-details">
                            <span className="voice-lang">Language: {selectedVoice.lang || 'Unknown'}</span>
                            <span className="voice-type">
                              {selectedVoice.localService ? 'Local Voice' : 'Cloud Voice'}
                            </span>
                            {voiceManager.getVoiceQuality(selectedVoice) === 'high' && (
                              <span className="voice-quality">High Quality</span>
                            )}
                          </div>
                        )
                      }
                      return null
                    })()}
                  </div>
                )}
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
          onClick={handleClose}
          aria-hidden="true"
        />
      )}
    </>
  )
}

export default SettingsPanel
