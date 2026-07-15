import React, { createContext, useContext, useState, useEffect } from 'react';

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

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

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('qbank_token', newToken);
    localStorage.setItem('qbank_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('qbank_token');
    localStorage.removeItem('qbank_user');
    setToken(null);
    setUser(null);
  };

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
