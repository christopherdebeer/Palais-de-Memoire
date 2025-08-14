import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'
import './styles/components.css'
import { MemoryPalaceCore } from './core/MemoryPalaceCore.js'

const core = new MemoryPalaceCore({
  enableImageGeneration: true, // Enable real image generation via Replicate
  persistence: 'localStorage',
  enableVoice: true,
  enableSpatialInteraction: true,
  autopilot: false
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App core={core}/>
  </React.StrictMode>,
)

window.mp = core;