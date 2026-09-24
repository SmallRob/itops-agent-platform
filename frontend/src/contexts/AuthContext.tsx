import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../lib/api';

interface User {
  id: string;
  username: string;
  role: string;
  email: string;
  passwordMustChange?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User, refreshToken?: string) => void;
  logout: () => void;
  updateUser: (updatedUser: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * 校验本地 token 是否有效
 *  - 'valid'   ：服务端确认有效
 *  - 'invalid' ：服务端明确判定无授权（401），应清理本地会话
 *  - 'unknown' ：网络中断、网关 5xx 等非鉴权失败，不得据此登出（否则一次抖动就把用户踢回登录页）
 */
type TokenCheck = 'valid' | 'invalid' | 'unknown';

const verifyToken = async (): Promise<TokenCheck> => {
  try {
    const response = await api.get('/api/auth/me');
    return response.status === 200 ? 'valid' : 'invalid';
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    return status === 401 ? 'invalid' : 'unknown';
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const savedToken = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');

      if (savedToken && savedUser) {
        const result = await verifyToken();
        if (result === 'invalid') {
          // 服务端明确否定：清除本地存储并回到登录页
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        } else {
          // 'valid' 直接恢复；'unknown' 保留本地会话（后续请求失败会再走刷新/重试）
          try {
            setUser(JSON.parse(savedUser));
            setToken(savedToken);
          } catch {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = (newToken: string, newUser: User, newRefreshToken?: string) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    if (newRefreshToken) {
      localStorage.setItem('refreshToken', newRefreshToken);
    }
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('refreshToken');
    setToken(null);
    setUser(null);
  };

  const updateUser = (updatedUser: Partial<User>) => {
    if (user) {
      const newUser = { ...user, ...updatedUser };
      localStorage.setItem('user', JSON.stringify(newUser));
      setUser(newUser);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
