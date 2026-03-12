import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import HomePage from './pages/HomePage'
import ProjectPage from './pages/ProjectPage'
import LiteraturePage from './pages/LiteraturePage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/projects/:id" element={<ErrorBoundary fallbackTitle="Failed to load project"><ProjectPage /></ErrorBoundary>} />
        <Route path="/literature" element={<LiteraturePage />} />
        <Route path="/reports" element={<ErrorBoundary fallbackTitle="Failed to load reports"><ReportsPage /></ErrorBoundary>} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

export default App
