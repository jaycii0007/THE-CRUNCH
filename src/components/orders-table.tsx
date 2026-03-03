import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface Order {
  id: number
  orderNumber: string
  items: { name: string; price: number; quantity: number }[]
  total: number
  date: string
  time: string
  status: string
  paymentCategory: string
}

interface OrdersTableProps {
  orders?: Order[]
}

export function OrdersTable({ orders = [] }: OrdersTableProps) {
  return (
    <Card className="bg-white rounded-2xl p-6 shadow-md border-0">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-200 hover:bg-transparent">
            <TableHead className="text-gray-700 font-semibold">Order ID</TableHead>
            <TableHead className="text-gray-700 font-semibold">Date</TableHead>
            <TableHead className="text-gray-700 font-semibold">Order Type</TableHead>
            <TableHead className="text-gray-700 font-semibold">Status</TableHead>
            <TableHead className="text-gray-700 font-semibold">Payment</TableHead>
            <TableHead className="text-gray-700 font-semibold text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-gray-400 py-10">
                No orders yet. Orders will appear here once the cashier processes them.
              </TableCell>
            </TableRow>
          ) : (
            orders.map((order) => (
              <TableRow
                key={order.id}
                className="border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <TableCell className="font-medium text-gray-900">{order.orderNumber}</TableCell>
                <TableCell className="text-gray-600">{order.date}</TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={
                      order.status === "Completed"
                        ? "bg-green-50 text-green-700 hover:bg-green-50 rounded-lg font-medium border-0"
                        : "bg-yellow-50 text-yellow-700 hover:bg-yellow-50 rounded-lg font-medium border-0"
                    }
                  >
                    {order.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={
                      order.status === "Completed"
                        ? "bg-green-50 text-green-700 hover:bg-green-50 rounded-lg font-medium border-0"
                        : "bg-yellow-50 text-yellow-700 hover:bg-yellow-50 rounded-lg font-medium border-0"
                    }
                  >
                    {order.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-blue-600 font-medium">{order.paymentCategory}</TableCell>
                <TableCell className="font-semibold text-gray-900 text-right">₱{order.total}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  )
}