import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './index.css';
import Home from './pages/home/home.jsx';
import Submit from './pages/submit/submit.jsx';
import Register from './pages/register/register.jsx';
import Login from './pages/login/login.jsx';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/home" element={<Home />} />
        <Route path="/submit" element={<Submit />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </Router>
  </React.StrictMode>
);