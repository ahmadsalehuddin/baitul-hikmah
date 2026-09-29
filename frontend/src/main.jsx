import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App.jsx'
import { TooltipProvider } from '@/components/ui/tooltip'
import { CurrentUserProvider } from '@/hooks/use-current-user'
import { applyTextSize, loadStoredTextSize } from '@/lib/text-size'
import './index.css'

// Paint at the saved text size straight away; the user's saved value replaces it once loaded.
applyTextSize(loadStoredTextSize())

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <TooltipProvider>
        <CurrentUserProvider>
          <App />
        </CurrentUserProvider>
      </TooltipProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
