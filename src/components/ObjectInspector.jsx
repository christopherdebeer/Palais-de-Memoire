import React, { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes, faEdit, faTrash, faArrowsAlt, faEye, faMapMarkerAlt } from '@fortawesome/free-solid-svg-icons'

const ObjectInspector = ({ 
  isOpen, 
  object, 
  onClose, 
  onEdit, 
  onDelete, 
  onMove,
  isProcessing = false 
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editInfo, setEditInfo] = useState('')

  useEffect(() => {
    if (object) {
      setEditName(object.name || '')
      setEditInfo(object.information || object.info || '')
    }
  }, [object])

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleSaveEdit = () => {
    if (onEdit && editName.trim() && editInfo.trim()) {
      onEdit({
        id: object.id,
        name: editName.trim(),
        information: editInfo.trim()
      })
      setIsEditing(false)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditName(object?.name || '')
    setEditInfo(object?.information || object?.info || '')
  }

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${object?.name}"? This action cannot be undone.`)) {
      if (onDelete) {
        onDelete(object.id)
      }
    }
  }

  const handleMove = () => {
    if (onMove) {
      onMove(object.id)
    }
  }

  const formatPosition = (position) => {
    if (!position) return 'Unknown'
    return `(${position.x?.toFixed(1) || 0}, ${position.y?.toFixed(1) || 0}, ${position.z?.toFixed(1) || 0})`
  }

  const getDistanceFromCenter = (position) => {
    if (!position) return 'Unknown'
    const distance = Math.sqrt(position.x * position.x + position.y * position.y + position.z * position.z)
    return `${distance.toFixed(1)}m`
  }

  if (!isOpen || !object) return null;

  console.log(`[ObjectInspector] Rendering object inspector for object:`, {
    objectId: object.id,
    objectName: object.name,
    timestamp: new Date().toISOString()
  }, object)

  return (
    <>
      {/* Backdrop */}
      <div className="object-inspector-backdrop" onClick={onClose} />
      
      {/* Inspector Modal */}
      <div className="object-inspector">
        <div className="object-inspector-header">
          <h3>
            <FontAwesomeIcon icon={faEye} />
            Object Inspector
          </h3>
          <button 
            className="close-inspector-btn"
            onClick={onClose}
            aria-label="Close inspector"
            disabled={isProcessing}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="object-inspector-content">
          {isEditing ? (
            // Edit Mode
            <div className="object-edit-form">
              <div className="form-group">
                <label htmlFor="edit-name">Object Name</label>
                <input
                  id="edit-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="object-input"
                  placeholder="Enter object name..."
                  disabled={isProcessing}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-info">Memory Information</label>
                <textarea
                  id="edit-info"
                  value={editInfo}
                  onChange={(e) => setEditInfo(e.target.value)}
                  className="object-textarea"
                  placeholder="Enter memory information..."
                  rows={4}
                  disabled={isProcessing}
                />
              </div>

              <div className="edit-actions">
                <button
                  className="save-btn primary-btn"
                  onClick={handleSaveEdit}
                  disabled={!editName.trim() || !editInfo.trim() || isProcessing}
                >
                  Save Changes
                </button>
                <button
                  className="cancel-btn secondary-btn"
                  onClick={handleCancelEdit}
                  disabled={isProcessing}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            // View Mode
            <div className="object-details">
              <div className="object-info">
                <h4 className="object-name">{object.name}</h4>
                <p className="object-description">{object.information || object.info}</p>
              </div>

              <div className="object-metadata">
                <div className="metadata-item">
                  <FontAwesomeIcon icon={faMapMarkerAlt} />
                  <span>Position: {formatPosition(object.position)}</span>
                </div>
                <div className="metadata-item">
                  <FontAwesomeIcon icon={faMapMarkerAlt} />
                  <span>Distance: {getDistanceFromCenter(object.position)}</span>
                </div>
                {object.createdAt && (
                  <div className="metadata-item">
                    <span>Created: {new Date(object.createdAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              <div className="object-actions">
                <button
                  className="action-btn edit-btn"
                  onClick={handleEdit}
                  disabled={isProcessing}
                  title="Edit object"
                >
                  <FontAwesomeIcon icon={faEdit} />
                  Edit
                </button>
                
                <button
                  className="action-btn move-btn"
                  onClick={handleMove}
                  disabled={isProcessing}
                  title="Move object"
                >
                  <FontAwesomeIcon icon={faArrowsAlt} />
                  Move
                </button>
                
                <button
                  className="action-btn delete-btn danger-btn"
                  onClick={handleDelete}
                  disabled={isProcessing}
                  title="Delete object"
                >
                  <FontAwesomeIcon icon={faTrash} />
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>

        {isProcessing && (
          <div className="processing-overlay">
            <div className="processing-spinner"></div>
            <span>Processing...</span>
          </div>
        )}
      </div>
    </>
  )
}

export default ObjectInspector
