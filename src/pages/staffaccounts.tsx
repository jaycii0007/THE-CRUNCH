import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "@/components/Sidebar";
import { staffApi } from "../lib/api";
import type { StaffMember } from "../lib/api";
import { useNotifications } from "../lib/NotificationContext";

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = "administrator" | "cashier" | "cook" | "inventory_manager";
interface FormState {
  name: string;
  email: string;
  password: string;
  role: Role;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLES: Role[] = ["administrator", "cashier", "cook", "inventory_manager"];

const ROLE_LABEL: Record<Role, string> = {
  administrator: "Admin",
  cashier: "Cashier",
  cook: "Cook",
  inventory_manager: "Inventory Mgr",
};

const AVATAR_PALETTE: [string, string][] = [
  ["#fde8e8", "#c0392b"],
  ["#e8f8ee", "#27ae60"],
  ["#fef6e4", "#f39c12"],
  ["#eaf3fb", "#2980b9"],
  ["#f0eef8", "#6c5ce7"],
];

const DEFAULT_FORM: FormState = {
  name: "",
  email: "",
  password: "",
  role: "cashier",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAvatarColor(name: string): [string, string] {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[h];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null && "message" in err) {
    const maybeMessage = (err as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim())
      return maybeMessage;
  }
  return fallback;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StaffAccounts() {
  const { addNotification } = useNotifications();
  const [employees, setEmployees] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    setIsLoading(true);
    staffApi
      .getAll()
      .then(setEmployees)
      .catch(() => addNotification({ id: crypto.randomUUID(), type: "error", label: "Failed to load staff accounts." }))
      .finally(() => setIsLoading(false));
  }, [addNotification]);

  const activeCount = employees.length;

  const stats = [
    { label: "Total", value: employees.length },
    { label: "Active", value: activeCount },
    { label: "Inactive", value: 0 },
    ...ROLES.filter((r) => employees.some((e) => e.role === r)).map((r) => ({
      label: ROLE_LABEL[r],
      value: employees.filter((e) => e.role === r).length,
    })),
  ];

  const handleAdd = async (): Promise<void> => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      addNotification({ id: crypto.randomUUID(), type: "warning", label: "Name, email, and password are required." });
      return;
    }
    setIsLoading(true);
    try {
      await staffApi.create({
        username: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
      });
      const updated = await staffApi.getAll();
      setEmployees(updated);
      setForm(DEFAULT_FORM);
      setError("");
      setShowModal(false);
      addNotification({ id: crypto.randomUUID(), type: "success", label: "Staff account created successfully." });
    } catch (err: unknown) {
      addNotification({ id: crypto.randomUUID(), type: "error", label: getErrorMessage(err, "Failed to create account.") });
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = (): void => {
    setShowModal(false);
    setForm(DEFAULT_FORM);
    setError("");
  };

  const handleRemove = async (id: number): Promise<void> => {
    if (!confirm("Delete this account?")) return;
    try {
      await staffApi.delete(id);
      setEmployees((prev) => prev.filter((e) => e.id !== id));
      addNotification({ id: crypto.randomUUID(), type: "success", label: "Staff account deleted." });
    } catch (err: unknown) {
      addNotification({ id: crypto.randomUUID(), type: "error", label: getErrorMessage(err, "Failed to delete account.") });
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fff",
        fontFamily: "'Poppins', sans-serif",
        color: "#1a202c",
      }}
    >
      <Sidebar />

      <div style={{ padding: "32px 36px 32px 88px" }}>
        {/* Poppins font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "#1a202c",
                lineHeight: 1.2,
              }}
            >
              Staff Accounts
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 400,
                color: "#a0aec0",
                marginTop: 3,
              }}
            >
              Manage employee access and roles
            </div>
          </div>
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "#1a202c",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "'Poppins', sans-serif",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
            onClick={() => setShowModal(true)}
          >
            + Add Employee
          </button>
        </div>

        {/* Stats */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 28,
            marginBottom: 24,
            paddingBottom: 20,
            borderBottom: "1px solid #f0f4f8",
          }}
        >
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              style={{ display: "flex", flexDirection: "column", gap: 4 }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: i * 0.04 }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#a0aec0",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 500,
                  color: "#2d3748",
                  lineHeight: 1,
                }}
              >
                {s.value}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Table */}
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: "1px solid #e2e8f0",
            overflow: "hidden",
          }}
        >
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
          >
            <thead>
              <tr>
                {["#", "Employee", "Role", "Email", "ID", "Status", ""].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 18px",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#a0aec0",
                        letterSpacing: "0.07em",
                        textTransform: "uppercase",
                        borderBottom: "1px solid #e2e8f0",
                      }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      textAlign: "center",
                      padding: "64px 20px",
                      fontSize: 13,
                      color: "#94a3b8",
                    }}
                  >
                    Loading staff accounts...
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      textAlign: "center",
                      padding: "64px 20px",
                      fontSize: 13,
                      color: "#cbd5e0",
                    }}
                  >
                    No employees yet. Add one above.
                  </td>
                </tr>
              ) : (
                <AnimatePresence initial={false}>
                  {employees.map((emp, i) => {
                    const [avBg, avFg] = getAvatarColor(emp.username);
                    const role = ROLES.includes(emp.role as Role)
                      ? (emp.role as Role)
                      : null;
                    return (
                      <motion.tr
                        key={emp.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        style={{ borderBottom: "1px solid #f0f4f8" }}
                      >
                        <td
                          style={{
                            padding: "13px 18px",
                            verticalAlign: "middle",
                            fontSize: 12,
                            color: "#cbd5e0",
                            width: 32,
                          }}
                        >
                          {i + 1}
                        </td>
                        <td
                          style={{
                            padding: "13px 18px",
                            verticalAlign: "middle",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11,
                                fontWeight: 700,
                                flexShrink: 0,
                                background: avBg,
                                color: avFg,
                              }}
                            >
                              {getInitials(emp.username)}
                            </div>
                            <span
                              style={{
                                fontWeight: 600,
                                color: "#2d3748",
                                fontSize: 13,
                              }}
                            >
                              {emp.username}
                            </span>
                          </div>
                        </td>
                        <td
                          style={{
                            padding: "13px 18px",
                            verticalAlign: "middle",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              fontSize: 11,
                              fontWeight: 600,
                              padding: "3px 10px",
                              borderRadius: 6,
                              background: "#f0f4f8",
                              color: "#4a5568",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {role ? ROLE_LABEL[role] : emp.role}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "13px 18px",
                            verticalAlign: "middle",
                            fontSize: 12,
                            color: "#a0aec0",
                          }}
                        >
                          {emp.email}
                        </td>
                        <td
                          style={{
                            padding: "13px 18px",
                            verticalAlign: "middle",
                            fontSize: 11,
                            color: "#cbd5e0",
                            fontFamily: "monospace",
                          }}
                        >
                          {emp.id}
                        </td>
                        <td
                          style={{
                            padding: "13px 18px",
                            verticalAlign: "middle",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 12,
                              fontWeight: 500,
                              color: "#276749",
                            }}
                          >
                            <span
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: "50%",
                                flexShrink: 0,
                                background: "#38a169",
                              }}
                            />
                            Active
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "13px 18px",
                            verticalAlign: "middle",
                          }}
                        >
                          <button
                            style={{
                              background: "none",
                              border: "1px solid #fed7d7",
                              borderRadius: 7,
                              padding: "5px 13px",
                              fontSize: 11,
                              fontWeight: 500,
                              fontFamily: "'Poppins', sans-serif",
                              color: "#fc8181",
                              cursor: "pointer",
                            }}
                            onClick={() => void handleRemove(emp.id)}
                          >
                            Remove
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal */}
        <AnimatePresence>
          {showModal && (
            <motion.div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 200,
                padding: 20,
                backdropFilter: "blur(2px)",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => {
                if (e.target === e.currentTarget) closeModal();
              }}
            >
              <motion.div
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  padding: 28,
                  width: "100%",
                  maxWidth: 360,
                  boxShadow: "0 8px 40px rgba(0,0,0,0.10)",
                  border: "1px solid #e2e8f0",
                }}
                initial={{ opacity: 0, scale: 0.97, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 8 }}
                transition={{ duration: 0.18 }}
              >
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#1a202c",
                    marginBottom: 20,
                  }}
                >
                  Add Employee
                </div>

                <div style={{ marginBottom: 13 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#718096",
                      marginBottom: 5,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Full Name
                  </label>
                  <input
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      fontSize: 13,
                      fontFamily: "'Poppins', sans-serif",
                      background: "#f8f9fa",
                      color: "#2d3748",
                      outline: "none",
                    }}
                    type="text"
                    value={form.name}
                    placeholder="e.g. Maria Santos"
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </div>

                <div style={{ marginBottom: 13 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#718096",
                      marginBottom: 5,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Email
                  </label>
                  <input
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      fontSize: 13,
                      fontFamily: "'Poppins', sans-serif",
                      background: "#f8f9fa",
                      color: "#2d3748",
                      outline: "none",
                    }}
                    type="email"
                    value={form.email}
                    placeholder="e.g. maria@thecrunch.com"
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                </div>

                <div style={{ marginBottom: 13 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#718096",
                      marginBottom: 5,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Password
                  </label>
                  <input
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      fontSize: 13,
                      fontFamily: "'Poppins', sans-serif",
                      background: "#f8f9fa",
                      color: "#2d3748",
                      outline: "none",
                    }}
                    type="password"
                    value={form.password}
                    placeholder="Password" 
                    onChange={(e) =>
                      setForm((f) => ({ ...f, password: e.target.value }))
                    }
                  />
                </div>

                <div style={{ marginBottom: 13 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#718096",
                      marginBottom: 5,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Role
                  </label>
                  <select
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      fontSize: 13,
                      fontFamily: "'Poppins', sans-serif",
                      background: "#f8f9fa",
                      color: "#2d3748",
                      outline: "none",
                    }}
                    value={form.role}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, role: e.target.value as Role }))
                    }
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </div>

                {error && (
                  <p
                    style={{
                      fontSize: 11,
                      color: "#e53e3e",
                      margin: "4px 0 6px",
                    }}
                  >
                    {error}
                  </p>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                  <button
                    style={{
                      flex: 1,
                      background: "#f8f9fa",
                      color: "#718096",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      padding: 10,
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: "'Poppins', sans-serif",
                      cursor: "pointer",
                    }}
                    onClick={closeModal}
                  >
                    Cancel
                  </button>
                  <button
                    style={{
                      flex: 1,
                      background: "#1a202c",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      padding: 10,
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: "'Poppins', sans-serif",
                      cursor: "pointer",
                    }}
                    onClick={() => void handleAdd()}
                  >
                    Add Employee
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
