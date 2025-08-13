import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'
import './styles/components.css'
import { MemoryPalaceCore } from './core/MemoryPalaceCore.js'

const core = new MemoryPalaceCore({
  apiProvider: 'mock', // Start with mock provider for development
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