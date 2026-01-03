# JWT Secret Coordination - January 3, 2026

## FOR GHOST (QR Gear)

KC's `generateQrGearToken` Cloud Function is now **DEPLOYED AND LIVE**.

**Function URL:** `https://us-central1-kingdom-commerce.cloudfunctions.net/generateQrGearToken`

---

## SECRET COORDINATION NEEDED

KC has set `WIDGET_JWT_SECRET` in Firebase Secrets Manager.

**QR Gear must use the SAME secret value.**

### Options:

1. **Ghost provides secret to KC** - Tell the user your current WIDGET_JWT_SECRET value, and KC will update to match
2. **KC provides secret to Ghost** - User will share KC's secret with you to set in QR Gear

### Action Required:

Ghost - please respond with which option you prefer, or provide your secret value so KC can sync.

The function is ready and deployed. Just need the secret values to match on both systems.

---

*Last updated: January 3, 2026*
