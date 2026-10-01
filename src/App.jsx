import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from './layouts/AppLayout.jsx'
import LandingLayout from './layouts/LandingLayout.jsx'
import { LoadingBar, ToastProvider, ErrorBoundary } from '@/components/ui'

/* Lazy-load each page. The engine and charts only load when needed. */
const Landing    = lazy(() => import('./pages/Landing.jsx'))
const Portfolio  = lazy(() => import('./pages/Portfolio.jsx'))
const Plant      = lazy(() => import('./pages/Plant.jsx'))
const Diagnosis  = lazy(() => import('./pages/Diagnosis.jsx'))
const WorkOrders = lazy(() => import('./pages/WorkOrders.jsx'))
const Lab        = lazy(() => import('./pages/Lab.jsx'))
const DataHealth = lazy(() => import('./pages/DataHealth.jsx'))
const Model      = lazy(() => import('./pages/Model.jsx'))
const Ingest     = lazy(() => import('./pages/Ingest.jsx'))
const Settings   = lazy(() => import('./pages/Settings.jsx'))
const KitPage    = lazy(() => import('./pages/KitPage.jsx'))
const NotFound   = lazy(() => import('./pages/NotFound.jsx'))

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <ErrorBoundary>
          <Suspense fallback={<LoadingBar />}>
            <Routes>
              {/* Landing — full-bleed GSAP/Lenis page */}
              <Route element={<LandingLayout />}>
                <Route path="/" element={<Landing />} />
              </Route>

              {/* App shell — sidebar + topbar */}
              <Route path="/app" element={<AppLayout />}>
                <Route index element={<Portfolio />} />
                <Route path="plant/:plantId" element={<Plant />} />
                <Route path="diagnosis/:diagId" element={<Diagnosis />} />
                <Route path="work-orders" element={<WorkOrders />} />
                <Route path="lab" element={<Lab />} />
                <Route path="data-health" element={<DataHealth />} />
                <Route path="model" element={<Model />} />
                <Route path="ingest" element={<Ingest />} />
                <Route path="settings" element={<Settings />} />
                {/* Hidden dev page — component library review */}
                <Route path="_kit" element={<KitPage />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </ToastProvider>
  )
}
