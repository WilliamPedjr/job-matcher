import React from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.jsx'

const LEGACY_API_ORIGIN = 'http://localhost:5000'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

const originalFetch = window.fetch.bind(window)
window.fetch = (input, init) => {
  if (typeof input === 'string' && input.startsWith(LEGACY_API_ORIGIN)) {
    return originalFetch(input.replace(LEGACY_API_ORIGIN, API_BASE_URL), init)
  }
  if (input instanceof Request && input.url.startsWith(LEGACY_API_ORIGIN)) {
    const rewritten = input.url.replace(LEGACY_API_ORIGIN, API_BASE_URL)
    return originalFetch(new Request(rewritten, input), init)
  }
  return originalFetch(input, init)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
