import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import ChatPage from './pages/ChatPage'
import OrdersPage from './pages/OrdersPage'
import CreateOrderPage from './pages/CreateOrderPage'
import CreateShipmentPlanPage from './pages/CreateShipmentPlanPage'
import RadarLegacyPage from './pages/RadarLegacyPage'
import ReturnOrderPage from './pages/ReturnOrderPage'
import ReturnOrderCreatePage from './pages/ReturnOrderCreatePage'
import LandingPage from './pages/LandingPage'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar />
        <main className="flex-1 flex flex-col min-h-0">
          <Routes>
            <Route path="/" element={<Navigate to="/orders" replace />} />
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/create-order" element={<CreateOrderPage />} />
            <Route path="/create-shipment-plan" element={<CreateShipmentPlanPage />} />
            <Route path="/return-order" element={<ReturnOrderPage />} />
            <Route path="/return-order/create" element={<ReturnOrderCreatePage />} />
            <Route path="/radar-legacy" element={<RadarLegacyPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
