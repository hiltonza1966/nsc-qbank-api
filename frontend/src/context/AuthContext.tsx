import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

interface User {
  user_id: number;
  username: string;
  display_name: string;
  role: string;
  subject_id: number | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isModerator: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
  isModerator: false,
  isAdmin: false
});

const INACTIVITY_TIMEOUT = 30000; // 30 seconds
const WARNING_THRESHOLD = 10000;  // 10 seconds before logout

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const warningShownRef = useRef(false);

  // Load from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('qbank_token');
    const savedUser = localStorage.getItem('qbank_user');
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('qbank_token');
        localStorage.removeItem('qbank_user');
      }
    }
  }, []);

  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (warningRef.current) { clearTimeout(warningRef.current); warningRef.current = null; }
  }, []);

  const doLogout = useCallback(() => {
    clearTimers();
    warningShownRef.current = false;
    localStorage.removeItem('qbank_token');
    localStorage.removeItem('qbank_user');
    setToken(null);
    setUser(null);
  }, [clearTimers]);

  const showWarning = useCallback(() => {
    if (warningShownRef.current || !token) return;
    warningShownRef.current = true;
    const remaining = Math.ceil(WARNING_THRESHOLD / 1000);
    // Use a custom modal instead of alert for better UX
    const confirmed = window.confirm(
      `Security Warning: You will be logged out in ${remaining} seconds due to inactivity.\n\nClick OK to stay logged in, or Cancel to log out now.`
    );
    warningShownRef.current = false;
    if (confirmed) {
      resetInactivityTimer();
    } else {
      doLogout();
    }
  }, [token]);

  const resetInactivityTimer = useCallback(() => {
    if (!token) return;
    clearTimers();
    warningRef.current = setTimeout(() => {
      showWarning();
    }, INACTIVITY_TIMEOUT - WARNING_THRESHOLD);
    timerRef.current = setTimeout(() => {
      doLogout();
    }, INACTIVITY_TIMEOUT);
  }, [token, clearTimers, showWarning, doLogout]);

  // Inactivity timer setup
  useEffect(() => {
    if (!token) {
      clearTimers();
      return;
    }
    resetInactivityTimer();
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click', 'wheel'];
    const handleActivity = () => resetInactivityTimer();
    events.forEach(e => document.addEventListener(e, handleActivity, { passive: true }));
    return () => {
      clearTimers();
      events.forEach(e => document.removeEventListener(e, handleActivity));
    };
  }, [token, resetInactivityTimer, clearTimers]);

  const login = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem('qbank_token', newToken);
    localStorage.setItem('qbank_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    doLogout();
  }, [doLogout]);

  const isAuthenticated = !!token && !!user;
  const isModerator = isAuthenticated && (user?.role === 'moderator' || user?.role === 'admin');
  const isAdmin = isAuthenticated && user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated, isModerator, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
