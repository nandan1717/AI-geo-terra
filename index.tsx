import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { NewsProvider } from './context/NewsContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <NewsProvider>
      <App />
    </NewsProvider>
  </React.StrictMode>
);