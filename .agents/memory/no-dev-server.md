---
name: Firebase-only backend
description: The standalone development backend was retired at the owner’s explicit request on October 17, 2026.
---

Backend changes belong in `functions/src/`. Do not restore a parallel backend or mirror its routes. Vite serves frontend development assets; local API requests proxy to the separately configured canonical Firebase Hosting/Functions emulator. See `docs/FIREBASE_BACKEND.md` for the isolation limitations. Existing production sales paths remain supported.
