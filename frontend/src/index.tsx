import React from 'react';
import { createRoot } from 'react-dom/client';
import GomokuBoard from './components/GomokuBoard';

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <GomokuBoard />
  </React.StrictMode>
);