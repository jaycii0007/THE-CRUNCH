import { useEffect, useMemo, useState, type ElementType } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ChefHat,
  BookOpenText,
  UtensilsCrossed,
  Package,
  BarChart3,
  UsersRound,
  Settings,
  LogOut,
  UserRound,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "../context/authcontext";
import {
  fetchPermissions,
  hasPagePermission,
  normalizeRole,
  readCachedPermissions,
  type NonNullRole,
  type PermissionKey,
  type PermissionsMap,
} from "@/lib/permissions";
import {
  fetchGeneralSettings,
  GENERAL_SETTINGS_EVENT,
} from "@/lib/restaurantSettings";
import { InventoryNotificationCenter } from "@/components/InventoryNotificationCenter";
import "./sidebar-dock.css";

/*
 * Persistent floating navigation dock for staff users.
 * Always visible on every page and device — no hamburger, no backdrop.
 * Slim segmented neumorphic rail with an animated Menu Management smoke glow
 * behind it. Which links appear depends on the permissions the API returns for
 * the signed-in role. The dock shows right away from the last loaded
 * permissions (kept in memory) or the defaults, then updates when the API
 * responds. Nothing is stored in the browser.
 */

/* -------------------------------------------------------------------------- */
/* Types & constants                                                          */
/* -------------------------------------------------------------------------- */

type Role = NonNullRole | "customer";

interface SidebarItem {
  label: string;
  path: string;
  permissionKey: PermissionKey;
  icon: ElementType;
}

const ROLE_LABELS: Record<Role, string> = {
  administrator: "Administrator",
  cashier: "Cashier",
  inventory_manager: "Inventory Manager",
  customer: "Customer",
};

// Every link the dock can show, in display order.
const SIDEBAR_ITEMS: SidebarItem[] = [
  {
    label: "Overview",
    path: "/dashboard",
    permissionKey: "overview",
    icon: LayoutDashboard,
  },
  {
    label: "Cook View",
    path: "/orders",
    permissionKey: "orders",
    icon: ChefHat,
  },
  {
    label: "Cashier View",
    path: "/menu",
    permissionKey: "menus",
    icon: BookOpenText,
  },
  {
    label: "Menu Management",
    path: "/inventory",
    permissionKey: "menuManagement",
    icon: UtensilsCrossed,
  },
  {
    label: "Inventory Management",
    path: "/stockmanager",
    permissionKey: "stockManager",
    icon: Package,
  },
  {
    label: "Sales & Reports",
    path: "/sales-reports",
    permissionKey: "salesReports",
    icon: BarChart3,
  },
  {
    label: "User Accounts",
    path: "/users",
    permissionKey: "userAccounts",
    icon: UsersRound,
  },
  {
    label: "Settings",
    path: "/settings",
    permissionKey: "settings",
    icon: Settings,
  },
];

/* One-time entrance: the dock slides in on the first page after login only. */
let dockIntroduced = false;

/* -------------------------------------------------------------------------- */
/* Data hooks                                                                 */
/* -------------------------------------------------------------------------- */

// Role permissions. Starts from the last loaded copy (kept in memory) or the defaults,
// so the dock shows right away, then updates when the API responds.
function usePermissions(enabled: boolean) {
  const [permissions, setPermissions] = useState<PermissionsMap>(
    readCachedPermissions,
  );

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    fetchPermissions()
      .then((next) => {
        if (cancelled) return;
        setPermissions(next);
      })
      .catch(() => {
        // Keep showing the current menu if the request fails.
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return permissions;
}

// Last restaurant name loaded from the API. Kept in memory so it shows
// immediately when moving between pages.
let lastRestaurantName = "";

// Loads the restaurant name and reloads it whenever the general settings change.
function useRestaurantName() {
  const [name, setName] = useState(lastRestaurantName);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetchGeneralSettings()
        .then((settings) => {
          lastRestaurantName = settings.restaurantName;
          if (!cancelled) setName(settings.restaurantName);
        })
        .catch(() => {
          // Keep the current name if the request fails.
        });
    };

    const syncFromEvent = (event: Event) => {
      const settings = (event as CustomEvent).detail;
      if (!settings || typeof settings !== "object") return;
      lastRestaurantName = String(settings.restaurantName || "");
      if (!cancelled) setName(lastRestaurantName);
    };

    load();
    window.addEventListener(GENERAL_SETTINGS_EVENT, syncFromEvent);

    return () => {
      cancelled = true;
      window.removeEventListener(GENERAL_SETTINGS_EVENT, syncFromEvent);
    };
  }, []);

  return name;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export function Sidebar() {
  const navigate = useNavigate();
  const { user, logout, isOnline } = useAuth();
  const reduceMotion = useReducedMotion();

  const role = normalizeRole(
    String(user?.role || "")
      .trim()
      .toLowerCase(),
  );
  const staffRole = role && role !== "customer" ? role : null;

  const permissions = usePermissions(staffRole !== null);
  const restaurantName = useRestaurantName();

  // Only show the links this role is allowed to open.
  const visibleItems = useMemo(() => {
    if (!staffRole) return [];
    const allowed = SIDEBAR_ITEMS.filter((item) =>
      hasPagePermission(staffRole, item.permissionKey, permissions),
    );
    if (staffRole !== "cashier") return allowed;

    const cashierOrder = ["Cashier View", "Cook View", "Overview", "Sales & Reports"];
    return [...allowed].sort((left, right) => {
      const leftIndex = cashierOrder.indexOf(left.label);
      const rightIndex = cashierOrder.indexOf(right.label);
      return (leftIndex < 0 ? cashierOrder.length : leftIndex) -
        (rightIndex < 0 ? cashierOrder.length : rightIndex);
    });
  }, [permissions, staffRole]);

  const primaryItems = visibleItems.filter((item) => item.path !== "/settings");
  const settingsItems = visibleItems.filter((item) => item.path === "/settings");

  // Every staff page reserves the dock gutter so content never overlaps it.
  useEffect(() => {
    if (!staffRole) return;
    document.body.classList.add("has-crunch-dock");
    return () => {
      document.body.classList.remove("has-crunch-dock");
    };
  }, [staffRole]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  if (!staffRole || !user) return null;

  // Cream tile that glides to whichever destination is active.
  const activeTile = (
    <motion.span
      layoutId="crunch-dock-active"
      className="crunch-dock__active"
      transition={
        reduceMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 480, damping: 36 }
      }
    />
  );

  const dockItemClass = ({ isActive }: { isActive: boolean }) =>
    cn("crunch-dock__item", isActive && "crunch-dock__item--on");

  const renderNavItem = ({ label, path, icon: Icon }: SidebarItem) => (
    <NavLink key={path} to={path} end className={dockItemClass} aria-label={label}>
      {({ isActive }) => (
        <>
          {isActive && activeTile}
          <Icon
            className="crunch-dock__icon"
            strokeWidth={isActive ? 2.2 : 1.9}
            aria-hidden="true"
          />
          <span className="crunch-dock__tip">{label}</span>
        </>
      )}
    </NavLink>
  );

  const profileLink = (
    <NavLink
      to="/my-account"
      end
      aria-label={`Open My Profile for ${user.username}`}
      className={({ isActive }) =>
        cn(
          "crunch-dock__item focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78512E]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F5EFE5]",
          isActive && "crunch-dock__item--on",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && activeTile}
          <UserRound
            className="crunch-dock__icon"
            strokeWidth={isActive ? 2.2 : 1.9}
            aria-hidden="true"
          />
          <span
            aria-hidden="true"
            className={cn(
              "crunch-dock__presence",
              isOnline ? "crunch-dock__presence--on" : "crunch-dock__presence--off",
            )}
          />
          <span className="crunch-dock__tip">My Profile</span>
        </>
      )}
    </NavLink>
  );

  return (
    <>
      {/* Top-right identity + notifications pill */}
      <div style={{ maxWidth: "calc(100vw - 6rem)" }} className="fixed right-4 top-4 z-40 flex items-center gap-1 rounded-2xl border border-[#dcd3c4] bg-[#faf7f0] p-1 shadow-[inset_1px_1px_2px_#fff,-3px_-3px_8px_#fffdf8,0_2px_3px_#44351f26,2px_6px_16px_-5px_#44351f59,10px_22px_44px_-16px_#44351f4d] font-['Poppins',sans-serif] sm:right-6 sm:top-6">
        <NavLink
          to="/my-account"
          aria-label={`Open My Profile for ${user.username}`}
          title="Open My Profile"
          className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl px-2 text-[#27251f] transition-colors hover:bg-[#eee8dc] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#685536] sm:pr-3"
        >
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#eee8dd] shadow-[inset_1px_1px_3px_#63523838,inset_-1px_-1px_2px_#fff,0_2px_5px_-2px_#63523833]">
            <UserRound className="size-4" strokeWidth={1.7} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold leading-tight">{user.username}</span>
            <span className="block truncate text-[11px] font-medium leading-tight text-[#665f53]">{ROLE_LABELS[staffRole]}</span>
          </span>
        </NavLink>
        <InventoryNotificationCenter role={role} embedded />
      </div>

      {/* Menu Management smoke glow, behind the dock */}
      <div aria-hidden="true" className="crunch-dock-smoke" />

      {/* Persistent command dock */}
      <motion.div
        role="navigation"
        aria-label="Main navigation"
        className="crunch-dock"
        initial={
          dockIntroduced || reduceMotion
            ? false
            : { x: -110, opacity: 0 }
        }
        animate={{ x: 0, opacity: 1 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 260, damping: 26 }
        }
        onAnimationComplete={() => {
          dockIntroduced = true;
        }}
      >
        {/* Brand pill */}
        <NavLink
          to="/"
          end
          aria-label="Home"
          title={restaurantName || "The Crunch"}
          className="crunch-dock__logo focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#78512E]"
        >
          <img src="/img/logo24.webp" alt="" aria-hidden="true" />
        </NavLink>

        {/* Primary destinations */}
        <nav className="crunch-dock__segment crunch-dock__nav" aria-label="Pages">
          {primaryItems.map(renderNavItem)}
        </nav>

        {/* Profile */}
        <div className="crunch-dock__segment">{profileLink}</div>

        {/* Pushes the footer cluster to the bottom of the viewport */}
        <span aria-hidden="true" className="crunch-dock__spacer" />

        {/* Foot: settings + log out */}
        <div className="crunch-dock__segment crunch-dock__foot">
          {settingsItems.map(renderNavItem)}
          <button
            type="button"
            onClick={handleLogout}
            className="crunch-dock__item crunch-dock__item--logout"
            aria-label="Log Out"
          >
            <LogOut className="crunch-dock__icon" strokeWidth={1.9} aria-hidden="true" />
            <span className="crunch-dock__tip">Log Out</span>
          </button>
        </div>
      </motion.div>
    </>
  );
}