import assert from "node:assert/strict";
import fs from "node:fs";

const menu = fs.readFileSync("src/pages/menu.tsx", "utf8");
const settings = fs.readFileSync("src/pages/settings.tsx", "utf8");
const paymentQr = fs.readFileSync("src/lib/paymentQr.ts", "utf8");

assert.match(settings, /key: "payment_methods", label: "Payment Methods"/);
assert.match(settings, /api\.post<PaymentQrConfiguration>\("\/payment-qr", form\)/);
assert.match(settings, /api\.delete<PaymentQrConfiguration>\("\/payment-qr"\)/);
assert.match(settings, /image\/png,image\/jpeg,image\/webp/);
assert.match(settings, /Drop a QR image here/);
assert.match(settings, /fileInputRef\.current\?\.click\(\)/);
assert.match(settings, /Choose Replacement Image/);
assert.match(settings, /PREVIEW — NOT UPLOADED/);
assert.match(settings, /onDrop=\{handleDrop\}/);
assert.match(settings, /event\.preventDefault\(\)/);
assert.match(settings, /window\.addEventListener\("drop", preventFileNavigation\)/);
assert.match(settings, /Save Replacement/);
assert.match(settings, /Upload QR/);

assert.match(paymentQr, /api\.get<PaymentQrConfiguration>\("\/payment-qr"\)/);
assert.match(paymentQr, /fetchAuthenticatedAsset\(imageUrl\)/);

assert.match(menu, /value: "gcash_onsite", label: "Online Payment"/);
assert.match(menu, /Proceed to Checkout/);
assert.match(menu, /POS-GCASH-\$\{crypto\.randomUUID\(\)\}/);
assert.match(menu, /payment_reference: paymentAttemptRef\.current/);
assert.match(menu, /payment_qr_version: paymentQrVersionRef\.current/);
assert.match(menu, /accept="image\/png,image\/jpeg,image\/webp/);
assert.match(menu, /Selected GCash payment proof preview/);
assert.match(menu, /disabled=\{!qrImageUrl \|\| !file\}/);
assert.match(menu, /api\.post<\{ fileUrl: string \}>\("\/upload-proof", form\)/);
assert.match(menu, /proof_image_url: proofImageUrl/);
assert.match(menu, /paymentProofUploadRef\.current/);
assert.match(menu, /cachedProof\.file === file/);
assert.match(menu, /Verify receipt in the store's GCash account before confirming/);
assert.match(menu, /Inventory is deducted only after the paid order is completed/);
assert.doesNotMatch(menu, /gcashQR1|gcashQR\.jpg/);

console.log("Admin-managed in-store GCash QR frontend checks passed");
