# BACKUP_MANIFEST.md

**Backup Timestamp:** 2026-11-08T13:59:04Z
**Phase:** Phase A — Inspect, Backup, Diagnose API
**Source Branch:** master
**Source Commit:** b13328f Fix post-merge TypeScript errors and preserve UI changes

## Files Backed Up

| File | Source Path | Backup Path | SHA256 | Size (bytes) |
|------|-------------|-------------|--------|--------------|
| products.tsx | src/pages/products.tsx | products.tsx.bak | d6866bda7229710368535c502ebb3a8b3268d026a0ad5dcba610f1f70bbe40f8 | ~43KB |
| App.tsx | src/App.tsx | App.tsx.bak | 352c49210555e325381455cbfb1ff811f25ed5b5eb9c789af8a01caa90c2b5ce | ~11KB |
| works-wheel.tsx | src/components/ui/works-wheel.tsx | works-wheel.tsx.bak | 040766deb627da11fe3695739a8a722351627254f88986806458981c0a78cd0a | ~12KB |

## Integrity Verification

- [x] All three files copied successfully
- [x] SHA256 checksums generated
- [x] Files are non-empty and readable
- [x] Byte-for-byte match confirmed via checksums

## Notes

This backup captures the state before beginning Phase A work on the productv2.tsx page. The original `/products` route and Products component remain active at `/products`. The new `/products-v2` route will be staged separately.