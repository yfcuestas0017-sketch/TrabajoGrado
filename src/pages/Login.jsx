import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, GraduationCap, UserPlus, LogIn, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import { fetchPrograms, fetchSemesters, fetchActiveCurricula } from '../lib/supabase/registerUser';

/* ─── mode toggle ─────────────────────────────────────────── */
const MODES = { login: 'login', register: 'register' };

/* ─── datos de respaldo ───────────────────────────────────── */
const FALLBACK_PROGRAMS = [
  { program_id: 1, name: 'Ingeniería de Sistemas' },
  { program_id: 2, name: 'Psicología' },
];

const FALLBACK_SEMESTERS = [
  { semester_id: 8, semester_number: 8 },
  { semester_id: 9, semester_number: 9 },
  { semester_id: 10, semester_number: 10 },
];

export default function Login() {
  const { user, login, register, isSupabaseEnabled, configurationIssue } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState(MODES.login);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  /* ─── login form ──────────────────────────────────────────── */
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });

  /* ─── register form ───────────────────────────────────────── */
  const [regForm, setRegForm] = useState({
    fullName: '',
    email: '',
    password: '',
  });

  if (user) return <Navigate to="/dashboard" replace />;

  /* ─── handlers ────────────────────────────────────────────── */
  const switchMode = (m) => { setMode(m); setError(''); setSuccess(''); };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(loginForm.email, loginForm.password);
      navigate('/dashboard');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await register({
        fullName: regForm.fullName,
        email: regForm.email,
        password: regForm.password,
      });
      navigate('/dashboard');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const setReg = (key) => (e) => setRegForm((p) => ({ ...p, [key]: e.target.value }));
  const setLog = (key) => (e) => setLoginForm((p) => ({ ...p, [key]: e.target.value }));

  /* ─── render ──────────────────────────────────────────────── */
  return (
    <>
      <div className="login-page">
        {/* LEFT PANEL */}
        <div className="login-left">
          <div className="login-left-content">
            <div className="login-logo-container">
              <img src="/Escudos.png" alt="Logo UCESMAG" className="login-logo-img" />
            </div>
            <h1 className="login-headline">Gestión de Proyectos de Grado</h1>
            <p className="login-tagline">
              Centraliza, comparte y consulta los trabajos de grado de todas las facultades.
            </p>
            <div className="login-note">
              <span className="login-note-pill">UCESMAG</span>
              <p className="login-note-text">
                La información se conecta directamente con Supabase y la base de datos institucional.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="login-right">
          <div className="login-form-wrap">

            {/* TAB SWITCHER */}
            <div className="auth-tabs">
              <button
                type="button"
                className={`auth-tab ${mode === MODES.login ? 'auth-tab--active' : ''}`}
                onClick={() => switchMode(MODES.login)}
              >
                <LogIn size={15} />
                Iniciar sesión
              </button>
              <button
                type="button"
                className={`auth-tab ${mode === MODES.register ? 'auth-tab--active' : ''}`}
                onClick={() => switchMode(MODES.register)}
              >
                <UserPlus size={15} />
                Registrarse
              </button>
              <div className={`auth-tab-indicator ${mode === MODES.register ? 'auth-tab-indicator--right' : ''}`} />
            </div>

            {/* HEADER */}
            <div className="login-form-header">
              <h2 className="login-form-title">
                {mode === MODES.login ? 'Bienvenido de nuevo' : 'Crear cuenta'}
              </h2>
              <p className="login-form-sub">
                {mode === MODES.login
                  ? 'Accede con tus credenciales institucionales.'
                  : 'Completa los datos para registrarte como estudiante.'}
              </p>
            </div>

            {/* ALERTS */}
            {configurationIssue && (
              <div className="login-warning">
                <AlertCircle size={16} />
                <span>{configurationIssue}</span>
              </div>
            )}
            {error && (
              <div className="login-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="login-success">
                <span>{success}</span>
              </div>
            )}

            {/* ── LOGIN FORM ── */}
            {mode === MODES.login && (
              <form onSubmit={handleLogin} className="login-form">
                <div className="field">
                  <label className="field-label">Correo institucional *</label>
                  <input
                    type="email" required autoFocus
                    value={loginForm.email}
                    onChange={setLog('email')}
                    placeholder="usuario@universidad.edu.co"
                    className="field-input"
                  />
                </div>
                <div className="field">
                  <label className="field-label">Contraseña *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPass ? 'text' : 'password'} required
                      value={loginForm.password}
                      onChange={setLog('password')}
                      placeholder="••••••••"
                      className="field-input"
                      style={{ paddingRight: '44px' }}
                    />
                    <button type="button" className="pass-toggle" onClick={() => setShowPass((p) => !p)}>
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <Button type="submit" loading={loading} fullWidth size="lg">
                  {loading ? 'Ingresando...' : 'Ingresar'}
                </Button>
                <p className="login-switch-hint">
                  ¿No tienes cuenta?{' '}
                  <button type="button" className="link-btn" onClick={() => switchMode(MODES.register)}>
                    Regístrate aquí
                  </button>
                </p>
              </form>
            )}

            {/* ── REGISTER FORM ── */}
            {mode === MODES.register && (
              <form onSubmit={handleRegister} className="login-form">

                {/* 1. Nombre completo */}
                <div className="field">
                  <label className="field-label">Nombre completo *</label>
                  <input
                    type="text" required autoFocus
                    value={regForm.fullName}
                    onChange={setReg('fullName')}
                    placeholder="Ej: María Pérez González"
                    className="field-input"
                    minLength={3}
                  />
                </div>

                {/* 2. Correo electrónico */}
                <div className="field">
                  <label className="field-label">Correo electrónico *</label>
                  <input
                    type="email" required
                    value={regForm.email}
                    onChange={setReg('email')}
                    placeholder="usuario@universidad.edu.co"
                    className="field-input"
                  />
                </div>

                {/* 3. Contraseña */}
                <div className="field">
                  <label className="field-label">Contraseña *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPass ? 'text' : 'password'} required
                      value={regForm.password}
                      onChange={setReg('password')}
                      placeholder="Mínimo 8 caracteres"
                      className="field-input"
                      style={{ paddingRight: '44px' }}
                      minLength={8}
                    />
                    <button type="button" className="pass-toggle" onClick={() => setShowPass((p) => !p)}>
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>



                {/* Nota: rol asignado automáticamente */}
                <div className="reg-role-note">
                  <span className="reg-role-pill">Rol: Estudiante</span>
                  <span>asignado automáticamente al crear tu cuenta.</span>
                </div>

                <Button type="submit" loading={loading} fullWidth size="lg">
                  {loading ? 'Creando cuenta...' : 'Crear cuenta'}
                </Button>

                <p className="login-switch-hint">
                  ¿Ya tienes cuenta?{' '}
                  <button type="button" className="link-btn" onClick={() => switchMode(MODES.login)}>
                    Inicia sesión
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>

      <style>{`
        /* ── PAGE LAYOUT ─────────────────────────────────────── */
        .login-page {
          display: flex;
          height: 100dvh;
          overflow: hidden;
        }

        /* ── LEFT ────────────────────────────────────────────── */
        .login-left {
          flex: 1;
          background-image:
            linear-gradient(180deg, rgba(8,12,18,0.2) 0%, rgba(8,12,18,0.68) 100%),
            url('/login/SedeCentroUCESMAG.webp');
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 60px;
          position: relative;
          overflow: hidden;
        }
        .login-left::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg,rgba(0,0,0,0.18) 0%,rgba(0,0,0,0.08) 42%,rgba(0,0,0,0.56) 100%);
          pointer-events: none;
        }
        .login-left::after {
          content: '';
          position: absolute;
          inset: auto 0 0 0;
          height: 160px;
          background: linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(0,0,0,0.5) 100%);
          pointer-events: none;
        }
        .login-left-content {
          position: relative;
          z-index: 1;
          max-width: 420px;
        }
        .login-logo-container {
          display: flex;
          justify-content: center;
          margin-bottom: 32px;
        }
        .login-logo-img {
          width: 160px;
          height: auto;
          object-fit: contain;
          filter: drop-shadow(0 4px 12px rgba(0,0,0,0.15));
        }
        .login-headline {
          font-family: var(--font-display);
          font-size: 2.3rem; font-weight: 700;
          color: #fff; line-height: 1.15;
          letter-spacing: -0.03em; margin-bottom: 16px;
        }
        .login-tagline {
          font-size: 0.98rem; color: var(--sidebar-text);
          line-height: 1.75; margin-bottom: 26px;
        }
        .login-note {
          padding: 18px 20px;
          border: 1px solid rgba(255,255,255,0.16);
          border-radius: var(--border-radius-lg);
          background: rgba(15,17,23,0.36);
          backdrop-filter: blur(10px);
          box-shadow: 0 18px 40px rgba(0,0,0,0.18);
        }
        .login-note-pill {
          display: inline-flex; align-items: center;
          padding: 4px 10px; border-radius: 999px;
          background: color-mix(in srgb, var(--sidebar-accent) 16%, transparent);
          color: var(--sidebar-accent);
          font-size: 0.72rem; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.08em;
        }
        .login-note-text {
          margin-top: 12px; color: var(--sidebar-text);
          line-height: 1.75; font-size: 0.9rem;
        }

        /* ── RIGHT ───────────────────────────────────────────── */
        .login-right {
          width: min(100%, 520px);
          height: 100%;
          display: flex; align-items: center; justify-content: center;
          padding: 48px 48px;
          background: var(--bg-primary);
          overflow-y: auto;
        }
        .login-form-wrap {
          width: 100%;
          animation: fadeIn 0.4s ease;
        }

        /* ── TABS ────────────────────────────────────────────── */
        .auth-tabs {
          display: flex;
          position: relative;
          background: var(--bg-secondary);
          border: 1.5px solid var(--border-color);
          border-radius: var(--border-radius-md);
          padding: 4px;
          margin-bottom: 28px;
          gap: 2px;
        }
        .auth-tab {
          flex: 1; display: flex; align-items: center; justify-content: center;
          gap: 7px;
          padding: 9px 14px;
          border: none; background: transparent;
          font-family: var(--font-body);
          font-size: 0.84rem; font-weight: 600;
          color: var(--text-muted);
          cursor: pointer; border-radius: 9px;
          position: relative; z-index: 1;
          transition: color 0.2s ease;
        }
        .auth-tab--active { color: var(--text-primary); font-weight: 600; }
        .auth-tab-indicator {
          position: absolute;
          inset: 4px 50% 4px 4px;
          background: var(--bg-card);
          border-radius: 9px;
          box-shadow: var(--shadow-sm);
          transition: inset 0.25s cubic-bezier(0.4,0,0.2,1);
        }
        .auth-tab-indicator--right {
          inset: 4px 4px 4px 50%;
        }

        /* ── FORM HEADER ─────────────────────────────────────── */
        .login-form-header { margin-bottom: 20px; }
        .login-form-title {
          font-family: var(--font-display);
          font-size: 1.65rem; font-weight: 700;
          color: var(--text-primary); letter-spacing: -0.03em;
        }
        .login-form-sub {
          font-size: 0.86rem; color: var(--text-muted);
          margin-top: 6px;
        }

        /* ── ALERTS ──────────────────────────────────────────── */
        .login-warning, .login-error, .login-success {
          display: flex; align-items: center; gap: 8px;
          border-radius: var(--border-radius-sm);
          padding: 10px 14px;
          font-size: 0.85rem; line-height: 1.6;
          margin-bottom: 16px;
        }
        .login-warning {
          background: color-mix(in srgb, var(--accent-primary) 10%, transparent);
          border: 1px solid color-mix(in srgb, var(--accent-primary) 24%, transparent);
          color: var(--text-primary);
        }
        .login-error {
          background: color-mix(in srgb, var(--accent-danger) 10%, transparent);
          border: 1px solid color-mix(in srgb, var(--accent-danger) 25%, transparent);
          color: var(--accent-danger);
        }
        .login-success {
          background: color-mix(in srgb, var(--accent-success) 10%, transparent);
          border: 1px solid color-mix(in srgb, var(--accent-success) 25%, transparent);
          color: var(--accent-success);
        }

        /* ── FORM ────────────────────────────────────────────── */
        .login-form { display: flex; flex-direction: column; gap: 16px; }

        .field { display: flex; flex-direction: column; gap: 5px; }
        .field-label {
          font-size: 0.78rem; font-weight: 700;
          color: var(--text-primary); letter-spacing: -0.01em;
        }
        .field-input {
          width: 100%; padding: 11px 14px;
          border: 1.5px solid var(--border-color);
          border-radius: var(--border-radius-sm);
          background: var(--bg-secondary);
          font-size: 0.9rem; font-family: var(--font-body);
          color: var(--text-primary);
          transition: all var(--transition-fast); outline: none;
        }
        .field-input:focus {
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-primary) 15%, transparent);
        }
        .field-input::placeholder { color: var(--text-muted); }
        .field-hint {
          font-size: 0.76rem; color: var(--text-muted); margin-top: 3px;
        }

        /* SELECT */
        .select-wrap { position: relative; }
        .field-select { appearance: none; padding-right: 36px; cursor: pointer; }
        .field-select:disabled { opacity: 0.6; cursor: not-allowed; }
        .select-chevron {
          position: absolute; right: 12px; top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted); pointer-events: none;
        }

        /* PASSWORD TOGGLE */
        .pass-toggle {
          position: absolute; right: 12px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          color: var(--text-muted); cursor: pointer;
          padding: 4px; display: flex; align-items: center;
        }
        .pass-toggle:hover { color: var(--text-primary); }

        /* ROLE NOTE */
        .reg-role-note {
          display: flex; align-items: center; gap: 8px;
          font-size: 0.8rem; color: var(--text-muted);
        }
        .reg-role-pill {
          padding: 3px 9px; border-radius: 999px;
          background: color-mix(in srgb, var(--accent-primary) 14%, transparent);
          color: var(--accent-primary);
          font-size: 0.72rem; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.06em;
        }

        /* SWITCH HINT */
        .login-switch-hint {
          text-align: center; font-size: 0.85rem; color: var(--text-muted);
          margin-top: 4px;
        }
        .link-btn {
          background: none; border: none; padding: 0;
          font-family: var(--font-body); font-size: inherit;
          color: var(--accent-primary); font-weight: 600;
          cursor: pointer; text-decoration: underline;
          text-underline-offset: 2px;
        }
        .link-btn:hover { color: var(--accent-primary-hover); }

        /* ── RESPONSIVE ──────────────────────────────────────── */
        @media (max-width: 900px) {
          .login-page { flex-direction: column; }
          .login-left { min-height: 300px; padding: 32px 24px; align-items: flex-end; }
          .login-right { width: 100%; padding: 36px 28px; }
          .login-left-content { max-width: 100%; }
          .login-headline { font-size: 1.95rem; }
        }
        @media (max-width: 768px) {
          .login-left { min-height: 260px; padding: 28px 20px; }
          .login-right { padding: 30px 22px; }
          .login-headline { font-size: 1.75rem; }
          .login-tagline { font-size: 0.92rem; margin-bottom: 18px; }
          .login-note { padding: 16px 18px; }
        }
        @media (max-width: 520px) {
          .login-left { min-height: 210px; padding: 18px 14px; }
          .login-logo-container { margin-bottom: 20px; }
          .login-logo-img { width: 130px; }
          .login-headline { font-size: 1.4rem; margin-bottom: 10px; }
          .login-tagline { font-size: 0.86rem; margin-bottom: 14px; }
          .login-right { padding: 22px 14px; }
          .login-form-title { font-size: 1.25rem; }
          .login-form-sub { font-size: 0.8rem; }
          .auth-tabs { margin-bottom: 20px; }
          .auth-tab { font-size: 0.72rem; padding: 8px 10px; }
          .login-note-text { font-size: 0.85rem; }
          .login-switch-hint { font-size: 0.8rem; }
        }

        @media (max-width: 380px) {
          .login-left { min-height: 180px; padding: 14px 10px; }
          .login-logo-container { margin-bottom: 14px; }
          .login-logo-img { width: 110px; }
          .login-headline { font-size: 1.25rem; }
          .login-tagline { font-size: 0.8rem; }
          .login-right { padding: 18px 10px; }
          .auth-tab { font-size: 0.66rem; padding: 7px 8px; }
          .field-input { padding: 9px 11px; font-size: 0.82rem; }
          .login-warning, .login-error, .login-success { padding: 9px 11px; font-size: 0.78rem; }
        }
      `}</style>
    </>
  );
}
