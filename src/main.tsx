import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

// Ask the browser not to evict IndexedDB under storage pressure. Not every
// browser supports or grants this; the app works either way.
if (navigator.storage?.persist) {
  void navigator.storage.persist().catch(() => false)
}

const root = document.getElementById('root')
if (!root) throw new Error('Root element missing')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
