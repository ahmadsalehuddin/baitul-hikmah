import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App.jsx'
import { TooltipProvider } from '@/components/ui/tooltip'
import { CurrentUserProvider } from '@/hooks/use-current-user'
import './index.css'

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
