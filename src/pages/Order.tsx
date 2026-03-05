"use client"

import { useState, useEffect, useRef } from "react"
import { Link, NavLink } from "react-router-dom"
import { Clock, Menu as MenuIcon, X, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"

interface OrderItem {
  quantity: number
  name: string
}

interface OrderCard {
  id: string
  orderNumber: string
  tableNumber: number
  status: "dine-in" | "take-out"
  items: OrderItem[]
  isPreparing: boolean
  isFinished: boolean
  startedAt?: number
}

interface HistoryOrder {
  id: number
  orderNumber: string
  items: { name: string; quantity: number; price: number }[]
  total: number
  date: string
  time: string
  status: string
  paymentCategory: string
}

const COOK_TIME_SECONDS = 10 * 60

const navigationItems = [
  { label: "Overview",  path: "/dashboard" },
  { label: "Order",     path: "/orders" },
  { label: "Inventory", path: "/inventory" },
  { label: "Products",  path: "/products" },
  { label: "Menus",     path: "/menu" },
]

const additionalItems = [
  { label: "User Accounts",        path: "/users" },
  { label: "Menu Management",      path: "/menu-management" },
  { label: "Supplier Maintenance", path: "/suppliers" },
  { label: "Sales & Reports",      path: "/sales-reports" },
]

// ── Timer ──────────────────────────────────────────────────────────────────
function OrderTimer({ startedAt, orderNumber }: { startedAt: number; orderNumber: string }) {
  const [elapsed, setElapsed] = useState(0)
  const notifiedRef = useRef(false)

  useEffect(() => {
    const interval = setInterval(() => {
      const secs = Math.floor((Date.now() - startedAt) / 1000)
      setElapsed(secs)
      if (secs >= COOK_TIME_SECONDS && !notifiedRef.current) {
        notifiedRef.current = true
        if (Notification.permission === "granted") {
          new Notification("🍗 Order Ready!", {
            body: `Order ${orderNumber} is done and ready to serve!`,
            icon: "/favicon.ico",
          })
        }
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [startedAt, orderNumber])

  const remaining   = COOK_TIME_SECONDS - elapsed
  const isOverdue   = remaining <= 0
  const displaySecs = isOverdue ? Math.abs(remaining) : remaining
  const mins        = Math.floor(displaySecs / 60)
  const secs        = displaySecs % 60
  const timeStr     = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`

  return (
    <div className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold mb-3 ${
      isOverdue ? "bg-red-100 text-red-600 animate-pulse"
      : elapsed > COOK_TIME_SECONDS * 0.75 ? "bg-yellow-100 text-yellow-700"
      : "bg-green-100 text-green-700"
    }`}>
      <Clock className="w-3 h-3" />
      {isOverdue ? `OVERDUE +${timeStr}` : timeStr}
    </div>
  )
}

// ── Confirm Modal ──────────────────────────────────────────────────────────
function ActionModal({
  orderNumber, action, onConfirm, onClose,
}: {
  orderNumber: string
  action: "cancel" | "refund"
  onConfirm: () => void
  onClose: () => void
}) {
  const isCancel = action === "cancel"
  return (
    <motion.div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full"
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }} transition={{ duration: 0.18 }}>
        <h3 className="text-lg font-bold text-gray-900 mb-1">{isCancel ? "Cancel Order?" : "Refund Order?"}</h3>
        <p className="text-sm text-gray-500 mb-2">Order <span className="font-semibold text-gray-700">{orderNumber}</span></p>
        <p className="text-xs text-gray-400 mb-7">
          {isCancel
            ? "This will remove the order from the queue and mark it as cancelled."
            : "This will mark the order as refunded and update the sales log."}
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
            Go Back
          </button>
          <button onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition ${isCancel ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"}`}>
            {isCancel ? "Yes, Cancel" : "Yes, Refund"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Status badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Completed: "bg-green-50 text-green-600 border-green-200",
    Cancelled: "bg-red-50 text-red-500 border-red-200",
    Refunded:  "bg-blue-50 text-blue-500 border-blue-200",
    Pending:   "bg-yellow-50 text-yellow-600 border-yellow-200",
  }
  const dots: Record<string, string> = {
    Completed: "bg-green-500", Cancelled: "bg-red-400",
    Refunded: "bg-blue-400",   Pending: "bg-yellow-400",
  }
  const s = styles[status] ?? "bg-gray-100 text-gray-500 border-gray-200"
  const d = dots[status]   ?? "bg-gray-400"
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${d}`} />
      {status}
    </span>
  )
}

// ── History Log ────────────────────────────────────────────────────────────
function HistoryLog({ onRefundClick }: { onRefundClick: (order: HistoryOrder) => void }) {
  const [historyOrders, setHistoryOrders] = useState<HistoryOrder[]>([])
  const [search,        setSearch]        = useState("")
  const [filterStatus,  setFilterStatus]  = useState("All")

  useEffect(() => {
    const load = () => {
      try { setHistoryOrders(JSON.parse(localStorage.getItem("orders") || "[]")) } catch {}
    }
    load()
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [])

  const filtered = historyOrders.filter((o) => {
    const ms = filterStatus === "All" || o.status === filterStatus
    const mq = o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.items?.some((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    return ms && mq
  })

  const grouped: Record<string, HistoryOrder[]> = {}
  filtered.forEach((o) => {
    if (!grouped[o.date]) grouped[o.date] = []
    grouped[o.date].push(o)
  })
  const dates = Object.keys(grouped)

  return (
    <div>
      {/* Search + filters */}
      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order number or item..."
          className="flex-1 min-w-[200px] bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none text-gray-700"
          style={{ fontFamily: "Poppins, sans-serif" }} />
        <div className="flex gap-2 flex-wrap">
          {["All", "Completed", "Pending", "Cancelled", "Refunded"].map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-4 py-2 rounded-full text-xs font-semibold border transition ${
                filterStatus === s
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
              }`}
              style={{ fontFamily: "Poppins, sans-serif" }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        {/* Header */}
        <div className="grid gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100"
          style={{ gridTemplateColumns: "1fr 1.5fr 80px 90px 110px 90px" }}>
          {["ORDER #", "ITEMS", "TOTAL", "TIME", "STATUS", "ACTION"].map((h) => (
            <span key={h} className="text-gray-400 text-[10px] font-semibold tracking-wider">{h}</span>
          ))}
        </div>

        {dates.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-2xl mb-2">🧾</p>
            <p className="text-gray-400 text-sm">No order history yet.</p>
          </div>
        ) : (
          dates.map((date) => (
            <div key={date}>
              {/* Date divider */}
              <div className="flex items-center gap-3 px-5 py-2.5 bg-gray-50 border-y border-gray-100">
                <span className="text-gray-500 text-xs font-semibold">{date}</span>
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-gray-300 text-xs">{grouped[date].length} orders · ₱{grouped[date].filter(o => o.status === "Completed").reduce((s, o) => s + o.total, 0).toLocaleString()}</span>
              </div>

              {grouped[date].map((order, i) => (
                <motion.div key={order.id}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="grid gap-4 px-5 py-4 border-b border-gray-50 hover:bg-gray-50/60 transition items-center"
                  style={{ gridTemplateColumns: "1fr 1.5fr 80px 90px 110px 90px" }}>

                  {/* Order # */}
                  <span className="text-sm font-semibold text-gray-700">{order.orderNumber}</span>

                  {/* Items */}
                  <div className="flex flex-col gap-0.5">
                    {order.items?.slice(0, 2).map((item, idx) => (
                      <span key={idx} className="text-xs text-gray-500">{item.quantity}× {item.name}</span>
                    ))}
                    {(order.items?.length ?? 0) > 2 && (
                      <span className="text-xs text-gray-400">+{order.items.length - 2} more</span>
                    )}
                  </div>

                  {/* Total */}
                  <span className="text-sm font-bold text-gray-800">₱{order.total?.toLocaleString()}</span>

                  {/* Time */}
                  <span className="text-xs text-gray-400">{order.time}</span>

                  {/* Status */}
                  <StatusBadge status={order.status} />

                  {/* Refund — only for Completed */}
                  <div>
                    {order.status === "Completed" && (
                      <button onClick={() => onRefundClick(order)}
                        className="text-xs font-semibold text-blue-500 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
                        style={{ fontFamily: "Poppins, sans-serif" }}>
                        Refund
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          ))
        )}
      </div>

      <p className="text-center text-gray-300 text-xs mt-4" style={{ fontFamily: "Poppins, sans-serif" }}>
        {filtered.length} of {historyOrders.length} records · updates every 3s
      </p>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function Order() {
  const [currentTime,     setCurrentTime]     = useState(new Date())
  const [isOpen,          setIsOpen]          = useState(false)
  const [orders,          setOrders]          = useState<OrderCard[]>([])
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default")
  const [activeTab,       setActiveTab]       = useState<"queue" | "history">("queue")
  const [modalState,      setModalState]      = useState<{
    orderNumber: string
    action: "cancel" | "refund"
    queueId?: string        // for cancel
    historyId?: number      // for refund
  } | null>(null)

  useEffect(() => {
    const link = document.createElement("link")
    link.href = "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap"
    link.rel = "stylesheet"
    document.head.appendChild(link)
  }, [])

  useEffect(() => {
    if ("Notification" in window) Notification.requestPermission().then(setNotifPermission)
  }, [])

  useEffect(() => {
    const loadQueue = () => {
      try { setOrders(JSON.parse(localStorage.getItem("cookQueue") || "[]")) } catch {}
    }
    loadQueue()
    window.addEventListener("storage", loadQueue)
    const interval = setInterval(loadQueue, 3000)
    return () => { window.removeEventListener("storage", loadQueue); clearInterval(interval) }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatDateTime = (date: Date) => {
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
    let hours = date.getHours()
    const ampm = hours >= 12 ? "PM" : "AM"
    hours = hours % 12 || 12
    return `${days[date.getDay()]}, ${String(date.getMonth()+1).padStart(2,"0")}/${String(date.getDate()).padStart(2,"0")}/${String(date.getFullYear()).slice(-2)} ${hours}:${String(date.getMinutes()).padStart(2,"0")} ${ampm}`
  }

  const getStatusColor = (status: string) => ({ "dine-in": "bg-red-600 text-white", "take-out": "bg-amber-600 text-white" }[status] ?? "bg-gray-600 text-white")
  const getStatusLabel = (s: string) => s === "dine-in" ? "Dine In" : "Take Out"

  // ── Queue actions ──────────────────────────────────────────────────────────
  const toggleStartOrder = (id: string) => {
    const updated = orders.map((o) => o.id === id ? { ...o, isPreparing: true, startedAt: Date.now() } : o)
    setOrders(updated)
    localStorage.setItem("cookQueue", JSON.stringify(updated))
  }

  const toggleFinishOrder = (id: string) => {
    const all = JSON.parse(localStorage.getItem("orders") || "[]")
    localStorage.setItem("orders", JSON.stringify(all.map((o: any) => o.id === Number(id) ? { ...o, status: "Completed" } : o)))
    const q = orders.filter((o) => o.id !== id)
    setOrders(q)
    localStorage.setItem("cookQueue", JSON.stringify(q))
  }

  const confirmCancel = (queueId: string) => {
    const all = JSON.parse(localStorage.getItem("orders") || "[]")
    localStorage.setItem("orders", JSON.stringify(all.map((o: any) => o.id === Number(queueId) ? { ...o, status: "Cancelled" } : o)))
    const q = orders.filter((o) => o.id !== queueId)
    setOrders(q)
    localStorage.setItem("cookQueue", JSON.stringify(q))
    setModalState(null)
  }

  const confirmRefund = (historyId: number) => {
    const all = JSON.parse(localStorage.getItem("orders") || "[]")
    localStorage.setItem("orders", JSON.stringify(all.map((o: any) => o.id === historyId ? { ...o, status: "Refunded" } : o)))
    setModalState(null)
  }

  const onConfirm = () => {
    if (!modalState) return
    if (modalState.action === "cancel" && modalState.queueId) confirmCancel(modalState.queueId)
    if (modalState.action === "refund" && modalState.historyId) confirmRefund(modalState.historyId)
  }

  const allOrders    = JSON.parse(localStorage.getItem("orders") || "[]")
  const newCount     = orders.filter((o) => !o.isPreparing).length
  const processCount = orders.filter((o) => o.isPreparing).length
  const servedCount  = allOrders.filter((o: any) => o.status === "Completed").length
  const cancelCount  = allOrders.filter((o: any) => o.status === "Cancelled").length
  const refundCount  = allOrders.filter((o: any) => o.status === "Refunded").length

  const stats = [
    { label:"NEW",       value: newCount,     bg:"bg-red-100",   border:"border-red-200",    text:"text-red-600",    num:"text-red-700"    },
    { label:"READY",     value: 0,            bg:"bg-green-50",  border:"border-green-200",  text:"text-green-600",  num:"text-green-700"  },
    { label:"PROCESS",   value: processCount, bg:"bg-yellow-50", border:"border-yellow-200", text:"text-yellow-600", num:"text-yellow-700" },
    { label:"SERVED",    value: servedCount,  bg:"bg-gray-100",  border:"border-gray-200",   text:"text-gray-500",   num:"text-gray-700"   },
    { label:"CANCELLED", value: cancelCount,  bg:"bg-red-50",    border:"border-red-200",    text:"text-red-500",    num:"text-red-600"    },
    { label:"REFUNDED",  value: refundCount,  bg:"bg-blue-50",   border:"border-blue-200",   text:"text-blue-500",   num:"text-blue-600"   },
  ]

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Poppins, sans-serif" }}>

      {/* ── Sidebar ── */}
      <>
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          className="fixed top-6 left-6 z-50 p-3 bg-white rounded-xl shadow-lg"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div key="close"
                initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                <X className="w-6 h-6 text-black" />
              </motion.div>
            ) : (
              <motion.div key="menu"
                initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                <MenuIcon className="w-6 h-6 text-black" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 backdrop-blur-sm bg-black/20 z-40"
              onClick={() => setIsOpen(false)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isOpen && (
            <motion.aside
              initial={{ x: -288, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -288, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 h-full w-72 bg-white p-6 flex flex-col shadow-2xl z-50"
              style={{ fontFamily: "Poppins, sans-serif" }}
            >
              <motion.div className="flex items-center justify-center mb-10 mt-8"
                initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
                <span className="text-2xl font-bold text-black">The Crunch</span>
              </motion.div>

              <motion.div className="text-xs text-gray-400 mb-4 uppercase tracking-wider font-medium px-2"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
                Navigation
              </motion.div>

              <nav className="flex-1 space-y-1.5">
                {navigationItems.map((item, index) => (
                  <motion.div key={item.label}
                    initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.05 * index }}>
                    <NavLink to={item.path} end onClick={() => setIsOpen(false)}>
                      {({ isActive }) => (
                        <Button variant="ghost" className={cn(
                          "w-full justify-start rounded-xl text-sm transition-all duration-200 px-4 py-2.5 text-black hover:bg-gray-50",
                          isActive && "bg-gray-100 font-semibold"
                        )}>
                          {item.label}
                        </Button>
                      )}
                    </NavLink>
                  </motion.div>
                ))}
              </nav>

              <div className="space-y-1.5 mt-6 pt-6 border-t border-gray-100">
                {additionalItems.map((item, index) => (
                  <motion.div key={item.label}
                    initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.3 + 0.05 * index }}>
                    <NavLink to={item.path} onClick={() => setIsOpen(false)}>
                      {({ isActive }) => (
                        <Button variant="ghost" className={cn(
                          "w-full justify-start rounded-xl text-sm transition-all duration-200 px-4 py-2.5 text-black hover:bg-gray-50",
                          isActive && "bg-gray-100 font-semibold"
                        )}>
                          {item.label}
                        </Button>
                      )}
                    </NavLink>
                  </motion.div>
                ))}
                <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.45 }}>
                  <Link to="/login" className="w-full">
                    <Button variant="ghost"
                      className="w-full justify-start rounded-xl text-sm text-black mt-6 transition-all duration-200 px-4 py-2.5 hover:bg-red-50 hover:text-red-600"
                      onClick={() => setIsOpen(false)}>
                      Log Out
                    </Button>
                  </Link>
                </motion.div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </>

      {/* ── Main ── */}
      <div className="p-6 pl-24">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-sm font-semibold text-gray-700 tracking-wider">ORDERS</h1>
          {notifPermission !== "granted" && (
            <button onClick={() => Notification.requestPermission().then(setNotifPermission)}
              className="flex items-center gap-2 text-xs bg-yellow-50 border border-yellow-200 text-yellow-700 px-3 py-1.5 rounded-lg hover:bg-yellow-100 transition">
              <Bell className="w-3 h-3" /> Enable notifications for order alerts
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="flex gap-6 items-start mb-6">
          <div className="bg-white rounded-2xl p-6 flex-1 max-w-sm shadow-lg">
            <div className="flex justify-between items-center mb-3">
              <MenuIcon className="w-5 h-5 text-gray-900" />
              <span className="text-xs font-semibold text-gray-500">COOK VIEW</span>
            </div>
            <p className="text-xs text-gray-600 flex items-center gap-1">
              <Clock className="w-3 h-3" />{formatDateTime(currentTime)}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap flex-1">
            {stats.map((s) => (
              <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl p-5 flex flex-col items-center justify-center min-w-[80px]`}>
                <span className={`${s.text} text-xs font-semibold mb-2`}>{s.label}</span>
                <span className={`${s.num} text-3xl font-bold`}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-5 border-b border-gray-100">
          {(["queue", "history"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`relative px-5 py-2.5 text-sm font-semibold capitalize transition ${activeTab === tab ? "text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
              style={{ fontFamily: "Poppins, sans-serif" }}>
              {tab === "queue" ? "Order Queue" : "History"}
              {/* badge for queue count */}
              {tab === "queue" && orders.length > 0 && (
                <span className="ml-2 bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{orders.length}</span>
              )}
              {activeTab === tab && (
                <motion.div layoutId="tabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <AnimatePresence mode="wait">

          {/* Queue */}
          {activeTab === "queue" && (
            <motion.div key="queue" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div className="bg-gray-100 rounded-3xl p-4 shadow-sm">
                {orders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-2">
                    <p className="text-gray-400 text-sm">No pending orders. Orders from the cashier will appear here.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <AnimatePresence mode="popLayout">
                      {orders.map((order) => (
                        <motion.div key={order.id} layout
                          initial={{ opacity: 0, scale: 0.9, y: 16 }}
                          animate={{ opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }}
                          exit={{ opacity: 0, scale: 0.9, y: -16, transition: { duration: 0.2 } }}
                          className="bg-white rounded-2xl p-5 shadow-md">

                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <span className="text-sm font-bold text-gray-900">TABLE {order.tableNumber}</span>
                              <p className="text-xs text-gray-400 mt-0.5">{order.orderNumber}</p>
                            </div>
                            <span className={`${getStatusColor(order.status)} text-xs font-bold px-3 py-1 rounded-full`}>
                              {getStatusLabel(order.status)}
                            </span>
                          </div>

                          {order.isPreparing && order.startedAt && (
                            <OrderTimer startedAt={order.startedAt} orderNumber={order.orderNumber} />
                          )}

                          <div className="space-y-2 mb-5 border-b border-gray-100 pb-4">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-sm">
                                <span className="font-semibold text-gray-400">{item.quantity}×</span>
                                <span className="text-gray-700 text-right">{item.name}</span>
                              </div>
                            ))}
                          </div>

                          {/* Start / Finish */}
                          <div className="flex gap-2 mb-2">
                            <button onClick={() => toggleStartOrder(order.id)} disabled={order.isPreparing}
                              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
                                order.isPreparing ? "bg-gray-100 text-gray-300 cursor-not-allowed" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              }`}>
                              Start
                            </button>
                            <button onClick={() => toggleFinishOrder(order.id)} disabled={!order.isPreparing}
                              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
                                order.isPreparing ? "bg-green-500 text-white hover:bg-green-600" : "bg-green-100 text-green-300 cursor-not-allowed"
                              }`}>
                              Finished
                            </button>
                          </div>

                          {/* Cancel only — Refund is in History */}
                          <button
                            onClick={() => setModalState({ orderNumber: order.orderNumber, action: "cancel", queueId: order.id })}
                            className="w-full py-2 rounded-lg text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 transition">
                            Cancel Order
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* History */}
          {activeTab === "history" && (
            <motion.div key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <HistoryLog
                onRefundClick={(order) =>
                  setModalState({ orderNumber: order.orderNumber, action: "refund", historyId: order.id })
                }
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Modal ── */}
      <AnimatePresence>
        {modalState && (
          <ActionModal
            orderNumber={modalState.orderNumber}
            action={modalState.action}
            onConfirm={onConfirm}
            onClose={() => setModalState(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}