export type RootRouteRole =
  | "administrator"
  | "cashier"
  | "inventory_manager"
  | "customer"
  | null;

export const ROLE_HOME_PATHS: Record<Exclude<RootRouteRole, null>, string> = {
  administrator: "/dashboard",
  cashier: "/menu",
  inventory_manager: "/inventory",
  customer: "/",
};

export type RootRouteDecision =
  | { kind: "pending" }
  | { kind: "public" }
  | { kind: "redirect"; to: string };

export function resolveRootRoute({
  isInitialized,
  role,
  staffHomePath,
}: {
  isInitialized: boolean;
  role: RootRouteRole;
  staffHomePath: string;
}): RootRouteDecision {
  if (!isInitialized) return { kind: "pending" };
  if (!role || role === "customer") return { kind: "public" };
  return { kind: "redirect", to: staffHomePath };
}

// Customer return paths share one validator in the login form and route guard.
export function getCustomerReturnDestination(search: string): string | null {
  const params = new URLSearchParams(search);
  const raw = params.get("returnTo") || params.get("redirect");
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || /[\\\x00-\x20]/.test(raw)) return null;
  try {
    const url = new URL(raw, "https://the-crunch.local");
    if (url.origin !== "https://the-crunch.local") return null;
    if (!["/", "/products", "/usersmenu", "/my-account", "/aboutthecrunch"].includes(url.pathname)) return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}
