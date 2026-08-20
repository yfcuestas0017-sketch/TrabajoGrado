import { createContext, useContext, useEffect, useState } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);
const LOCAL_STORAGE_KEY = 'gradohub_user';

function formatNameFromEmail(email) {
  const localPart = email.split('@')[0] || '';
  const cleaned = localPart.replace(/[._-]+/g, ' ').trim();

  if (!cleaned) return 'Usuario';

  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeUser(storedUser) {
  if (!storedUser || typeof storedUser !== 'object') return null;

  const email = typeof storedUser.email === 'string'
    ? storedUser.email.trim().toLowerCase()
    : '';

  if (!email) return null;

  let rawRole = storedUser.role || storedUser.role_name || 'usuario';
  if (typeof rawRole === 'object' && rawRole !== null) {
    rawRole = rawRole.name || rawRole.role_name || 'usuario';
  }
  const roleString = String(rawRole).toLowerCase();

  return {
    id: storedUser.id ? String(storedUser.id) : (storedUser.user_id ? String(storedUser.user_id) : null),
    name: storedUser.name || storedUser.full_name || formatNameFromEmail(email),
    email,
    role: roleString,
    faculty: storedUser.faculty ?? null,
    programId: storedUser.programId ?? storedUser.program_id ?? null,
    programName: storedUser.programName ?? storedUser.program_name ?? null,
    roleId: storedUser.roleId ?? storedUser.role_id ?? null,
    permissions: Array.isArray(storedUser.permissions) ? storedUser.permissions : [],
    avatar: storedUser.avatar ?? null,
    authMode: storedUser.authMode || 'postgres',
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const restoreSession = () => {
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);

        if (!stored) {
          if (mounted) setUser(null);
          return;
        }

        const restoredUser = normalizeUser(JSON.parse(stored));
        if (restoredUser && mounted) {
          setUser(restoredUser);
          return;
        }

        localStorage.removeItem(LOCAL_STORAGE_KEY);
      } catch {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    restoreSession();

    return () => {
      mounted = false;
    };
  }, []);

  const login = async (email, password) => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();

    if (!normalizedEmail || !normalizedPassword) {
      throw new Error('Ingresa correo y contraseña.');
    }

    const response = await api.login(normalizedEmail, normalizedPassword);
    const databaseUser = normalizeUser(response.user);

    setUser(databaseUser);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(databaseUser));
    return databaseUser;
  };

  const register = async (fields) => {
    const response = await api.register(fields);
    const newUser = normalizeUser(response.user);
    setUser(newUser);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newUser));
    return newUser;
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  };

  const updateUser = (updates) => {
    if (!user) return;
    const updatedUser = normalizeUser({ ...user, ...updates });
    if (!updatedUser) return;

    setUser(updatedUser);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        updateUser,
        authProvider: 'postgres-base-datos-grado',
        isSupabaseEnabled: false,
        configurationIssue: '',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
