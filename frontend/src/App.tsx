import {
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

import {
  useAuth,
} from './auth/useAuth'

import {
  AppShell,
} from './layout/AppShell'

import {
  LoginPage,
} from './pages/LoginPage'

import {
  OverviewPage,
} from './pages/OverviewPage'

import {
  CatalogPage,
} from './pages/CatalogPage'

import {
  ConnectorWizardPage,
} from './pages/ConnectorWizardPage'

import {
  ConfiguredConnectorsPage,
} from './pages/ConfiguredConnectorsPage'

import {
  UsersPage,
} from './pages/UsersPage'

import {
  DevicesPage,
} from './pages/DevicesPage'

import {
  EventsPage,
} from './pages/EventsPage'

import {
  LiveRunsPage,
} from './pages/LiveRunsPage'

import {
  RunHistoryPage,
} from './pages/RunHistoryPage'

import {
  QuarantinePage,
} from './pages/QuarantinePage'

import {
  RiskAnalysisPage,
} from './pages/RiskAnalysisPage'

import {
  SelfHealingPage,
} from './pages/SelfHealingPage'

import {
  SecretsPage,
} from './pages/SecretsPage'

import {
  FailureSimulationPage,
} from './pages/FailureSimulationPage'

import {
  DemoPage,
} from './pages/DemoPage'


export default function App() {
  const {
    user,
    loading,
  } = useAuth()


  if (loading) {
    return (
      <div
        className="
          flex
          min-h-screen
          items-center
          justify-center
          bg-[#080b12]
          text-sm
          text-slate-500
          font-mono
        "
      >
        Restoring CyberForge session...
      </div>
    )
  }


  return (
    <Routes>
      <Route
        path="/login"
        element={
          user
            ? (
              <Navigate
                to="/"
                replace
              />
            )
            : <LoginPage />
        }
      />

      <Route
        element={
          user
            ? <AppShell />
            : (
              <Navigate
                to="/login"
                replace
              />
            )
        }
      >
        <Route
          index
          element={
            <OverviewPage />
          }
        />

        <Route
          path="integrations/catalog"
          element={
            <CatalogPage />
          }
        />

        <Route
          path="integrations/wizard"
          element={
            <ConnectorWizardPage />
          }
        />

        <Route
          path="integrations/connectors"
          element={
            <ConfiguredConnectorsPage />
          }
        />

        <Route
          path="data/users"
          element={
            <UsersPage />
          }
        />

        <Route
          path="data/devices"
          element={
            <DevicesPage />
          }
        />

        <Route
          path="data/events"
          element={
            <EventsPage />
          }
        />

        <Route
          path="operations/live"
          element={
            <LiveRunsPage />
          }
        />

        <Route
          path="operations/history"
          element={
            <RunHistoryPage />
          }
        />

        <Route
          path="operations/quarantine"
          element={
            <QuarantinePage />
          }
        />

        <Route
          path="intelligence/risk"
          element={
            <RiskAnalysisPage />
          }
        />

        <Route
          path="intelligence/self-heal"
          element={
            <SelfHealingPage />
          }
        />

        <Route
          path="security/secrets"
          element={
            <SecretsPage />
          }
        />

        <Route
          path="demo"
          element={
            <DemoPage />
          }
        />

        <Route
          path="operations/failure-simulation"
          element={
            <FailureSimulationPage />
          }
        />
      </Route>

      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />
    </Routes>
  )
}
