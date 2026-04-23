import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import StaffDashboard from './pages/StaffDashboard';
import StudentDashboard from './pages/StudentDashboard';
import StudentProfile from './pages/StudentProfile';
import { getDashboardPathForRole, getStoredUser } from './utils/auth';

function ProtectedRoute({ allowedRoles, children }) {
  const currentUser = getStoredUser();

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  if (!allowedRoles.includes(currentUser.role)) {
    return <Navigate to={getDashboardPathForRole(currentUser.role)} replace />;
  }

  return children;
}

export default function App() {
  const currentUser = getStoredUser();

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            currentUser ? (
              <Navigate to={getDashboardPathForRole(currentUser.role)} replace />
            ) : (
              <Login />
            )
          }
        />
        
        <Route
          path="/staff-dashboard"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <StaffDashboard />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/student-dashboard"
          element={
            <ProtectedRoute allowedRoles={['user']}>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student-profile"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <StudentProfile />
            </ProtectedRoute>
          }
        />
        
      </Routes>
    </BrowserRouter>
  );
}