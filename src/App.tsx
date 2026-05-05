import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAppStore } from './store'
import { Toaster } from '@/components/ui/sonner'
import Login from './pages/Login'
import StaffLayout from './pages/staff/StaffLayout'
import Dashboard from './pages/staff/Dashboard'
import ActionCenter from './pages/staff/ActionCenter'
import OneBAC from './pages/staff/OneBAC'
import PNP from './pages/staff/PNP'
import Report from './pages/staff/Report'
import Users from './pages/staff/Users'
import Settings from './pages/staff/Settings'

function App() {
  const { isAuthenticated } = useAppStore()

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={!isAuthenticated ? <Login /> : <Navigate to="/staff/dashboard" replace />}
        />
        
        <Route
          path="/staff"
          element={isAuthenticated ? <StaffLayout /> : <Navigate to="/login" replace />}
        >
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="action-center" element={<ActionCenter />} />
          <Route path="1bac" element={<OneBAC />} />
          <Route path="pnp" element={<PNP />} />
          <Route path="report" element={<Report />} />
          <Route path="users" element={<Users />} />
          <Route path="settings" element={<Settings />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>

        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? "/staff/dashboard" : "/login"} replace />}
        />
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}

export default App
