import React from 'react';
import NavBar from '../nav_bar_component/nav_bar';
import './main_page.css';

export default function MainPage({ user, onLogoutClick, onDashBoardClick }) {
  return (
    <>
      <div className="main-page-bg" style={{marginTop: '56px', textAlign: 'center'}}>
        <h2>Xin chào, {user.email}!</h2>
        {/* Thêm nội dung dashboard hoặc các thành phần khác tại đây */}
      </div>
    </>
  );
}
