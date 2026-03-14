import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
// 1. Import the new TenantProvider
import { TenantProvider } from './contexts/TenantContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* 2. Wrap your entire app inside the Provider */}
    <TenantProvider>
      <App />
    </TenantProvider>
  </React.StrictMode>,
)