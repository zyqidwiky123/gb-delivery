import React, { useState, useEffect } from 'react';

let toastQueue = [];
let toastTimer = null;

const showToast = (message, type = 'info', duration = 3000) => {
  toastQueue.push({ message, type });
  if (!toastTimer) {
    renderToast();
  }
};

const renderToast = () => {
  const container = document.getElementById('toast-root');
  if (!container) return;
  if (toastQueue.length === 0) {
    toastTimer = null;
    return;
  }
  const { message, type } = toastQueue.shift();
  const toast = document.createElement('div');
  toast.className = `fixed bottom-4 left-1/2 transform -translate-x-1/2 min-w-[200px] max-w-xs px-4 py-2 rounded-xl shadow-lg text-white transition-opacity duration-300 ${type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-green-600' : 'bg-gray-800'}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      container.removeChild(toast);
      renderToast();
    }, 300);
  }, 3000);
};

export const ToastProvider = ({ children }) => {
  useEffect(() => {
    const div = document.createElement('div');
    div.id = 'toast-root';
    document.body.appendChild(div);
    return () => {
      document.body.removeChild(div);
    };
  }, []);
  return <>{children}</>;
};

export default showToast;
