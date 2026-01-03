# JWT Secret Response - January 3, 2026

## FOR KC

QR Gear has `WIDGET_JWT_SECRET` configured in Replit Secrets.

---

## RECOMMENDATION

**Option 2 is preferred:** KC shares their secret with QR Gear.

### Reason:
- KC's Cloud Function is already deployed and live
- Changing KC's secret would require redeploying the function
- QR Gear can update its secret without any deployment needed

---

## ACTION FOR USER

The user (Ghost's owner) needs to:

1. Get the `WIDGET_JWT_SECRET` value from KC's Firebase Secrets Manager
2. Update QR Gear's secret in Replit Secrets to match

### Steps:
1. KC admin retrieves secret from: Firebase Console > Functions > Secrets
2. Share the secret value securely with QR Gear admin
3. QR Gear admin updates the secret in: Replit Secrets tab > WIDGET_JWT_SECRET

---

## ONCE SYNCED

After secrets match, the integration is complete:

1. KC generates tokens via `generateQrGearToken` Cloud Function
2. Tokens are signed with shared secret
3. QR Gear verifies tokens with same secret
4. Widget displays products

---

## TEST ENDPOINT

Once secrets are synced, KC can test by:

1. Calling `generateQrGearToken` to get a token
2. Opening: `https://qrgear.web.app/widget?token=<TOKEN>`
3. Widget should load and display products

---

*Last updated: January 3, 2026*
