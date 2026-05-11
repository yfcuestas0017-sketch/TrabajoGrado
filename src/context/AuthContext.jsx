import { createContext, useContext, useEffect, useState } from 'react';
import {
  hasSupabaseConfig,
  hasSupabaseConfigAttempt,
  supabaseConfigError,
} from '../lib/supabase/config';
import { getSupabaseClient } from '../lib/supabase/client';
import { signInWithUsersTable } from '../lib/supabase/usersAuth';
import { registerStudent } from '../lib/supabase/registerUser';

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

  return {
    id: storedUser.id ?? null,   // UUID (Supabase Auth) o null en modo local
    name: storedUser.name || formatNameFromEmail(email),
    email,
    role: storedUser.role || 'usuario',
    faculty: storedUser.faculty ?? null,
    programId: storedUser.programId ?? null,
    avatar: storedUser.avatar ?? null,
    authMode: storedUser.authMode || 'local',
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const restoreSession = () => {
      if (hasSupabaseConfigAttempt && !hasSupabaseConfig) {
        if (mounted) {
          setUser(null);
          setLoading(false);
        }

        return;
      }

      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);

        if (!stored) {
          if (mounted) {
            setUser(null);
          }

          return;
        }

        const restoredUser = normalizeUser(JSON.parse(stored));

        if (restoredUser) {
          if (mounted) {
            setUser(restoredUser);
          }

          return;
        }

        localStorage.removeItem(LOCAL_STORAGE_KEY);
      } catch {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      } finally {
        if (mounted) {
          setLoading(false);
        }
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
      throw new Error('Ingresa correo y contrasena.');
    }

    if (hasSupabaseConfigAttempt && !hasSupabaseConfig) {
      throw new Error(supabaseConfigError);
    }

    if (hasSupabaseConfig) {
      const databaseUser = normalizeUser(
        await signInWithUsersTable(normalizedEmail, normalizedPassword),
      );

      setUser(databaseUser);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(databaseUser));
      return databaseUser;
    }

    await new Promise((resolve) => setTimeout(resolve, 400));

    const safeUser = normalizeUser({
      email: normalizedEmail,
      name: formatNameFromEmail(normalizedEmail),
      role: 'usuario',
      authMode: 'local',
    });

    setUser(safeUser);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(safeUser));
    return safeUser;
  };

  const register = async (fields) => {
    if (hasSupabaseConfigAttempt && !hasSupabaseConfig) {
      throw new Error(supabaseConfigError);
    }

    if (!hasSupabaseConfig) {
      throw new Error(
        'Para registrarse se necesita la conexión con Supabase. Completa .env.local.',
      );
    }

    const newUser = normalizeUser(await registerStudent(fields));
    setUser(newUser);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newUser));
    return newUser;
  };

  const logout = async () => {
    // Cerrar sesión en Supabase Auth (invalida el JWT)
    if (hasSupabaseConfig) {
      try { await getSupabaseClient().auth.signOut(); } catch (_) { /* ignorar */ }
    }
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
        authProvider: hasSupabaseConfig ? 'supabase-users-table' : 'local',
        isSupabaseEnabled: hasSupabaseConfig,
        configurationIssue:
          hasSupabaseConfigAttempt && !hasSupabaseConfig ? supabaseConfigError : '',
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
