import React from 'react';
import { createRoot } from 'react-dom/client';

const App = () => {
  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>Hello from Norma</h1>
      <p>Electron 42 + React + Vite + TypeScript Setup!</p>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
