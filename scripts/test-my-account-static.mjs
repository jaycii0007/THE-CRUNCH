import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const app = read("src/App.tsx");
const permissions = read("src/lib/permissions.ts");
const account = read("src/pages/my-account.tsx");
const auth = read("src/context/authcontext.tsx");
const sidebar = read("src/components/Sidebar.tsx");
const staffAccounts = read("src/pages/staffaccounts.tsx");
const login = read("src/pages/login.tsx");
const products = read("src/pages/products.tsx");
const customerMenu = read("src/pages/usersmenu.tsx");
const settings = read("src/pages/settings.tsx");

assert.match(app, /path="\/my-account"/);
assert.match(app, /element=\{isAuth \? <MyAccount \/> : <Navigate to="\/login" replace \/>\}/);
assert.match(permissions, /STAFF_ROLES = \["administrator", "cashier", "cook", "inventory_manager"\]/);
assert.match(permissions, /cook:\s*\{[\s\S]*?orders:\s*true/);
assert.match(login, /cook:\s*"\/orders"/);
assert.match(staffAccounts, /"administrator", "cashier", "cook", "inventory_manager"/);
assert.match(sidebar, /to="\/my-account"/);

assert.match(account, /api\.get<OwnAccount>\("\/users\/me"\)/);
assert.match(account, /api\.put<OwnAccount>\("\/users\/me", \{ username: cleanUsername \}\)/);
assert.match(account, /api\.put<\{ message: string \}>\("\/users\/me\/password"/);
assert.match(account, /currentPassword: passwords\.current/);
assert.match(account, /updateUser\(\{ username: saved\.username, email: saved\.email, role: saved\.role \}\)/);
assert.match(account, /readOnly/);
assert.match(account, /Email changes need a separate verification process and are not available yet/);
assert.match(account, /Show.*password|\$\{visible \? "Hide" : "Show"\}/s);
assert.doesNotMatch(account, /email:\s*account\.email/);

assert.match(auth, /saveStoredAuth\(nextUser\)/);
assert.match(products, /navigate\('\/my-account'\)/);
assert.match(customerMenu, /navigate\("\/my-account"\)/);
assert.doesNotMatch(settings, /\{ key: "personal", label: "My Account" \}/);

console.log("My Account route, role, navigation, and auth-refresh static tests passed.");
