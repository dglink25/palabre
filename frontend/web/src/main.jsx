import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Police Inter Variable (auto-hébergée via @fontsource-variable/inter)
import '@fontsource-variable/inter';
import './theme.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
