import { Search, TrendingUp } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sidebar } from "@/components/Sidebar"
import { OrdersTable } from "@/components/orders-table"
import { SalesChart } from "@/components/sales-chart"
import { useState, useEffect } from "react"
import { api } from "@/lib/api" // used for backend fetches

interface Order {
  id: number
  orderNumber: string
  items: { name: string; price: number; quantity: number }[]
  total: number
  date: string
  time: string
  orderType: string
  status: string
  paymentCategory: string
}

interface Payment {
  id: number
  category: string
  date: string
  time: string
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [paymentData, setPaymentData] = useState<Payment[]>([])

  // ✅ Load data from localStorage on mount and listen for updates
  useEffect(() => {
  const fetchFromDB = async () => {
    try {
      const rows = await api.get<any[]>('/orders')
      if (!rows || !rows.length) {
        setOrders([])
        return
      }
      const grouped: Record<number, any> = {}
      rows.forEach(r => {
        if (!grouped[r.id]) {
          grouped[r.id] = {
            id: r.id,
            orderNumber: `#${r.id}`,
            items: [],
            total: Number(r.total) || 0,
            date: r.date ? new Date(r.date).toLocaleDateString() : '',
            time: r.date ? new Date(r.date).toLocaleTimeString() : '',
            orderType: r.orderType || r.order_type || '',
            status: r.status || '',
            paymentCategory: r.paymentMethod || r.payment_method || ''
          }
        }
        if (r.productId) {
          grouped[r.id].items.push({ 
            name: r.productName || '', 
            price: r.price || 0, 
            quantity: r.quantity 
          })
        }
      })
      setOrders(Object.values(grouped))
    } catch (err) {
      console.error('Failed to fetch orders:', err)
    }
  }

  fetchFromDB() // fetch immediately on mount

  // ✅ Poll DB every 5 seconds — no more localStorage
  const interval = setInterval(fetchFromDB, 5000)
  return () => clearInterval(interval)
}, [])

  // Compute stats from real orders
  const totalOrders = orders.length
  const totalSales = orders.reduce((sum, o) => sum + o.total, 0)
  const activeOrders = orders.filter(o => !["Completed", "Cancelled"].includes(o.status)).length

  return (
    <div className="flex min-h-screen bg-gray-50 font-['Poppins',sans-serif]">
      <Sidebar />
      <main className="flex-1 p-8 pl-24">
        <div className="bg-[#FDFAF6] rounded-3xl p-8 min-h-[calc(100vh-5rem)]">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <img
                src="src/assets/img/logo.jpg"
                alt="The Crunch Logo"
                className="w-12 h-12 rounded-full"
              />
              <span className="text-2xl font-semibold text-[#4A1C1C]">The Crunch</span>
            </div>

            <div className="flex-1 max-w-2xl mx-8">
              <div className="relative">
                <Input
                  type="search"
                  placeholder="Search..."
                  className="w-full bg-white border-2 border-gray-200 text-gray-800 placeholder:text-gray-400 rounded-full pl-6 pr-12 h-12 shadow-sm focus:shadow-md transition-shadow"
                />
                <Button
                  size="icon"
                  className="absolute right-1 top-1 bg-gray-100 hover:bg-gray-200 rounded-full h-10 w-10 transition-all duration-300 hover:scale-105"
                >
                  <Search className="h-5 w-5 text-gray-700" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 border-0">
              <div className="text-sm text-gray-500 mb-2">Total Order</div>
              <div className="text-4xl font-bold text-gray-800 mb-2">
                {totalOrders.toLocaleString()}
              </div>
              <div className="flex items-center gap-1 text-sm text-green-600 font-medium">
                <TrendingUp className="h-4 w-4" />
                <span>Live</span>
              </div>
            </Card>

            <Card className="bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 border-0">
              <div className="text-sm text-gray-500 mb-2">Total Sales</div>
              <div className="text-4xl font-bold text-gray-800 mb-2">
                ₱{totalSales.toLocaleString()}
              </div>
              <div className="flex items-center gap-1 text-sm text-green-600 font-medium">
                <TrendingUp className="h-4 w-4" />
                <span>Live</span>
              </div>
            </Card>

            <Card className="bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 border-0">
              <div className="text-sm text-gray-500 mb-2">Active Order</div>
              <div className="text-4xl font-bold text-gray-800 mb-2">
                {activeOrders.toLocaleString()}
              </div>
              <div className="flex items-center gap-1 text-sm text-green-600 font-medium">
                <TrendingUp className="h-4 w-4" />
                <span>Live</span>
              </div>
            </Card>
          </div>

          <div className={`grid grid-cols-1 gap-6 mb-8 ${paymentData.length > 0 ? 'lg:grid-cols-12' : ''}`}>
            <div className={paymentData.length > 0 ? 'lg:col-span-8' : ''}>
              <Card className="bg-white rounded-2xl p-6 h-full shadow-md hover:shadow-lg transition-shadow border-0">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-800">Order & Sales Review</h2>
                  <div className="flex gap-2">
                    <Select defaultValue="sales">
                      <SelectTrigger className="w-32 border-gray-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sales">Sales</SelectItem>
                        <SelectItem value="orders">Orders</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select defaultValue="7days">
                      <SelectTrigger className="w-40 border-gray-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7days">Last 7 Days</SelectItem>
                        <SelectItem value="30days">Last 30 Days</SelectItem>
                        <SelectItem value="90days">Last 90 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <SalesChart />
              </Card>
            </div>
            {paymentData.length > 0 && (
              <div className="lg:col-span-4">
                <Card className="bg-white rounded-2xl p-6 h-full shadow-md hover:shadow-lg transition-shadow border-0">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Payments</h3>
                  <div className="grid grid-cols-3 gap-4 text-center text-sm font-medium text-gray-600 mb-4">
                    <div>Payment Category</div>
                    <div>Date</div>
                    <div>Time</div>
                  </div>
                  <div className="space-y-3">
                    {paymentData.map((payment) => (
                      <div
                        key={payment.id}
                        className="grid grid-cols-3 gap-4 text-center text-sm text-gray-700 py-2 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <div className="font-medium">{payment.category}</div>
                        <div>{payment.date}</div>
                        <div>{payment.time}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}
            {paymentData.length === 0 && (
              <div className="lg:col-span-4">
                <Card className="bg-white rounded-2xl p-6 h-full shadow-md border-0 flex items-center justify-center">
                  <p className="text-gray-400 text-sm text-center">No payments yet.<br />Orders will appear here after cashier processes them.</p>
                </Card>
              </div>
            )}
          </div>

          <OrdersTable orders={orders} />
        </div>
      </main>
    </div>
  )
}