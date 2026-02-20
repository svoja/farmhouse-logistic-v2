import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// In dev, Strict Mode double-mounts and double-runs effects (to surface bugs), which can cause
// flicker, duplicate API calls, and map/iframe glitches. Server runs production build without that.
const root = createRoot(document.getElementById('root'))
const app = <App />
root.render(
  import.meta.env.DEV ? app : <StrictMode>{app}</StrictMode>,
)
