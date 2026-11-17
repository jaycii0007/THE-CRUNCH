import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, CreditCard, Package, ShieldCheck, UsersRound } from "lucide-react";
import { SkeletonTableRow } from "@/components/ui/skeleton";
import { Sidebar } from "@/components/Sidebar";
import GradientBlobCard from "@/components/ui/gradient-bold-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { staffApi } from "../lib/api";
import type { StaffMember } from "../lib/api";
import { useNotifications, useConfirm } from "../lib/NotificationContext";
import { useAuth } from "../context/authcontext";
import { useViewport } from "@/hooks/use-tablet";
import "./staffaccounts.css";

// ─── Types ───────────────────────────────────────────────────────────────────
type Role = "administrator" | "cashier" | "inventory_manager";
type RoleFilter = Role | "all";
type NotificationType = "error" | "warning" | "success";

interface FormState {
  name: string;
  email: string;
  password: string;
  role: Role;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const FIELD_MAX_LENGTH = 100;

const ROLES: Role[] = ["administrator", "cashier", "inventory_manager"];

const ROLE_LABEL: Record<Role, string> = {
  administrator: "Admin",
  cashier: "Cashier",
  inventory_manager: "Inventory Mgr",
};

const ROLE_COLORS: Record<Role, { bg: string; color: string }> = {
  administrator: { bg: "#edf2ff", color: "#3b5bdb" },
  cashier: { bg: "#e6fcf5", color: "#0ca678" },
  inventory_manager: { bg: "#f3f0ff", color: "#7048e8" },
};

// Used when the API returns a role this page does not know about
const FALLBACK_ROLE_COLOR = { bg: "#f0f4f8", color: "#4a5568" };

const AVATAR_COLORS: [string, string][] = [
  ["#fde8e8", "#c0392b"],
  ["#e8f8ee", "#27ae60"],
  ["#fef6e4", "#f39c12"],
  ["#eaf3fb", "#2980b9"],
  ["#f0eef8", "#6c5ce7"],
];

const TABLE_COLUMNS = ["#", "Employee", "Role", "Email", ""];

const DEFAULT_FORM: FormState = {
  name: "",
  email: "",
  password: "",
  role: "cashier",
};

const NAME_PATTERN = /^[A-Za-z][A-Za-z.' -]*[A-Za-z.]$|^[A-Za-z.]$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Picks a stable avatar color based on the employee's name
const getAvatarColor = (name: string): [string, string] => {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) % AVATAR_COLORS.length;
  }
  return AVATAR_COLORS[hash];
};

const getInitials = (name: string): string =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

// Safely reads the message from an unknown thrown value
const getMessage = (err: unknown): string | null => {
  if (typeof err !== "object" || err === null || !("message" in err))
    return null;
  const { message } = err as { message?: unknown };
  return typeof message === "string" && message.trim() ? message : null;
};

const getErrorMessage = (err: unknown, fallback: string): string =>
  getMessage(err) ?? fallback;

const isAuthError = (err: unknown): boolean => {
  const message = getMessage(err);
  return (
    message !== null &&
    /invalid or expired token|no token provided/i.test(message)
  );
};

// Cleans input as the user types, based on which field it belongs to
const sanitizeField = (key: keyof FormState, value: string): string => {
  switch (key) {
    case "name":
      return value.replace(/[^A-Za-z.' -]/g, "").slice(0, FIELD_MAX_LENGTH);
    case "email":
      return value.replace(/\s+/g, "").slice(0, FIELD_MAX_LENGTH);
    default:
      return value.slice(0, FIELD_MAX_LENGTH);
  }
};

// Returns an error message for the first invalid field, or "" if the form is valid
const validateForm = (form: FormState): string => {
  const name = form.name.trim();
  const email = form.email.trim().toLowerCase();
  const { password } = form;

  if (!name) return "Full name is required.";
  if (name.length < 2) return "Full name must be at least 2 characters.";
  if (name.length > FIELD_MAX_LENGTH)
    return "Full name must not exceed 100 characters.";
  if (!NAME_PATTERN.test(name) || !/[A-Za-z]/.test(name)) {
    return "Full name may only use letters, spaces, apostrophes, hyphens, and periods.";
  }

  if (!email) return "Email is required.";
  if (email.length > FIELD_MAX_LENGTH)
    return "Email must not exceed 100 characters.";
  if (!EMAIL_PATTERN.test(email)) return "Please enter a valid email address.";

  if (!password.trim()) return "Password is required.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > FIELD_MAX_LENGTH)
    return "Password must not exceed 100 characters.";
  if (!PASSWORD_PATTERN.test(password))
    return "Password must include at least 1 letter and 1 number.";

  if (!ROLES.includes(form.role)) return "Please select a valid role.";
  return "";
};

// ─── Subcomponents ───────────────────────────────────────────────────────────
function Avatar({ name }: { name: string }) {
  const [bg, fg] = getAvatarColor(name);
  return (
    <div
      className="sa-avatar"
      style={{
        width: 34,
        height: 34,
        borderRadius: "50%",
        background: bg,
        color: fg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors = ROLE_COLORS[role as Role] ?? FALLBACK_ROLE_COLOR;
  return (
    <span
      className="sa-badge"
      style={{
        background: colors.bg,
        color: colors.color,
        borderColor: `${colors.color}33`,
      }}
    >
      {ROLE_LABEL[role as Role] ?? role}
    </span>
  );
}

// Same KPI card as Menu Management: GradientBlobCard with orbiting glow.
function StatCard({
  label,
  value,
  meta,
  icon: Icon,
  featured = false,
}: {
  label: string;
  value: number;
  meta: string;
  icon: typeof UsersRound;
  featured?: boolean;
}) {
  return (
    <GradientBlobCard palette={featured ? "forest" : "brass"} className="rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <span
          className="text-[12px] font-medium"
          style={{ color: featured ? "rgba(255,255,255,0.7)" : "#655E52" }}
        >
          {label}
        </span>
        <span
          className="grid h-9 w-9 place-items-center rounded-xl"
          style={{ background: featured ? "rgba(255,255,255,0.12)" : "#EFE7D9" }}
        >
          <Icon
            size={17}
            strokeWidth={2}
            color={featured ? "#fff" : "#78512E"}
            aria-hidden="true"
          />
        </span>
      </div>
      <div
        className="text-[26px] font-semibold leading-none tracking-tight tabular-nums"
        style={{ color: featured ? "#fff" : "#1C1B17" }}
      >
        {value}
      </div>
      <div
        className="mt-2.5 text-[11.5px]"
        style={{ color: featured ? "rgba(255,255,255,0.65)" : "#655E52" }}
      >
        {meta}
      </div>
    </GradientBlobCard>
  );
}

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}

function FormField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: FormFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";

  return (
    <div className={`sa-field${isPassword ? " sa-field--password" : ""}`}>
      <label className="sa-label">{label}</label>
      <div style={{ position: "relative" }}>
        <input
          className="sa-input"
          type={isPassword && showPassword ? "text" : type}
          value={value}
          placeholder={placeholder}
          maxLength={FIELD_MAX_LENGTH}
          onChange={(e) => onChange(e.target.value)}
        />
        {isPassword && (
          <button
            type="button"
            className="sa-reveal"
            onClick={() => setShowPassword((show) => !show)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff size={15} strokeWidth={1.9} aria-hidden="true" />
            ) : (
              <Eye size={15} strokeWidth={1.9} aria-hidden="true" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// Radix select styled like Menu Management's .menu-dropdown — the native
// popup is OS-drawn and cannot be themed, so this replaces both page selects.
function RoleDropdown({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  // Radix reserves an empty value. Encode every option so "" never collides.
  return (
    <Select value={`v:${value}`} onValueChange={(next) => onChange(next.slice(2))}>
      <SelectTrigger
        aria-label={label}
        className="sa-select-trigger focus-visible:ring-0 focus-visible:border-[#78512E]"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        position="popper"
        align="start"
        collisionPadding={8}
        className="sa-select-list"
      >
        {options.map((option) => (
          <SelectItem key={option.value} value={`v:${option.value}`}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface StaffRowProps {
  employee: StaffMember;
  index: number;
  onRemove: (id: number, name: string) => void;
}function StaffRow({ employee, index, onRemove }: StaffRowProps) {
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <td className="sa-row-index">{index + 1}</td>
      <td>
        <div className="sa-employee">
          <Avatar name={employee.username} />
          <span>{employee.username}</span>
        </div>
      </td>
      <td>
        <RoleBadge role={employee.role} />
      </td>
      <td className="sa-email">{employee.email}</td>
      <td>
        <button
          className="sa-btn sa-btn--danger sa-btn--sm"
          onClick={() => onRemove(employee.id, employee.username)}
        >
          Remove
        </button>
      </td>
    </motion.tr>
  );
}

interface AddEmployeeModalProps {
  form: FormState;
  error: string;
  isSubmitting: boolean;
  isMobile: boolean;
  onFieldChange: (key: keyof FormState) => (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

function AddEmployeeModal({
  form,
  error,
  isSubmitting,
  isMobile,
  onFieldChange,
  onSubmit,
  onClose,
}: AddEmployeeModalProps) {
  return (
    <motion.div
      className="sa-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      // Close only when the backdrop itself is clicked, not the dialog
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        className="sa-modal"
        style={{ padding: isMobile ? 20 : 26 }}
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.18 }}
      >
        <div className="sa-modal-title">Add Employee</div>

        <FormField
          label="Full Name"
          value={form.name}
          onChange={onFieldChange("name")}
          placeholder="e.g. Maria Santos"
        />
        <FormField
          label="Email"
          value={form.email}
          onChange={onFieldChange("email")}
          type="email"
          placeholder="e.g. maria@thecrunch.com"
        />
        <FormField
          label="Password"
          value={form.password}
          onChange={onFieldChange("password")}
          type="password"
          placeholder="Min. 8 characters"
        />

        <div className="sa-field">
          <label className="sa-label">Role</label>
          <RoleDropdown
            label="Role"
            value={form.role}
            onChange={(next) => onFieldChange("role")(next)}
            options={ROLES.map((role) => ({
              value: role,
              label: ROLE_LABEL[role],
            }))}
          />
        </div>

        {error && <p className="sa-error">{error}</p>}

        <div className="sa-modal-actions">
          <button
            className="sa-btn sa-btn--ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            className="sa-btn sa-btn--primary"
            onClick={onSubmit}
            disabled={isSubmitting}
            style={{ cursor: isSubmitting ? "not-allowed" : "pointer" }}
          >
            {isSubmitting ? "Adding..." : "Add Employee"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function StaffAccounts() {
  const { addNotification } = useNotifications();
  const confirm = useConfirm();
  const { user, logout } = useAuth();
  const { isMobile, isTablet } = useViewport();

  const [employees, setEmployees] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<RoleFilter>("all");

  // ── Notifications ──────────────────────────────────────────────────────────
  const notify = useCallback(
    (type: NotificationType, label: string) => {
      addNotification({ id: crypto.randomUUID(), type, label });
    },
    [addNotification],
  );

  // Logs the user out if the session expired, otherwise shows the error.
  // Returns true when the error was an auth error.
  const handleApiError = useCallback(
    (err: unknown, fallback: string): boolean => {
      if (isAuthError(err)) {
        logout();
        notify("error", "Session expired. Please log in again.");
        return true;
      }
      notify("error", getErrorMessage(err, fallback));
      return false;
    },
    [logout, notify],
  );

  // ── Data loading ───────────────────────────────────────────────────────────
  const fetchStaff = useCallback(async () => {
    if (!user?.token) return;
    setIsLoading(true);
    try {
      setEmployees(await staffApi.getAll(user.token));
    } catch (err) {
      handleApiError(err, "Failed to load staff accounts.");
    } finally {
      setIsLoading(false);
    }
  }, [user?.token, handleApiError]);

  useEffect(() => {
    void fetchStaff();
  }, [fetchStaff]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const filteredEmployees = useMemo(() => {
    const query = search.toLowerCase();
    return employees.filter((employee) => {
      const matchesSearch =
        employee.username.toLowerCase().includes(query) ||
        employee.email.toLowerCase().includes(query);
      const matchesRole = filterRole === "all" || employee.role === filterRole;
      return matchesSearch && matchesRole;
    });
  }, [employees, search, filterRole]);

  const isFiltering = search !== "" || filterRole !== "all";

  // Only show validation errors after the user has tried to submit
  const formError = submitted ? validateForm(form) : "";

  // ── Modal handlers ─────────────────────────────────────────────────────────
  const closeModal = () => {
    setShowModal(false);
    setForm(DEFAULT_FORM);
    setSubmitted(false);
  };

  const updateField = (key: keyof FormState) => (value: string) => {
    setForm((current) => ({ ...current, [key]: sanitizeField(key, value) }));
  };

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    setSubmitted(true);

    const error = validateForm(form);
    if (error) {
      notify("warning", error);
      return;
    }
    if (!user?.token) return;

    setIsSubmitting(true);
    try {
      await staffApi.create(user.token, {
        username: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
      });
      await fetchStaff();
      closeModal();
      notify("success", "Staff account created.");
    } catch (err) {
      handleApiError(err, "Failed to create account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (id: number, name: string) => {
    const confirmed = await confirm({
      title: "Delete staff account?",
      message: (
        <>
          Permanently remove <strong>{name}</strong>'s account. This cannot be
          undone.
        </>
      ),
      confirmLabel: "Delete account",
      cancelLabel: "Cancel",
      danger: true,
    });
    if (!confirmed || !user?.token) return;

    try {
      await staffApi.delete(user.token, id);
      // Reload from the server so the list always matches the database
      await fetchStaff();
      notify("success", "Staff account deleted.");
    } catch (err) {
      handleApiError(err, "Failed to delete account.");
    }
  };

  // ── Layout ─────────────────────────────────────────────────────────────────
  const contentPadding = isMobile
    ? "78px 14px 22px 76px"
    : isTablet
      ? "84px 18px 28px 100px"
      : "112px 36px 32px 100px";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="sa-page min-h-screen">
      <div className="sa-atmosphere" aria-hidden="true" />
      <Sidebar />
      <link
        href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />

      <div className="sa-shell" style={{ padding: contentPadding }}>
        {/* Header */}
        <motion.div
          className="sa-header"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div>
            <span className="sa-wordmark">The Crunch</span>
            <h1 className="sa-title">Staff Accounts</h1>
            <p className="sa-subtitle">Manage employee access and roles</p>
          </div>
          <button
            className="sa-btn sa-btn--primary"
            onClick={() => setShowModal(true)}
          >
            + Add Employee
          </button>
        </motion.div>

        {/* Stats */}
        <div className="sa-stats">
          <StatCard
            featured
            label="Total"
            value={employees.length}
            meta="All staff accounts"
            icon={UsersRound}
          />
          <StatCard
            label="Admin"
            value={employees.filter((employee) => employee.role === "administrator").length}
            meta="Full access"
            icon={ShieldCheck}
          />
          <StatCard
            label="Cashier"
            value={employees.filter((employee) => employee.role === "cashier").length}
            meta="Point of sale"
            icon={CreditCard}
          />
          <StatCard
            label="Inventory Mgr"
            value={employees.filter((employee) => employee.role === "inventory_manager").length}
            meta="Stock & products"
            icon={Package}
          />
        </div>

        {/* Search and role filter */}
        <div className="sa-filters">
          <input
            className="sa-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            aria-label="Search employees"
          />
          <RoleDropdown
            label="Filter by role"
            value={filterRole}
            onChange={(next) => setFilterRole(next as RoleFilter)}
            options={[
              { value: "all", label: "All Roles" },
              ...ROLES.map((role) => ({
                value: role,
                label: ROLE_LABEL[role],
              })),
            ]}
          />
        </div>

        {/* Staff table */}
        <div className="sa-table-card">
          <table className="sa-table">
            <thead>
              <tr>
                {TABLE_COLUMNS.map((heading, i) => (
                  <th key={`${heading}-${i}`}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }, (_, index) => (
                  <SkeletonTableRow key={index} columnCount={7} theme="admin" />
                ))
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td className="sa-empty" colSpan={TABLE_COLUMNS.length}>
                    {isFiltering
                      ? "No results match your search."
                      : "No employees yet. Add one above."}
                  </td>
                </tr>
              ) : (
                <AnimatePresence initial={false}>
                  {filteredEmployees.map((employee, index) => (
                    <StaffRow
                      key={employee.id}
                      employee={employee}
                      index={index}
                      onRemove={(id, name) => void handleRemove(id, name)}
                    />
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>

        {/* Add employee modal */}
        <AnimatePresence>
          {showModal && (
            <AddEmployeeModal
              form={form}
              error={formError}
              isSubmitting={isSubmitting}
              isMobile={isMobile}
              onFieldChange={updateField}
              onSubmit={() => void handleAdd()}
              onClose={closeModal}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
