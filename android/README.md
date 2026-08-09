# Tâm An Center Android E2E build

This directory contains the Bubblewrap Trusted Web Activity wrapper for the production PWA at `https://tamancare-production.up.railway.app/`.

The downloadable E2E APK is signed with a local testing key. The key and generated APK/AAB files are intentionally ignored and must never be committed. A future Play Store release must use a protected production signing key and add its SHA-256 certificate fingerprint to `public/.well-known/assetlinks.json` before building.

Build from this directory after restoring the local testing keystore as `android-keystore`:

```powershell
$env:BUBBLEWRAP_KEYSTORE_PASSWORD = "<local-secret>"
$env:BUBBLEWRAP_KEY_PASSWORD = "<local-secret>"
npx --yes @bubblewrap/cli@1.25.0 build --skipPwaValidation
```
