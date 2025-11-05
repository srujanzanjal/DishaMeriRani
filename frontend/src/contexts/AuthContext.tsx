import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'student' | 'admin';
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Verify session on mount and restore user session
  useEffect(() => {
    const verifySession = async () => {
      try {
        const response = await fetch('/api/verify', {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          localStorage.removeItem('docLocker_user');
          return;
        }

        // Guard JSON parsing
        let result: any = null;
        try {
          result = await response.json();
        } catch (e) {
          console.error('Failed to parse /api/verify JSON:', e);
          localStorage.removeItem('docLocker_user');
          return;
        }

        if (result?.success && result.data?.user) {
          setUser(result.data.user);
          localStorage.setItem('docLocker_user', JSON.stringify(result.data.user));
        } else {
          localStorage.removeItem('docLocker_user');
        }
      } catch (error) {
        console.error('Session verification failed:', error);
        localStorage.removeItem('docLocker_user');
      } finally {
        setLoading(false);
      }
    };

    verifySession();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for session
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        // Try to extract JSON error, else generic
        let msg = 'Login failed';
        try {
          const err = await response.json();
          msg = err?.message || msg;
        } catch {}
        throw new Error(msg);
      }

      let result: any = null;
      try {
        result = await response.json();
      } catch (e) {
        throw new Error('Login response was not valid JSON. Is the backend running?');
      }

      if (result.success && result.data) {
        // Store user data (session is handled by cookies)
        const userData: User = {
          id: result.data.user.id,
          name: result.data.user.name,
          email: result.data.user.email,
          role: result.data.user.role,
        };
        
        setUser(userData);
        localStorage.setItem('docLocker_user', JSON.stringify(userData));
        return true;
      } else {
        throw new Error(result.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const signup = async (name: string, email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for session
        body: JSON.stringify({ name, email, password }),
      });

      if (!response.ok) {
        let msg = 'Signup failed';
        try {
          const err = await response.json();
          msg = err?.message || msg;
        } catch {}
        throw new Error(msg);
      }

      let result: any = null;
      try {
        result = await response.json();
      } catch (e) {
        throw new Error('Signup response was not valid JSON. Is the backend running?');
      }

      if (result.success && result.data) {
        // Store user data (session is handled by cookies)
        const userData: User = {
          id: result.data.user.id,
          name: result.data.user.name,
          email: result.data.user.email,
          role: result.data.user.role,
        };
        
        setUser(userData);
        localStorage.setItem('docLocker_user', JSON.stringify(userData));
        return true;
      } else {
        throw new Error(result.message || 'Signup failed');
      }
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include', // Include cookies for session
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('docLocker_user');
    }
  };

  // Show nothing while verifying session
  if (loading) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
