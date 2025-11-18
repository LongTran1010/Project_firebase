// Import các hook cần dùng và CSS
import React, { useState, useRef, useEffect } from 'react';
import './LoginForm.css';
import { auth } from '../../dtb/firebase';
import { useLoginFormHandler } from './LoginFormHandler';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const emailRef = useRef(null);

  useEffect(() => {
    setEmail('');
    setPassword('');
    setError('');
  }, []);

  const handleSubmit = useLoginFormHandler({
    auth,
    email,
    password,
    isRegister,
    setEmail,
    setPassword,
    setError,
    setIsRegister,
    emailRef
  });

  return (
    <div id="container">
      <form id="container-loginForm" onSubmit={handleSubmit} autoComplete="off">
        <h1 className="container-loginForm__heading">{isRegister ? 'Đăng ký' : 'Đăng nhập'}</h1>
        <input
          type="email"
          placeholder="Email..."
          id="container-loginForm__username"
          value={email}
          ref={emailRef}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="off"
        />
        <input
          type="password"
          placeholder="Mật khẩu..."
          id="container-loginForm__password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
        <input
          type="submit"
          value={isRegister ? 'Đăng ký' : 'Đăng nhập'}
          className="container-loginForm__submit"
        />
        <button
          type="button"
          style={{marginTop: '10px', background: '#3498db', color: 'white', border: 'none', borderRadius: '5px', padding: '6px 12px', cursor: 'pointer'}}
          onClick={() => { setIsRegister(!isRegister); setError(''); }}
        >
          {isRegister ? 'Chuyển sang đăng nhập' : 'Chưa có tài khoản? Đăng ký'}
        </button>
        {error && (<p style={{ color: 'red' }}>{error}</p>)}
      </form>
    </div>
  );
}
