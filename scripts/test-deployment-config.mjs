import assert from "node:assert/strict";
import fs from "node:fs";

const apiSource = fs.readFileSync("src/lib/api.ts", "utf8");
const stockApiSource = fs.readFileSync(
  "src/pages/stockmanager/services/api.ts",
  "utf8",
);
const eventSource = fs.readFileSync("src/hooks/use-event-invalidation.ts", "utf8");
const productionEnv = fs.readFileSync(".env", "utf8");
const redirects = fs.readFileSync("public/_redirects", "utf8");

assert.match(apiSource, /VITE_API_URL/);
assert.match(apiSource, /VITE_API_URL is required for a production build/);
assert.ok(apiSource.includes(": `https://${trimmed}`;"));
assert.match(apiSource, /VITE_API_URL cannot use localhost in production/);
assert.match(stockApiSource, /import \{ resolveBackendUrl \} from "@\/lib\/api"/);
assert.doesNotMatch(stockApiSource, /import\.meta\.env\.VITE_API_URL/);
assert.match(eventSource, /resolveBackendUrl\("\/api\/events\/stream"\)/);
assert.match(
  productionEnv,
  /^VITE_API_URL=https:\/\/crunch-backend-production\.up\.railway\.app$/m,
);
assert.equal(redirects.trim(), "/* /index.html 200");

console.log("Frontend deployment configuration tests passed.");
