import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import LabAssets from './pages/LabAssets'
import LabAssetDetail from './pages/LabAssetDetail'
import LabAssetNew from './pages/LabAssetNew'
import ScanStart from './pages/ScanStart'
import Orders from './pages/Orders'
import Purchases from './pages/Purchases'
import Quotations from './pages/Quotations'
import Directory from './pages/Directory'
import Settings from './pages/Settings'
import { AppShellLayout } from './components/layout/AppShellLayout'
import { AuthGuard } from './components/auth/AuthGuard'
import { OrgGate } from './components/auth/OrgGate'

export function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />

      {/* Protected — AuthGuard proves *who*, OrgGate proves *which tenant*.
          Nothing organization-scoped renders until both are resolved. */}
      <Route
        element={
          <AuthGuard>
            <OrgGate>
              <AppShellLayout />
            </OrgGate>
          </AuthGuard>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Lab Assets — React Router 6 picks the static /new over /:assetId by specificity. */}
        <Route path="/lab-assets" element={<LabAssets />} />
        <Route path="/lab-assets/new" element={<LabAssetNew />} />
        <Route path="/lab-assets/:assetId" element={<LabAssetDetail />} />

        <Route path="/scan/start" element={<ScanStart />} />

        <Route path="/products" element={<Products />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/purchases" element={<Purchases />} />
        <Route path="/quotations" element={<Quotations />} />
        <Route path="/directory" element={<Directory />} />
        <Route path="/settings" element={<Settings />} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
