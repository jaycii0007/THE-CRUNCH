import { Routes, Route } from "react-router-dom"
import AdminDashboard from "./pages/index"
import Order from "./pages/Order"
import Inventory from "./pages/inventory"
import Login from "./pages/login"
import Menu from "./pages/menu"
import Products from "./pages/products"
import StaffAccounts from "./pages/staffaccounts"
import AboutTheCrunch from "./pages/aboutthecrunch"
import MenuPage from "./pages/usersmenu"
import SalesReports from "./pages/sales-reports"


export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AboutTheCrunch/>} />
      <Route path="/login" element={<Login/>} />
      <Route path="/dashboard" element={<AdminDashboard />} />
      <Route path="/orders" element={<Order />} />
      <Route path="/inventory" element={<Inventory/>} />
      <Route path="/menu" element={<Menu/>} />
      <Route path="/products" element={<Products/>} />
      <Route path="/users" element={<StaffAccounts/>} />
      <Route path="/aboutthecrunch" element={<AboutTheCrunch/>} />
      <Route path="/usersmenu" element={<MenuPage/>} />
      <Route path="/sales-reports" element={<SalesReports/>} />
      
    </Routes>
  )
}