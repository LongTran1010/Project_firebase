import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";

import LoginForm from './component/login_component/LoginForm';
import MainPage from './component/main_page_component/main_page';
import NavBar from './component/nav_bar_component/nav_bar';
import Dashboard from './component/dashboard_component/dashboard';

import { auth } from "./dtb/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    navigate("/login")
  };

  if (authLoading) return <p>Loading...</p>;

  return (
    <>
      <NavBar user={user} onLogoutClick={handleLogout} />

      <div style={{ marginTop: "56px" }}>
        <Routes>
          <Route 
            path="/login"
            element={!user ? <LoginForm /> : <Navigate to="/" />}
          />

          <Route 
            path="/"
            element={user ? <MainPage user={user} /> : <Navigate to="/login" />}
          />

          <Route 
            path="/dashboard"
            element={user ? <Dashboard /> : <Navigate to="/login" />}
          />
        </Routes>
      </div>
    </>
  );
}

export default App;
