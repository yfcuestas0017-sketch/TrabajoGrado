import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, requiredRole, excludedRole }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--border-color)',
            borderTopColor: 'var(--accent-primary)',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }}
        />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const canBypassRoleCheck = user.authMode === 'local';

  if (requiredRole && user.role !== requiredRole && !canBypassRoleCheck) {
    return <Navigate to="/dashboard" replace />;
  }

  if (excludedRole) {
    const isExcluded = Array.isArray(excludedRole) 
      ? excludedRole.includes(user.role) 
      : user.role === excludedRole;
      
    if (isExcluded && !canBypassRoleCheck) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
}
