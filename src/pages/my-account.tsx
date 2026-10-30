import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Save, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/context/authcontext";
import { api } from "@/lib/api";
import { normalizeRole } from "@/lib/permissions";

interface OwnAccount {
  id: number;
  username: string;
  email: string;
  role: string;
}

type Notice = { tone: "success" | "error"; text: string } | null;

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,100}$/;
const HOME_BY_ROLE: Record<string, string> = {
  administrator: "/dashboard",
  cashier: "/menu",
  inventory_manager: "/inventory",
  customer: "/products",
};

function roleLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function PasswordField({
  id,
  label,
  value,
  visible,
  autoComplete,
  onChange,
  onToggle,
}: {
  id: string;
  label: string;
  value: string;
  visible: boolean;
  autoComplete: string;
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <span className="relative block">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          maxLength={100}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition focus:border-slate-700 focus:ring-4 focus:ring-slate-200"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
    </label>
  );
}

export default function MyAccount() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [account, setAccount] = useState<OwnAccount | null>(null);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileNotice, setProfileNotice] = useState<Notice>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<Notice>(null);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [visiblePasswords, setVisiblePasswords] = useState({ current: false, next: false, confirm: false });

  const loadAccount = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.get<OwnAccount>("/users/me");
      setAccount(data);
      setUsername(data.username);
      updateUser({ username: data.username, email: data.email, role: data.role });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "We could not load your account.");
    } finally {
      setLoading(false);
    }
  }, [updateUser]);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    const cleanUsername = username.trim();
    if (cleanUsername.length < 2 || cleanUsername.length > 100) {
      setProfileNotice({ tone: "error", text: "Display name must be between 2 and 100 characters." });
      return;
    }
    setProfileBusy(true);
    setProfileNotice(null);
    try {
      const saved = await api.put<OwnAccount>("/users/me", { username: cleanUsername });
      setAccount(saved);
      setUsername(saved.username);
      updateUser({ username: saved.username, email: saved.email, role: saved.role });
      setProfileNotice({ tone: "success", text: "Your account details were updated." });
    } catch (error) {
      setProfileNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "We could not update your account.",
      });
    } finally {
      setProfileBusy(false);
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!passwords.current || !passwords.next || !passwords.confirm) {
      setPasswordNotice({ tone: "error", text: "Complete all three password fields." });
      return;
    }
    if (passwords.next !== passwords.confirm) {
      setPasswordNotice({ tone: "error", text: "The new passwords do not match." });
      return;
    }
    if (!PASSWORD_RULE.test(passwords.next)) {
      setPasswordNotice({
        tone: "error",
        text: "Use 8–100 characters with at least one letter and one number.",
      });
      return;
    }
    setPasswordBusy(true);
    setPasswordNotice(null);
    try {
      await api.put<{ message: string }>("/users/me/password", {
        currentPassword: passwords.current,
        newPassword: passwords.next,
        confirmPassword: passwords.confirm,
      });
      setPasswords({ current: "", next: "", confirm: "" });
      setVisiblePasswords({ current: false, next: false, confirm: false });
      setPasswordNotice({ tone: "success", text: "Your password was changed successfully." });
    } catch (error) {
      setPasswordNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "We could not change your password.",
      });
    } finally {
      setPasswordBusy(false);
    }
  };

  const goHome = () => {
    const role = normalizeRole(account?.role || user?.role);
    navigate(HOME_BY_ROLE[role || ""] || "/products");
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 font-['Poppins',sans-serif] sm:px-6 sm:py-12">
      <Sidebar />
      <main className="mx-auto w-full max-w-3xl">
        <button
          type="button"
          onClick={goHome}
          className="mb-5 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-600 hover:bg-white hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <header className="mb-6 rounded-2xl bg-slate-900 px-6 py-7 text-white shadow-lg sm:px-8">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10">
              <UserRound className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold">My Profile</h1>
              <p className="mt-1 text-sm text-slate-300">Update your own sign-in details securely.</p>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-500 shadow-sm">Loading your account…</div>
        ) : loadError || !account ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-red-600">{loadError || "Account details are unavailable."}</p>
            <button type="button" onClick={() => void loadAccount()} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Try again</button>
          </div>
        ) : (
          <div className="space-y-6">
            <form onSubmit={saveProfile} className="rounded-2xl bg-white p-5 shadow-sm sm:p-7">
              <h2 className="text-lg font-bold text-slate-900">Account details</h2>
              <p className="mt-1 text-sm text-slate-500">These details belong only to your signed-in account.</p>
              <div className="mt-6 space-y-5">
                <label className="block" htmlFor="account-username">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Display name / username</span>
                  <input
                    id="account-username"
                    value={username}
                    maxLength={100}
                    autoComplete="username"
                    onChange={(event) => setUsername(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-700 focus:ring-4 focus:ring-slate-200"
                  />
                </label>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Email address</span>
                    <input value={account.email} readOnly className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-600" />
                    <span className="mt-2 block text-xs leading-5 text-slate-500">Email changes need a separate verification process and are not available yet.</span>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Role</span>
                    <input value={roleLabel(account.role)} readOnly className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-600" />
                    <span className="mt-2 block text-xs leading-5 text-slate-500">Your role and permissions cannot be changed from this page.</span>
                  </label>
                </div>
              </div>
              {profileNotice && <p role="status" className={`mt-5 text-sm ${profileNotice.tone === "success" ? "text-emerald-700" : "text-red-600"}`}>{profileNotice.text}</p>}
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" disabled={profileBusy} onClick={() => { setUsername(account.username); setProfileNotice(null); }} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={profileBusy || username.trim() === account.username} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                  <Save className="h-4 w-4" />{profileBusy ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>

            <form onSubmit={changePassword} className="rounded-2xl bg-white p-5 shadow-sm sm:p-7">
              <div className="flex items-center gap-3">
                <LockKeyhole className="h-5 w-5 text-slate-700" />
                <h2 className="text-lg font-bold text-slate-900">Change password</h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-500">Enter your current password first. Your new password needs at least one letter and one number.</p>
              <div className="mt-6 grid gap-5">
                <PasswordField id="current-password" label="Current password" value={passwords.current} visible={visiblePasswords.current} autoComplete="current-password" onChange={(current) => setPasswords((value) => ({ ...value, current }))} onToggle={() => setVisiblePasswords((value) => ({ ...value, current: !value.current }))} />
                <PasswordField id="new-password" label="New password" value={passwords.next} visible={visiblePasswords.next} autoComplete="new-password" onChange={(next) => setPasswords((value) => ({ ...value, next }))} onToggle={() => setVisiblePasswords((value) => ({ ...value, next: !value.next }))} />
                <PasswordField id="confirm-password" label="Confirm new password" value={passwords.confirm} visible={visiblePasswords.confirm} autoComplete="new-password" onChange={(confirm) => setPasswords((value) => ({ ...value, confirm }))} onToggle={() => setVisiblePasswords((value) => ({ ...value, confirm: !value.confirm }))} />
              </div>
              {passwordNotice && <p role="status" className={`mt-5 text-sm ${passwordNotice.tone === "success" ? "text-emerald-700" : "text-red-600"}`}>{passwordNotice.text}</p>}
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" disabled={passwordBusy} onClick={() => { setPasswords({ current: "", next: "", confirm: "" }); setPasswordNotice(null); }} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={passwordBusy} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{passwordBusy ? "Changing…" : "Change password"}</button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
