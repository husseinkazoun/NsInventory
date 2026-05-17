import { Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import LabAssets from './pages/LabAssets'
import Orders from './pages/Orders'
import Purchases from './pages/Purchases'
import Quotations from './pages/Quotations'
import Directory from './pages/Directory'
import Settings from './pages/Settings'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/lab-assets" element={<LabAssets />} />
      <Route path="/products" element={<Products />} />
      <Route path="/orders" element={<Orders />} />
      <Route path="/purchases" element={<Purchases />} />
      <Route path="/quotations" element={<Quotations />} />
      <Route path="/directory" element={<Directory />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
