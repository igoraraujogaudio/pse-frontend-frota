'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  message: string;
  type: NotificationType;
}

interface NotificationContextProps {
  notify: (message: string, type?: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextProps>({
  notify: () => {},
});

export function useNotification() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<Notification | null>(null);

  const notify = useCallback((message: string, type: NotificationType = 'info') => {
    // Garantir que message seja sempre uma string
    const messageStr = typeof message === 'string' ? message : String(message);
    setNotification({ message: messageStr, type });
    setTimeout(() => setNotification(null), 3500);
  }, []);

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      {notification && notification.message && (
        <div className={`fixed top-6 left-1/2 z-50 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all
          ${notification.type === 'success' ? 'bg-green-600' : ''}
          ${notification.type === 'error' ? 'bg-red-600' : ''}
          ${notification.type === 'info' ? 'bg-blue-600' : ''}
          ${notification.type === 'warning' ? 'bg-yellow-600 text-gray-900' : ''}
        `}>
          {String(notification.message)}
        </div>
      )}
    </NotificationContext.Provider>
  );
} 