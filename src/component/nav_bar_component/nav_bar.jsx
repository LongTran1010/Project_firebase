import React from 'react';
import { useNavigate } from "react-router-dom";
import './nav_bar.css';

export default function NavBar({ user, onLoginClick, onLogoutClick }) {
  const navigate = useNavigate();

  return (
    <nav className="navbar">
      {user ? (
        <div className="navbar__left">
          <span className="navbar__brand">Hệ thống nhúng</span>

          {/* Bấm vào thì chuyển URL sang /dashboard */}
          <button 
            className="navbar__btn" 
            onClick={() => navigate("/dashboard")}
          >
            Dashboard
          </button>
        </div>
      ) : (
        <div className="navbar__left">
          <span className="navbar__brand">Nhóm 100</span>
        </div>
      )}

      <div className="navbar__right">
        {user ? (
          <>
            <span className="navbar__user">{"Xin chào " + user.email}</span>
            <button className="navbar__btn" onClick={onLogoutClick}>Đăng xuất</button>
          </>
        ) : (
          <button className="navbar__btn" onClick={onLoginClick}>Đăng nhập</button>
        )}
      </div>
    </nav>
  );
}
