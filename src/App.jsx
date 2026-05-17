import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './routes/ProtectedRoute';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AjustesPage from './pages/Ajustes';
import { ProyectosPage, UsuariosPage } from './pages/Proyectos';
import GestionDocente from './pages/GestionDocente';
import BancoProyectos from './pages/BancoProyectos';

import './styles/globals.css';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/proyectos" element={<ProtectedRoute><ProyectosPage /></ProtectedRoute>} />
            <Route path="/subir" element={<ProtectedRoute excludedRole={['docente', 'estudiante']}><GestionDocente /></ProtectedRoute>} />
            <Route path="/facultades" element={<ProtectedRoute><BancoProyectos /></ProtectedRoute>} />
            <Route path="/usuarios" element={<ProtectedRoute requiredRole="admin"><UsuariosPage /></ProtectedRoute>} />
            <Route path="/ajustes" element={<ProtectedRoute><AjustesPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
