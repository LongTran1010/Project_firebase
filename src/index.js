// src/index.js
import React from 'react';
import { BrowserRouter } from "react-router-dom";
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Debug helper: confirm this file is executed when the bundle loads
console.log('index.js loaded - attempting to mount React App');

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
	<BrowserRouter>
		<App />
	</BrowserRouter>
);
