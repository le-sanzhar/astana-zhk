import React from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Complex from './pages/Complex'
import Compare from './pages/Compare'

function TabBar() {
  const location = useLocation()
  
  return (
    <nav className="tab-bar">
      <Link to="/" className={`tab-btn ${location.pathname === '/' ? 'active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span>Список</span>
      </Link>
      <Link to="/compare" className={`tab-btn ${location.pathname === '/compare' ? 'active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
        <span>Сравнение</span>
      </Link>
    </nav>
  )
}

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <header className="nav">
          <div className="nav-inner">
            <Link to="/" className="nav-logo">ЖК Астана</Link>
          </div>
        </header>

        <main className="main container">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/complex/:id" element={<Complex />} />
            <Route path="/compare" element={<Compare />} />
          </Routes>
        </main>

        <TabBar />
      </div>
    </BrowserRouter>
  )
}

export default App
