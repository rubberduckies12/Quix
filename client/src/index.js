import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './index.css';
import Home from './pages/home/home.jsx';
import Submit from './pages/submit/submit.jsx';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/submit" element={<Submit />} />
      </Routes>
    </Router>
  </React.StrictMode>
);