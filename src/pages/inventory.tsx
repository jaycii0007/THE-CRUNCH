"use client"

import { useState, useEffect } from "react"
import { InventoryClient } from "@/components/ui/inventoryClient"
import type { Batch, InventoryItem, UnitType } from "@/components/ui/inventoryClient"
import { Sidebar } from "@/components/Sidebar"
import { api, apiCall } from "@/lib/api"
import { motion, AnimatePresence } from "framer-motion"
import { Package, RefreshCw, Archive } from "lucide-react"
import React from "react"

const BRANCHES  = ["Branch A", "Branch B", "Branch C"] as const
const SUPPLIERS = ["Metro Farms", "Sunrise Supplies", "FreshVeg Co.", "Golden Grains"] as const
const SM_UNITS  = ["kg", "pcs", "liters", "boxes", "bags"] as const
const ITEMS     = ["Chicken Breast", "Beef", "Rice", "All-Purpose Flour", "Cooking Oil", "Tomatoes", "Garlic", "Soy Sauce"] as const
const REASONS   = ["Spoilage", "Damaged", "Theft", "Correction", "Wastage", "Other"] as const
const SM_TABS   = [
  { key: "po", label: "Purchase Orders" }, { key: "stockin", label: "Stock In" },
  { key: "transfer", label: "Transfer" }, { key: "adjustment", label: "Adjustment" },
  { key: "logs", label: "Logs" },
] as const
type SMTabKey = typeof SM_TABS[number]["key"]

const useNow = () => { const [now, setNow] = useState(new Date()); useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id) }, []); return now }
const loadLS = <T,>(k: string, fb: T): T => { if (typeof window === "undefined") return fb; try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb } catch { return fb } }
const saveLS = <T,>(k: string, v: T) => { if (typeof window !== "undefined") try { localStorage.setItem(k, JSON.stringify(v)) } catch { } }

const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-[12.5px] text-gray-900 outline-none bg-white focus:border-gray-400 focus:shadow-[0_0_0_3px_rgba(107,114,128,0.08)] transition-[border] box-border"
const statusBadge = (s: string) => `inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${ s==="Received"||s==="Completed"?"bg-green-50 text-green-600":s==="Pending"?"bg-yellow-50 text-yellow-600":s==="Cancelled"?"bg-red-50 text-red-600":"bg-gray-100 text-gray-500"}`
const typeBadge  = (t: string) => `inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${ t==="Stock In"?"bg-green-50 text-green-600":t==="Transfer"?"bg-blue-50 text-blue-600":t==="Adjustment"?"bg-red-50 text-red-600":"bg-gray-100 text-gray-500"}`
const aBtn = (v: "ghost"|"ok"|"del"|"primary") => ({ ghost:"bg-gray-100 text-gray-600 hover:bg-gray-200 border-none cursor-pointer font-semibold text-[11.5px] rounded-md px-3 py-1.5 transition-colors", ok:"bg-green-50 text-green-600 hover:bg-green-100 border-none cursor-pointer font-semibold text-[11.5px] rounded-md px-3 py-1.5 transition-colors", del:"bg-red-50 text-red-500 hover:bg-red-100 border-none cursor-pointer font-semibold text-[11.5px] rounded-md px-3 py-1.5 transition-colors", primary:"bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 cursor-pointer font-semibold text-[12.5px] rounded-lg px-4 py-2 transition-colors" }[v])
const tdCls = "px-3.5 py-2.5 text-[12.5px] text-gray-600"

const Modal = ({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) => (
  <div className="fixed inset-0 z-[400] flex items-center justify-center p-5 bg-gray-900/25 backdrop-blur-sm" onClick={onClose}>
    <div className="bg-white rounded-2xl w-full max-w-[480px] shadow-[0_20px_60px_rgba(0,0,0,0.10)] overflow-hidden" onClick={e => e.stopPropagation()}>
      <div className="flex justify-between items-center px-6 py-[17px] border-b border-gray-50">
        <span className="font-bold text-sm text-gray-900">{title}</span>
        <button className="bg-transparent border-none cursor-pointer text-gray-400 hover:bg-gray-100 hover:text-gray-600 text-xl leading-none px-1.5 py-0.5 rounded-md transition-colors" onClick={onClose}>×</button>
      </div>
      <div className="px-6 py-5 max-h-[58vh] overflow-y-auto">{children}</div>
      {footer && <div className="flex justify-end gap-2 px-6 py-3 border-t border-gray-50 bg-gray-50">{footer}</div>}
    </div>
  </div>
)

const FL   = ({ label, children }: { label: string; children: React.ReactNode }) => (<div className="mb-3.5"><label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">{label}</label>{children}</div>)
const FI   = ({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (<FL label={label}><input className={inputCls} {...rest} /></FL>)
const FSel = ({ label, opts, value, onChange }: { label: string; opts: ReadonlyArray<string>; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void }) => (<FL label={label}><select className={inputCls} value={value} onChange={onChange}>{opts.map(o => <option key={o}>{o}</option>)}</select></FL>)

const SecHeader = ({ title, sub, cta }: { title: string; sub: string; cta?: React.ReactNode }) => (
  <div className="flex justify-between items-end mb-3.5">
    <div><div className="text-[13.5px] font-bold text-gray-900">{title}</div><div className="text-[11.5px] text-gray-400 mt-px">{sub}</div></div>
    {cta}
  </div>
)

const DataTable = ({ cols, rows, emptyHint }: { cols: string[]; rows: React.ReactNode[]; emptyHint: string }) => (
  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
    <table className="w-full border-collapse">
      <thead><tr className="border-b border-gray-50">{cols.map(c => <th key={c} className="px-3.5 py-2.5 text-left text-[10.5px] font-bold text-gray-400 uppercase tracking-wide">{c}</th>)}</tr></thead>
      <tbody>
        {rows.length === 0
          ? <tr><td colSpan={cols.length}><div className="text-center py-10"><div className="text-[13px] text-gray-400">No records yet</div><div className="text-[11px] text-gray-300 mt-0.5">{emptyHint}</div></div></td></tr>
          : rows}
      </tbody>
    </table>
  </div>
)

const StatCard = ({ label, value, meta, color }: { label: string; value: number; meta?: string; color: "blue"|"green"|"yellow"|"red" }) => {
  const c = { green:"#16a34a", yellow:"#ca8a04", red:"#dc2626", blue:"#4f46e5" }[color]
  return (
    <div className="bg-white rounded-xl px-4 py-3.5 border border-gray-100 hover:shadow-md transition-shadow" style={{ borderTop: `3px solid ${c}` }}>
      <div className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: c }}>{label}</div>
      <div className="text-2xl font-extrabold leading-none" style={{ color: c }}>{value}</div>
      {meta && <div className="text-[11px] text-gray-400 mt-1">{meta}</div>}
    </div>
  )
}

const SearchInput = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <div className="flex-1 min-w-[200px] flex items-center px-2.5 border border-gray-200 rounded-lg bg-white focus-within:border-gray-400 transition-colors">
    <input className="flex-1 min-w-0 py-2 border-none outline-none bg-transparent text-[12.5px] text-gray-600 placeholder:text-gray-400" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
  </div>
)

const FilterRow  = ({ children }: { children: React.ReactNode }) => <div className="flex items-center gap-2 mb-3.5 flex-wrap">{children}</div>
const Chip       = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => <button onClick={onClick} className={`px-3.5 py-1 rounded-full text-[12px] font-semibold border cursor-pointer transition-all ${active?"bg-gray-700 border-gray-700 text-white":"bg-white border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 hover:bg-gray-50"}`}>{label}</button>
const ItemsLabel = () => <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Items</label>
const AddRowBtn  = ({ onClick }: { onClick: () => void }) => <button onClick={onClick} className="w-full mt-0.5 border border-dashed border-gray-300 text-gray-400 bg-transparent rounded-lg py-1.5 text-[12px] font-semibold cursor-pointer hover:border-gray-400 hover:text-gray-600 transition-colors">+ Add another item</button>

const EMPTY_PO_ITEM = () => ({ name: ITEMS[0] as string, qty: "", unit: "kg", cost: "" })

function PurchaseOrders() {
  const [pos,    setPOs]    = useState(() => loadLS<any[]>("sm_pos", []))
  const [show,   setShow]   = useState(false)
  const [viewPO, setViewPO] = useState<any>(null)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("All")
  const [f, setF] = useState({ supplier: SUPPLIERS[0] as string, branch: BRANCHES[0] as string, date: "", items: [EMPTY_PO_ITEM()] })

  useEffect(() => { saveLS("sm_pos", pos) }, [pos])

  const total  = f.items.reduce((s, it) => s + (parseFloat(it.qty)||0) * (parseFloat(it.cost)||0), 0)
  const reset  = () => setF({ supplier: SUPPLIERS[0], branch: BRANCHES[0], date: "", items: [EMPTY_PO_ITEM()] })
  const submit = () => { if (!f.date) return alert("Please set a date."); setPOs(p => [{ id: `PO-${String(p.length+1).padStart(3,"0")}`, ...f, status: "Pending", total }, ...p]); setShow(false); reset() }
  const updateItem   = (i: number, k: string, v: string) => setF(p => ({ ...p, items: p.items.map((it, x) => x!==i ? it : { ...it, [k]: v }) }))
  const updateStatus = (id: string, status: string) => setPOs(p => p.map(x => x.id===id ? { ...x, status } : x))
  const filtered = pos.filter(p => { const s = search.toLowerCase(); return (p.id.toLowerCase().includes(s)||p.supplier.toLowerCase().includes(s)||p.branch.toLowerCase().includes(s)) && (filter==="All"||p.status===filter) })

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard label="Total POs"  value={pos.length}                                     meta="All time"  color="blue"   />
        <StatCard label="Pending"    value={pos.filter(p=>p.status==="Pending").length}     meta="Awaiting"  color="yellow" />
        <StatCard label="Received"   value={pos.filter(p=>p.status==="Received").length}    meta="Completed" color="green"  />
        <StatCard label="Cancelled"  value={pos.filter(p=>p.status==="Cancelled").length}   meta="Voided"    color="red"    />
      </div>
      <SecHeader title="Purchase Orders" sub="Manage supplier orders across all branches" cta={<button className={aBtn("primary")} onClick={() => setShow(true)}>+ New PO</button>} />
      <FilterRow>
        <SearchInput value={search} onChange={setSearch} placeholder="Search PO number, supplier, branch…" />
        {["All","Pending","Received","Cancelled"].map(fl => <Chip key={fl} label={fl} active={filter===fl} onClick={() => setFilter(fl)} />)}
      </FilterRow>
      <DataTable cols={["PO #","Supplier","Branch","Date","Total","Status","Actions"]} emptyHint="Create a purchase order to get started."
        rows={filtered.map(po => (
          <tr key={po.id} className="border-b border-gray-50 last:border-none hover:bg-gray-50 transition-colors">
            <td className="px-3.5 py-2.5 text-[12.5px] font-bold text-gray-900">{po.id}</td>
            <td className={tdCls}>{po.supplier}</td><td className={tdCls}>{po.branch}</td><td className={tdCls}>{po.date}</td>
            <td className="px-3.5 py-2.5 text-[12.5px] font-bold text-green-600">₱{po.total.toLocaleString()}</td>
            <td className="px-3.5 py-2.5"><span className={statusBadge(po.status)}>{po.status}</span></td>
            <td className="px-3.5 py-2.5">
              <div className="flex gap-1.5">
                <button className={aBtn("ghost")} onClick={() => setViewPO(po)}>View</button>
                {po.status==="Pending" && <><button className={aBtn("ok")} onClick={() => updateStatus(po.id,"Received")}>Receive</button><button className={aBtn("del")} onClick={() => updateStatus(po.id,"Cancelled")}>Cancel</button></>}
              </div>
            </td>
          </tr>
        ))}
      />

      {show && (
        <Modal title="Create Purchase Order" onClose={() => { setShow(false); reset() }}
          footer={<><button className={aBtn("ghost")} onClick={() => { setShow(false); reset() }}>Discard</button><button className={aBtn("primary")} onClick={submit}>Submit PO</button></>}>
          <FSel label="Supplier" opts={SUPPLIERS} value={f.supplier} onChange={e => setF(p => ({ ...p, supplier: e.target.value }))} />
          <FSel label="Branch"   opts={BRANCHES}  value={f.branch}   onChange={e => setF(p => ({ ...p, branch: e.target.value }))} />
          <FI   label="Expected Date" type="date" value={f.date} onChange={e => setF(p => ({ ...p, date: e.target.value }))} />
          <ItemsLabel />
          {f.items.map((item, i) => (
            <div key={i} className="grid gap-1.5 mb-1.5 items-end" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr auto" }}>
              <select className={inputCls} value={item.name} onChange={e => updateItem(i,"name",e.target.value)}>{ITEMS.map(it => <option key={it}>{it}</option>)}</select>
              <input  className={inputCls} placeholder="Qty"  type="number" value={item.qty}  onChange={e => updateItem(i,"qty",e.target.value)} />
              <select className={inputCls} value={item.unit}  onChange={e => updateItem(i,"unit",e.target.value)}>{SM_UNITS.map(u => <option key={u}>{u}</option>)}</select>
              <input  className={inputCls} placeholder="Cost" type="number" value={item.cost} onChange={e => updateItem(i,"cost",e.target.value)} />
              <button className="bg-red-50 text-red-500 border-none rounded-md px-2.5 py-1.5 text-sm font-bold cursor-pointer hover:bg-red-100 transition-colors" onClick={() => setF(p => ({ ...p, items: p.items.filter((_,x) => x!==i) }))}>×</button>
            </div>
          ))}
          <AddRowBtn onClick={() => setF(p => ({ ...p, items: [...p.items, EMPTY_PO_ITEM()] }))} />
          <div className="mt-3 px-3.5 py-2.5 bg-gray-50 rounded-xl flex justify-between items-center">
            <span className="text-[12px] text-gray-500 font-semibold">Total Amount</span>
            <span className="text-[15px] font-extrabold text-green-600">₱{total.toLocaleString()}</span>
          </div>
        </Modal>
      )}

      {viewPO && (
        <Modal title={`${viewPO.id} — Details`} onClose={() => setViewPO(null)} footer={<button className={aBtn("ghost")} onClick={() => setViewPO(null)}>Close</button>}>
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            {(["supplier","branch","date","status"] as const).map(k => (
              <div key={k} className="bg-gray-50 rounded-xl px-3.5 py-2.5">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{k.charAt(0).toUpperCase()+k.slice(1)}</div>
                <div className="text-[13px] font-semibold text-gray-900 mt-0.5">{viewPO[k]}</div>
              </div>
            ))}
          </div>
          <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Items Ordered</label>
          {viewPO.items.map((it: any, i: number) => (
            <div key={i} className="flex justify-between py-2.5 border-b border-gray-50 last:border-none text-[13px]">
              <span className="text-gray-600">{it.name}</span><span className="text-gray-400 font-semibold">{it.qty} {it.unit}</span>
            </div>
          ))}
          <div className="mt-3.5 text-right font-extrabold text-green-600 text-[15px]">₱{viewPO.total.toLocaleString()}</div>
        </Modal>
      )}
    </div>
  )
}

const EMPTY_SI_ITEM = () => ({ name: ITEMS[0] as string, qty: "", unit: "kg" })

function StockIn() {
  const [records, setRecords] = useState(() => loadLS<any[]>("sm_stockin", []))
  const [show,    setShow]    = useState(false)
  const [search,  setSearch]  = useState("")
  const [f, setF] = useState({ poRef: "", branch: BRANCHES[0] as string, date: "", recBy: "", items: [EMPTY_SI_ITEM()] })

  useEffect(() => { saveLS("sm_stockin", records) }, [records])

  const reset  = () => setF({ poRef: "", branch: BRANCHES[0], date: "", recBy: "", items: [EMPTY_SI_ITEM()] })
  const submit = () => { if (!f.date||!f.recBy) return alert("Please fill all required fields."); setRecords(p => [{ id: `SI-${String(p.length+1).padStart(3,"0")}`, poRef: f.poRef, branch: f.branch, date: f.date, receivedBy: f.recBy, items: f.items }, ...p]); setShow(false); reset() }
  const filtered = records.filter(r => { const s = search.toLowerCase(); return r.id.toLowerCase().includes(s)||r.branch.toLowerCase().includes(s)||r.receivedBy.toLowerCase().includes(s) })

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard label="Total Deliveries" value={records.length}                                    meta="All time"   color="blue"   />
        <StatCard label="This Month"        value={records.length}                                    meta="March 2026" color="green"  />
        <StatCard label="Branches Covered"  value={new Set(records.map(r=>r.branch)).size}           meta="Unique"     color="yellow" />
        <StatCard label="Linked to PO"      value={records.filter(r=>r.poRef!=="").length}           meta="With ref"   color="blue"   />
      </div>
      <SecHeader title="Stock In" sub="Record incoming deliveries and stock arrivals" cta={<button className={aBtn("primary")} onClick={() => setShow(true)}>+ Record Stock In</button>} />
      <FilterRow><SearchInput value={search} onChange={setSearch} placeholder="Search SI number, branch, received by…" /></FilterRow>
      <DataTable cols={["SI #","PO Reference","Branch","Date","Received By","Items"]} emptyHint="Record a delivery to get started."
        rows={filtered.map(r => (
          <tr key={r.id} className="border-b border-gray-50 last:border-none hover:bg-gray-50 transition-colors">
            <td className="px-3.5 py-2.5 text-[12.5px] font-bold text-gray-900">{r.id}</td>
            <td className="px-3.5 py-2.5 text-[12.5px]" style={{ color: r.poRef?"#4f46e5":"#9ca3af", fontWeight: r.poRef?600:400 }}>{r.poRef||"—"}</td>
            <td className={tdCls}>{r.branch}</td><td className={tdCls}>{r.date}</td><td className={tdCls}>{r.receivedBy}</td>
            <td className="px-3.5 py-2.5 text-[12.5px] text-gray-400 max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">{r.items.map((it: any) => `${it.name} (${it.qty} ${it.unit})`).join(", ")}</td>
          </tr>
        ))}
      />
      {show && (
        <Modal title="Record Stock In" onClose={() => { setShow(false); reset() }}
          footer={<><button className={aBtn("ghost")} onClick={() => { setShow(false); reset() }}>Discard</button><button className={aBtn("primary")} onClick={submit}>Save Record</button></>}>
          <FI   label="PO Reference (optional)" placeholder="e.g. PO-002" value={f.poRef} onChange={e => setF(p => ({ ...p, poRef: e.target.value }))} />
          <FSel label="Branch" opts={BRANCHES} value={f.branch} onChange={e => setF(p => ({ ...p, branch: e.target.value }))} />
          <FI   label="Date Received" type="date" value={f.date} onChange={e => setF(p => ({ ...p, date: e.target.value }))} />
          <FI   label="Received By" placeholder="Staff name" value={f.recBy} onChange={e => setF(p => ({ ...p, recBy: e.target.value }))} />
          <ItemsLabel />
          {f.items.map((item, i) => (
            <div key={i} className="grid gap-1.5 mb-1.5 items-end" style={{ gridTemplateColumns: "2fr 1fr 1fr" }}>
              <select className={inputCls} value={item.name} onChange={e => setF(p => ({ ...p, items: p.items.map((it,x) => x!==i?it:{...it,name:e.target.value}) }))}>{ITEMS.map(it => <option key={it}>{it}</option>)}</select>
              <input  className={inputCls} placeholder="Qty" type="number" value={item.qty}  onChange={e => setF(p => ({ ...p, items: p.items.map((it,x) => x!==i?it:{...it,qty:e.target.value}) }))} />
              <select className={inputCls} value={item.unit} onChange={e => setF(p => ({ ...p, items: p.items.map((it,x) => x!==i?it:{...it,unit:e.target.value}) }))}>{SM_UNITS.map(u => <option key={u}>{u}</option>)}</select>
            </div>
          ))}
          <AddRowBtn onClick={() => setF(p => ({ ...p, items: [...p.items, EMPTY_SI_ITEM()] }))} />
        </Modal>
      )}
    </div>
  )
}

function StockTransfer() {
  const [transfers, setTransfers] = useState(() => loadLS<any[]>("sm_transfers", []))
  const [show,   setShow]   = useState(false)
  const [filter, setFilter] = useState("All")
  const [f, setF] = useState({ from: BRANCHES[0] as string, to: BRANCHES[1] as string, item: ITEMS[0] as string, qty: "", unit: SM_UNITS[0] as string, date: "" })

  useEffect(() => { saveLS("sm_transfers", transfers) }, [transfers])

  const reset  = () => setF({ from: BRANCHES[0], to: BRANCHES[1], item: ITEMS[0], qty: "", unit: SM_UNITS[0], date: "" })
  const submit = () => { if (!f.qty||!f.date) return alert("Please fill all required fields."); if (f.from===f.to) return alert("Source and destination must be different."); setTransfers(p => [{ id: `TR-${String(p.length+1).padStart(3,"0")}`, ...f, status: "Pending", approvedBy: "—" }, ...p]); setShow(false); reset() }
  const updateStatus = (id: string, status: string, extra = {}) => setTransfers(p => p.map(x => x.id===id ? { ...x, status, ...extra } : x))

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard label="Total Transfers"  value={transfers.length}                                     color="blue"   />
        <StatCard label="Pending Approval" value={transfers.filter(t=>t.status==="Pending").length}    meta="Needs Action" color="yellow" />
        <StatCard label="Completed"        value={transfers.filter(t=>t.status==="Completed").length}  color="green"  />
        <StatCard label="Cancelled"        value={transfers.filter(t=>t.status==="Cancelled").length}  color="red"    />
      </div>
      <SecHeader title="Stock Transfer" sub="Move stock between branches with owner approval" cta={<button className={aBtn("primary")} onClick={() => setShow(true)}>+ New Transfer</button>} />
      <FilterRow>{["All","Pending","Completed","Cancelled"].map(fl => <Chip key={fl} label={fl} active={filter===fl} onClick={() => setFilter(fl)} />)}</FilterRow>
      <DataTable cols={["TR #","From","To","Item","Qty","Date","Status","Approved By","Actions"]} emptyHint="No transfers recorded yet."
        rows={transfers.filter(t => filter==="All"||t.status===filter).map(t => (
          <tr key={t.id} className="border-b border-gray-50 last:border-none hover:bg-gray-50 transition-colors">
            <td className="px-3.5 py-2.5 text-[12.5px] font-bold text-gray-900">{t.id}</td>
            <td className={tdCls}>{t.from}</td><td className={tdCls}>{t.to}</td><td className={tdCls}>{t.item}</td>
            <td className="px-3.5 py-2.5 text-[12.5px] font-semibold text-gray-700">{t.qty} {t.unit}</td>
            <td className={tdCls}>{t.date}</td>
            <td className="px-3.5 py-2.5"><span className={statusBadge(t.status)}>{t.status}</span></td>
            <td className="px-3.5 py-2.5 text-[12.5px]" style={{ color: t.approvedBy==="—"?"#9ca3af":"#374151" }}>{t.approvedBy}</td>
            <td className="px-3.5 py-2.5">
              {t.status==="Pending" && <div className="flex gap-1.5"><button className={aBtn("ok")} onClick={() => updateStatus(t.id,"Completed",{approvedBy:"Owner"})}>Approve</button><button className={aBtn("del")} onClick={() => updateStatus(t.id,"Cancelled")}>Cancel</button></div>}
            </td>
          </tr>
        ))}
      />
      {show && (
        <Modal title="New Stock Transfer" onClose={() => { setShow(false); reset() }}
          footer={<><button className={aBtn("ghost")} onClick={() => { setShow(false); reset() }}>Discard</button><button className={aBtn("primary")} onClick={submit}>Submit Transfer</button></>}>
          <div className="grid grid-cols-2 gap-2.5">
            <FSel label="From Branch" opts={BRANCHES}  value={f.from} onChange={e => setF(p => ({ ...p, from: e.target.value }))} />
            <FSel label="To Branch"   opts={BRANCHES}  value={f.to}   onChange={e => setF(p => ({ ...p, to:   e.target.value }))} />
          </div>
          <FSel label="Item" opts={ITEMS} value={f.item} onChange={e => setF(p => ({ ...p, item: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2.5">
            <FI   label="Quantity" type="number" placeholder="e.g. 20" value={f.qty}  onChange={e => setF(p => ({ ...p, qty:  e.target.value }))} />
            <FSel label="Unit"     opts={SM_UNITS}                      value={f.unit} onChange={e => setF(p => ({ ...p, unit: e.target.value }))} />
          </div>
          <FI label="Transfer Date" type="date" value={f.date} onChange={e => setF(p => ({ ...p, date: e.target.value }))} />
        </Modal>
      )}
    </div>
  )
}

function StockAdjustment() {
  const [adjustments, setAdjustments] = useState(() => loadLS<any[]>("sm_adjustments", []))
  const [show,   setShow]   = useState(false)
  const [filter, setFilter] = useState("All")
  const [f, setF] = useState({ branch: BRANCHES[0] as string, item: ITEMS[0] as string, qty: "", unit: SM_UNITS[0] as string, reason: REASONS[0] as string, date: "", by: "" })

  useEffect(() => { saveLS("sm_adjustments", adjustments) }, [adjustments])

  const reset  = () => setF({ branch: BRANCHES[0], item: ITEMS[0], qty: "", unit: SM_UNITS[0], reason: REASONS[0], date: "", by: "" })
  const submit = () => { if (!f.qty||!f.date||!f.by) return alert("Please fill all required fields."); setAdjustments(p => [{ id: `ADJ-${String(p.length+1).padStart(3,"0")}`, ...f, qty: parseFloat(f.qty)*-1 }, ...p]); setShow(false); reset() }

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard label="Total Adjustments" value={adjustments.length}                                                           color="blue"   />
        <StatCard label="Spoilage"           value={adjustments.filter(a=>a.reason==="Spoilage").length}                         color="yellow" />
        <StatCard label="Damaged"            value={adjustments.filter(a=>a.reason==="Damaged").length}                          color="red"    />
        <StatCard label="Other Reasons"      value={adjustments.filter(a=>a.reason!=="Spoilage"&&a.reason!=="Damaged").length}   color="blue"   />
      </div>
      <SecHeader title="Stock Adjustment" sub="Record spoilage, damage, theft, and manual corrections" cta={<button className={aBtn("primary")} onClick={() => setShow(true)}>+ New Adjustment</button>} />
      <FilterRow>{["All",...REASONS].map(fl => <Chip key={fl} label={fl} active={filter===fl} onClick={() => setFilter(fl)} />)}</FilterRow>
      <DataTable cols={["ADJ #","Branch","Item","Adjustment","Reason","Date","Recorded By"]} emptyHint="No adjustments recorded yet."
        rows={adjustments.filter(a => filter==="All"||a.reason===filter).map(a => (
          <tr key={a.id} className="border-b border-gray-50 last:border-none hover:bg-gray-50 transition-colors">
            <td className="px-3.5 py-2.5 text-[12.5px] font-bold text-gray-900">{a.id}</td>
            <td className={tdCls}>{a.branch}</td><td className={tdCls}>{a.item}</td>
            <td className="px-3.5 py-2.5 text-[12.5px] font-bold" style={{ color: a.qty<0?"#dc2626":"#16a34a" }}>{a.qty>0?"+":""}{a.qty} {a.unit}</td>
            <td className="px-3.5 py-2.5"><span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-yellow-50 text-yellow-600">{a.reason}</span></td>
            <td className={tdCls}>{a.date}</td><td className={tdCls}>{a.by}</td>
          </tr>
        ))}
      />
      {show && (
        <Modal title="New Stock Adjustment" onClose={() => { setShow(false); reset() }}
          footer={<><button className={aBtn("ghost")} onClick={() => { setShow(false); reset() }}>Discard</button><button className={aBtn("primary")} onClick={submit}>Save Adjustment</button></>}>
          <div className="grid grid-cols-2 gap-2.5">
            <FSel label="Branch" opts={BRANCHES} value={f.branch} onChange={e => setF(p => ({ ...p, branch: e.target.value }))} />
            <FSel label="Item"   opts={ITEMS}    value={f.item}   onChange={e => setF(p => ({ ...p, item:   e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <FI   label="Qty (deducted)" type="number" placeholder="e.g. 3" value={f.qty}  onChange={e => setF(p => ({ ...p, qty:  e.target.value }))} />
            <FSel label="Unit"           opts={SM_UNITS}                     value={f.unit} onChange={e => setF(p => ({ ...p, unit: e.target.value }))} />
          </div>
          <FSel label="Reason"      opts={REASONS} value={f.reason} onChange={e => setF(p => ({ ...p, reason: e.target.value }))} />
          <FI   label="Date"        type="date"    value={f.date}   onChange={e => setF(p => ({ ...p, date:   e.target.value }))} />
          <FI   label="Recorded By" placeholder="Staff name" value={f.by} onChange={e => setF(p => ({ ...p, by: e.target.value }))} />
        </Modal>
      )}
    </div>
  )
}

function StockLogs() {
  const [logs]   = useState(() => loadLS<any[]>("sm_logs", []))
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("All")
  const filtered = logs.filter(l => { const s = search.toLowerCase(); return (l.item.toLowerCase().includes(s)||l.ref.toLowerCase().includes(s)||l.by.toLowerCase().includes(s)) && (filter==="All"||l.type===filter) })

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard label="Total Entries" value={logs.length}                                       color="blue"  />
        <StatCard label="Stock In"      value={logs.filter(l=>l.type==="Stock In").length}    color="green" />
        <StatCard label="Transfers"     value={logs.filter(l=>l.type==="Transfer").length}    color="blue"  />
        <StatCard label="Adjustments"   value={logs.filter(l=>l.type==="Adjustment").length}  color="red"   />
      </div>
      <SecHeader title="Stock Logs" sub="Complete audit trail of all stock movements" />
      <FilterRow>
        <SearchInput value={search} onChange={setSearch} placeholder="Search item, reference, staff…" />
        {["All","Stock In","Transfer","Adjustment"].map(fl => <Chip key={fl} label={fl} active={filter===fl} onClick={() => setFilter(fl)} />)}
      </FilterRow>
      <DataTable cols={["Date","Type","Item","Quantity","Branch","By","Reference"]} emptyHint="No log entries yet."
        rows={filtered.map(l => (
          <tr key={l.id} className="border-b border-gray-50 last:border-none hover:bg-gray-50 transition-colors">
            <td className="px-3.5 py-2.5 text-[12.5px] text-gray-400">{l.date}</td>
            <td className="px-3.5 py-2.5"><span className={typeBadge(l.type)}>{l.type}</span></td>
            <td className="px-3.5 py-2.5 text-[12.5px] font-medium text-gray-700">{l.item}</td>
            <td className="px-3.5 py-2.5 text-[12.5px] font-bold" style={{ color: l.qty.startsWith("+")?"#16a34a":"#dc2626" }}>{l.qty}</td>
            <td className={tdCls}>{l.branch}</td>
            <td className="px-3.5 py-2.5 text-[12.5px] text-gray-400">{l.by}</td>
            <td className="px-3.5 py-2.5 text-[12.5px] font-semibold text-indigo-500">{l.ref}</td>
          </tr>
        ))}
      />
    </div>
  )
}

function StockMovementTab() {
  const [activeTab, setActiveTab] = useState<SMTabKey>("po")
  const TAB_MAP = { po: PurchaseOrders, stockin: StockIn, transfer: StockTransfer, adjustment: StockAdjustment, logs: StockLogs }
  const ActiveComponent = TAB_MAP[activeTab]
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
      <div className="mb-6">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Stock Movement</p>
        <h2 className="text-xl font-bold text-gray-900">Movement Records</h2>
        <p className="text-gray-500 text-sm mt-1">Purchase orders, deliveries, transfers, adjustments, and audit logs.</p>
      </div>
      <div className="flex border-b border-gray-100 mb-5">
        {SM_TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-[12.5px] font-semibold border-none bg-transparent cursor-pointer transition-colors -mb-px border-b-2 ${activeTab===tab.key?"text-gray-900 border-gray-800":"text-gray-400 border-transparent hover:text-gray-600 hover:bg-gray-50 rounded-t-md"}`}>
            {tab.label}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }} transition={{ duration:0.18 }}>
          <ActiveComponent />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

const DEFAULT_ITEMS: InventoryItem[] = [
  { id:1, name:"Chicken Breast", category:"Main",        image:"/img/placeholder.jpg", incoming:50,  stock:120, price:"₱250", unit:"kg"     as UnitType, totalUsedToday:0, batches:[{id:"batch-1",productId:1,quantity:30,unit:"kg"     as UnitType,receivedAt:new Date(Date.now()-2*86400000),status:"active"},{id:"batch-2",productId:1,quantity:25,unit:"kg"     as UnitType,receivedAt:new Date(Date.now()-86400000),status:"active"}] },
  { id:2, name:"Rice",           category:"Ingredients", image:"/img/placeholder.jpg", incoming:100, stock:500, price:"₱40",  unit:"kg"     as UnitType, totalUsedToday:0, batches:[{id:"batch-3",productId:2,quantity:50,unit:"kg"     as UnitType,receivedAt:new Date(),status:"active"}] },
  { id:3, name:"Coke 2L",        category:"Beverages",   image:"/img/placeholder.jpg", incoming:20,  stock:45,  price:"₱85",  unit:"bottle" as UnitType, totalUsedToday:0, batches:[{id:"batch-4",productId:3,quantity:12,unit:"bottle" as UnitType,receivedAt:new Date(Date.now()-3*86400000),status:"active"},{id:"batch-5",productId:3,quantity:15,unit:"bottle" as UnitType,receivedAt:new Date(),status:"active"}] },
  { id:4, name:"Cooking Oil",    category:"Ingredients", image:"/img/placeholder.jpg", incoming:15,  stock:80,  price:"₱180", unit:"bottle" as UnitType, totalUsedToday:0, batches:[{id:"batch-6",productId:4,quantity:8, unit:"bottle" as UnitType,receivedAt:new Date(Date.now()-5*86400000),status:"active"}] },
  { id:5, name:"Egg",            category:"Ingredients", image:"/img/placeholder.jpg", incoming:30,  stock:120, price:"₱8",   unit:"piece"  as UnitType, totalUsedToday:0, batches:[{id:"batch-7",productId:5,quantity:60,unit:"piece"  as UnitType,receivedAt:new Date(Date.now()-86400000),status:"active"}] },
]

export default function Inventory() {
  const now = useNow()
  const [pageTab,        setPageTab]        = useState<"inventory"|"movement">("inventory")
  const [loading,        setLoading]        = useState(true)
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(DEFAULT_ITEMS)

  const normalizeBatches = (batches: Batch[]) => batches.map(b => ({ ...b, receivedAt: new Date(b.receivedAt), expiresAt: b.expiresAt ? new Date(b.expiresAt) : undefined }))

  const loadInventory = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true)
      const data = await apiCall("/inventory", { method: "GET" }) as any[] | null
      if (!Array.isArray(data)) return
      const relevant = data.filter(item => { const promo = String(item?.promo??"").toUpperCase().trim(); const cat = String(item?.category??"").toLowerCase().trim(); return promo==="SUPPLIES"||promo==="MENU FOOD"||cat.includes("suppl")||cat.includes("menu food") })
      const byName = new Map<string, any>()
      for (const item of relevant) { const key = String(item?.product_name??item?.name??"").trim().toLowerCase(); const prev = byName.get(key); const prevId = Number(prev?.product_id??prev?.id??prev?.inventory_id??0); const currId = Number(item?.product_id??item?.id??item?.inventory_id??0); if (!prev||currId>prevId) byName.set(key, item) }
      setInventoryItems(Array.from(byName.values()).map(item => ({ id:Number(item.id??item.product_id??item.inventory_id??0), name:item.name||item.product_name||"Unnamed Product", category:item.category||"Uncategorized", image:item.image||"/img/placeholder.jpg", incoming:0, stock:Number(item.quantity??item.stock??item.dailyWithdrawn??0), price:item.price?.toString()||"0", unit:(item.unit as UnitType)||"piece", batches:normalizeBatches(item.batches||[]), totalUsedToday:0 })))
    } catch (err) { console.error("Failed to load inventory:", err) }
    finally { if (showLoader) setLoading(false) }
  }

  useEffect(() => { loadInventory() }, [])

  const handleAddProduct = async (productData: Partial<InventoryItem> & { description?: string }) => {
    try {
      const created = await api.post<{ id?: number }>("/products", { name:productData.name, category:productData.category, price:productData.price, unit:productData.unit, quantity:productData.stock??0, description:productData.description??null, image:productData.image||"/img/placeholder.jpg" })
      setInventoryItems(prev => [{ id:Number(created?.id??Date.now()), name:String(productData.name??"Unnamed Product"), category:String(productData.category??"Uncategorized"), image:String(productData.image??"/img/placeholder.jpg"), incoming:0, stock:Number(productData.stock??0), price:String(productData.price??"0"), unit:(productData.unit as UnitType)||"piece", batches:[], totalUsedToday:0 }, ...prev])
      void loadInventory(false)
      alert("Product added successfully!")
    } catch (err) { alert(`Failed to add product: ${err instanceof Error ? err.message : "Unknown error"}`) }
  }

  const handleDeleteProduct = async (productId: number) => {
    try { await apiCall(`/products/${productId}`, { method:"DELETE" }); setInventoryItems(prev => prev.filter(item => item.id!==productId)); alert("Product deleted successfully!") }
    catch (err) { alert(`Failed to delete product: ${err instanceof Error ? err.message : "Unknown error"}`) }
  }

  const totalStock   = inventoryItems.reduce((s, i) => s + i.stock, 0)
  const totalBatches = inventoryItems.reduce((s, i) => s + (i.batches?.length||0), 0)

  return (
    <div className="flex min-h-screen bg-gray-50 font-['Poppins',sans-serif]">
      <Sidebar />
      <main className="flex-1 p-8 pl-24">

        <motion.div initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }} className="mb-2 flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Management</p>
            <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
          </div>
          <div className="flex flex-col items-end select-none">
            <p className="text-base font-semibold text-gray-700 tabular-nums">{now.toLocaleTimeString("en-PH", { hour:"2-digit", minute:"2-digit", second:"2-digit" })}</p>
            <p className="text-xs text-gray-400 mt-0.5">{now.toLocaleDateString("en-PH", { weekday:"long", month:"long", day:"numeric", year:"numeric" })}</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1, duration:0.3 }} className="flex justify-center mb-8">
          <div className="inline-flex bg-gray-100 rounded-[14px] p-1 gap-0.5">
            {(["inventory","movement"] as const).map(key => (
              <button key={key} onClick={() => setPageTab(key)} className={`relative px-7 py-2.5 text-[13px] font-semibold rounded-[10px] border-none cursor-pointer transition-colors z-[1] whitespace-nowrap ${pageTab===key?"text-gray-900":"text-gray-400 bg-transparent hover:text-gray-600"}`}>
                {pageTab===key && <motion.span layoutId="pageTabSlider" transition={{ type:"spring", stiffness:400, damping:34 }} className="absolute inset-0 bg-white rounded-[10px] shadow-[0_1px_6px_rgba(0,0,0,0.10),0_0_0_1px_rgba(0,0,0,0.04)] -z-[1]" />}
                {key==="inventory" ? "Inventory" : "Stock Movement"}
              </button>
            ))}
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {pageTab==="inventory" && (
            <motion.div key="inventory" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }} transition={{ duration:0.22 }}>
              <div className="grid grid-cols-3 gap-5 mb-8">
                {[
                  { label:"Total Products", value:inventoryItems.length, icon:<Package   className="w-5 h-5" />, color:"bg-blue-50 text-blue-600 border-blue-100"         },
                  { label:"Total Stock",    value:totalStock,             icon:<Archive   className="w-5 h-5" />, color:"bg-emerald-50 text-emerald-600 border-emerald-100" },
                  { label:"Active Batches", value:totalBatches,           icon:<RefreshCw className="w-5 h-5" />, color:"bg-orange-50 text-orange-600 border-orange-100"    },
                ].map((stat, i) => (
                  <motion.div key={stat.label} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.07 }} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${stat.color}`}>{stat.icon}</div>
                    <div><p className="text-2xl font-bold text-gray-900">{stat.value}</p><p className="text-xs text-gray-400 mt-0.5">{stat.label}</p></div>
                  </motion.div>
                ))}
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                <AnimatePresence mode="wait">
                  {loading
                    ? <motion.div key="loading" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} className="flex flex-col items-center justify-center py-24 gap-4"><motion.div className="w-12 h-12 rounded-full border-4 border-gray-200 border-t-blue-500" animate={{ rotate:360 }} transition={{ repeat:Infinity, duration:0.9, ease:"linear" }} /><p className="text-gray-400 text-sm">Loading inventory...</p></motion.div>
                    : <motion.div key="content" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.3 }}><InventoryClient items={inventoryItems} onAddProduct={handleAddProduct} onDeleteProduct={handleDeleteProduct} /></motion.div>
                  }
                </AnimatePresence>
              </div>

              <div className="grid grid-cols-3 gap-5 mt-6">
                {[
                  { desc:"Each batch is tracked with a timestamp. When consuming products, the oldest batch is used first (FIFO).", border:"border-blue-200",    bg:"bg-blue-50",    text:"text-blue-800"    },
                  { desc:"Click 'Add Batch' to input new product quantities. Optional expiry dates can be set for tracking.",        border:"border-emerald-200", bg:"bg-emerald-50", text:"text-emerald-800" },
                  { desc:"At end of day, return unused batches. Returned quantity is sent back to main inventory.",                   border:"border-orange-200",  bg:"bg-orange-50",  text:"text-orange-800"  },
                ].map((card, i) => (
                  <motion.div key={i} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1+i*0.07 }} className={`${card.bg} border ${card.border} rounded-2xl p-5`}>
                    <p className={`text-sm ${card.text} leading-relaxed`}>{card.desc}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {pageTab==="movement" && (
            <motion.div key="movement" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }} transition={{ duration:0.22 }}>
              <StockMovementTab />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}