import React, { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes, faCheck, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { getFormDataProvider } from '../services/FormDataProvider.js'

const ActionFormModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  action, 
  currentPalaceState,
  isProcessing = false 
}) => {
  const [formData, setFormData] = useState({})
  const [errors, setErrors] = useState({})

  // Reset form when modal opens/closes or action changes
  useEffect(() => {
    if (isOpen) {
      setFormData(getDefaultFormData(action, currentPalaceState))
      setErrors({})
    }
  }, [isOpen, action, currentPalaceState])

  const getDefaultFormData = (action, state) => {
    switch (action) {
      case 'create_room':
        return { name: '', description: '' }
      case 'edit_room':
        return { description: state?.currentRoom?.description || '' }
      case 'go_to_room':
        return { roomName: '' }
      case 'add_object':
        return { name: '', info: '' }
      case 'remove_object':
        return { name: '' }
      default:
        return {}
    }
  }

  const getActionConfig = (action) => {
    const configs = {
      create_room: {
        title: 'Create New Room',
        description: 'Create a new room in your memory palace',
        fields: [
          { key: 'name', label: 'Room Name', type: 'text', required: true, placeholder: 'Enter room name...' },
          { key: 'description', label: 'Room Description', type: 'textarea', required: true, placeholder: 'Describe the room in detail for image generation...' }
        ]
      },
      edit_room: {
        title: 'Edit Current Room',
        description: 'Update the description of your current room',
        fields: [
          { key: 'description', label: 'Room Description', type: 'textarea', required: true, placeholder: 'Update room description...' }
        ]
      },
      go_to_room: {
        title: 'Navigate to Room',
        description: 'Move to another room in your palace',
        fields: [
          { key: 'roomName', label: 'Room Name', type: 'select', required: true, placeholder: 'Select room to navigate to...' }
        ]
      },
      add_object: {
        title: 'Add Memory Object',
        description: 'Place a new object in the current room',
        fields: [
          { key: 'name', label: 'Object Name', type: 'text', required: true, placeholder: 'Enter object name...' },
          { key: 'info', label: 'Memory Information', type: 'textarea', required: true, placeholder: 'What information should this object help you remember?' }
        ]
      },
      remove_object: {
        title: 'Remove Object',
        description: 'Remove an object from the current room',
        fields: [
          { key: 'name', label: 'Object Name', type: 'select', required: true, placeholder: 'Select object to remove...' }
        ]
      }
    }
    return configs[action] || { title: 'Unknown Action', description: '', fields: [] }
  }

  const getSelectOptions = (field, state) => {
    const dataProvider = getFormDataProvider()
    
    if (field.key === 'roomName') {
      return dataProvider.getRoomOptions(state)
    }
    
    if (field.key === 'name' && action === 'remove_object') {
      return dataProvider.getObjectOptions(state)
    }
    
    return []
  }

  const handleInputChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }))
    // Clear error when user starts typing
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: null }))
    }
  }

  const validateForm = (config) => {
    const newErrors = {}
    
    config.fields.forEach(field => {
      if (field.required && (!formData[field.key] || formData[field.key].trim() === '')) {
        newErrors[field.key] = `${field.label} is required`
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const config = getActionConfig(action)
    
    if (validateForm(config)) {
      onSubmit(action, formData)
    }
  }

  const renderField = (field, state) => {
    const value = formData[field.key] || ''
    const error = errors[field.key]

    switch (field.type) {
      case 'text':
        return (
          <div key={field.key} className="form-field">
            <label htmlFor={field.key}>{field.label}</label>
            <input
              id={field.key}
              type="text"
              value={value}
              onChange={(e) => handleInputChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              className={error ? 'error' : ''}
              disabled={isProcessing}
            />
            {error && <span className="field-error">{error}</span>}
          </div>
        )

      case 'textarea':
        return (
          <div key={field.key} className="form-field">
            <label htmlFor={field.key}>{field.label}</label>
            <textarea
              id={field.key}
              value={value}
              onChange={(e) => handleInputChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              className={error ? 'error' : ''}
              disabled={isProcessing}
              rows={4}
            />
            {error && <span className="field-error">{error}</span>}
          </div>
        )

      case 'select':
        const options = getSelectOptions(field, state)
        return (
          <div key={field.key} className="form-field">
            <label htmlFor={field.key}>{field.label}</label>
            <select
              id={field.key}
              value={value}
              onChange={(e) => handleInputChange(field.key, e.target.value)}
              className={error ? 'error' : ''}
              disabled={isProcessing}
            >
              <option value="">{field.placeholder}</option>
              {options.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {error && <span className="field-error">{error}</span>}
          </div>
        )

      default:
        return null
    }
  }

  if (!isOpen) return null

  const config = getActionConfig(action)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="action-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{config.title}</h3>
          <button 
            className="close-modal-btn"
            onClick={onClose}
            disabled={isProcessing}
            aria-label="Close modal"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="modal-content">
          <p className="modal-description">{config.description}</p>
          
          {/* Show current context info */}
          {currentPalaceState && (
            <div className="context-info">
              {currentPalaceState.currentRoom ? (
                <p><strong>Current Room:</strong> {currentPalaceState.currentRoom.name}</p>
              ) : (
                <p><em>No current room - create one first</em></p>
              )}
              <p><strong>Total Rooms:</strong> {currentPalaceState.stats?.totalRooms || 0}</p>
              <p><strong>Total Objects:</strong> {currentPalaceState.stats?.totalObjects || 0}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="action-form">
            {config.fields.map(field => renderField(field, currentPalaceState))}
            
            <div className="form-actions">
              <button 
                type="button" 
                onClick={onClose}
                disabled={isProcessing}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={isProcessing}
                className="submit-btn"
              >
                {isProcessing ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin />
                    Processing...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faCheck} />
                    {config.title}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ActionFormModal
