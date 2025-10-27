import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import Login from './pages/Login.jsx'; // we’ll add more later (like Admin)
import Admin from './pages/Admin.jsx';
import CancelBooking from './pages/CancelBooking';
import SubmitRecommendation from "./pages/SubmitRecommendation";



createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/cancel/:token" element={<CancelBooking />} />
        <Route path="/recommend" element={<SubmitRecommendation />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
