import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import Login from './pages/Login.jsx'; // we’ll add more later (like Admin)
import Admin from './pages/Admin.jsx';
import LocalRecs from "./pages/LocalRecs";
import CancelBooking from './pages/CancelBooking';
import Subscribe from './pages/Subscribe';
import Unsubscribe from './pages/Unsubscribe';
import AcceptInvite from './pages/AcceptInvite';[cite: 1]


createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/cancel/:token" element={<CancelBooking />} />
       <Route path="/local-recs" element={<LocalRecs />} />
       <Route path="/accept-invite" element={<AcceptInvite />} />
	   <Route path="/subscribe" element={<Subscribe />} />
       <Route path="/unsubscribe" element={<Unsubscribe />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
