import assert from "node:assert/strict";
import fs from "node:fs";

const settings = fs.readFileSync(
  new URL("../src/pages/settings.tsx", import.meta.url),
  "utf8",
);
const businessTab = settings.slice(
  settings.indexOf("export function BusinessTab"),
  settings.indexOf("interface DeliveryPlatformLinks"),
);

for (const label of [
  "Email",
  "Phone",
  "Address",
  "Business TIN",
  "Registration details",
]) {
  assert.equal(businessTab.includes(`label="${label}"`), false);
}

for (const field of [
  "email",
  "phone",
  "address",
  "businessTin",
  "businessRegistrationDetails",
]) {
  assert.match(settings, new RegExp(`${field}:\\s*string`));
}

assert.match(settings, /api\.delete\(`\/settings\/menu-categories/);
assert.match(settings, /api\.delete\(`\/settings\/inventory-categories/);
assert.match(settings, /window\.confirm\(`Permanently delete/);
assert.match(settings, /await load\(\)/);

console.log("Administrator Settings cleanup source checks passed");
