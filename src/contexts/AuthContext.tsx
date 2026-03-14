import React, { createContext, useContext, useState, ReactNode } from 'react';

// 1. Define the exact shape of your User data
export interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  subscriberId: string;
  prefix?: string;
}

// 2. Define the response structure for the login function
export interface LoginResponse {
  success: boolean;
  message?: string;
}

// 3. Define everything the Context provides to the rest of the app
export interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<LoginResponse>;
  logout: () => void;
}

// 4. Initialize the context (TypeScript now knows it can be AuthContextType OR null)
const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

// 5. Build the Provider
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Initialize state from localStorage so users stay logged in on refresh
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('pronomad_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const login = async (username: string, password: string): Promise<LoginResponse> => {
    try {
      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUser(data.user);
        localStorage.setItem('pronomad_user', JSON.stringify(data.user));
        return { success: true };
      } else {
        return { success: false, message: data.message || 'Invalid credentials' };
      }
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, message: 'Server connection failed' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('pronomad_user');
    window.location.href = '/login'; // Force app reload to clear memory
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// 6. THE MAGIC FIX: The custom hook
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  // By throwing an error if it's null, we guarantee to TypeScript 
  // that 'context' will ALWAYS be an object containing { user }.
  // This completely eliminates the "Property 'user' does not exist on type 'null'" error.
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider wrapper');
  }
  
  return context;
};