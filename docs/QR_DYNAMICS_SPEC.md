# QR Dynamics Specification

## Canonical Definition

**QR Dynamics is a stateless, time-based URL resolver that loops through hosted page URLs using fixed-duration slots and epoch math.**

---

## Purpose

QR Dynamics does NOT create content.
It selects and rotates EXISTING PAGE URLs over time.

The QR code always points to ONE resolver URL.
That resolver decides WHICH page URL is active at request time using deterministic interval math.

### Supported Page Types (external to this system)
- **Image page** (landing page hosted by you - qr-canvas type)
- **Video page** (thumbnail page → click → external video URL - qr-play type)

QR Basics / QR Plus are excluded because they do not produce hosted pages.

---

## Data Model

### Collection: qr_dynamics_instances
Document ID: instanceId (bound to sold item)

```typescript
interface QRDynamicsInstance {
  instanceId: string;                    // bound to sold item/order
  createdAt: number;                     // epoch seconds
  startTimestamp: number;                // epoch seconds (rotation anchor)
  mode: 'loop';                          // future-proof, only "loop" for now
  fallbackUrl?: string;                  // redirect here if all slots fail
  
  slots: Array<{
    slotId: string;                      // uuid
    packetId: string;                    // reference to productPackets
    durationSeconds: number;             // display interval
    order: number;                       // explicit ordering
  }>;
}
```

### Packet Reference
Slots reference `packetId` from the `productPackets` collection. The packet contains:
- `landingPageSnapshotUrl` - thumbnail for admin UI
- `landingPageSlug` - URL to redirect to
- `qrProductType` - must be 'qr-canvas' or 'qr-play'

### Duration Presets
| Interval | Seconds |
|----------|---------|
| 1 minute | 60 |
| 5 minutes | 300 |
| 15 minutes | 900 |
| 30 minutes | 1800 |
| 1 hour | 3600 |
| 6 hours | 21600 |
| 12 hours | 43200 |
| 1 day | 86400 |
| 1 week | 604800 |
| 1 month | 2592000 |

---

## Resolution Algorithm

```
Given:
- nowEpoch = current epoch seconds
- startTimestamp
- slots[] sorted by order, with durationSeconds

Steps:

elapsed = nowEpoch - startTimestamp
cycleLength = SUM(slots[i].durationSeconds)
position = elapsed % cycleLength

running = 0
FOR each slot IN slots (sorted by order):
  running += slot.durationSeconds
  IF position < running:
    activeSlot = slot
    BREAK

Fetch packet by activeSlot.packetId
REDIRECT → packet.landingPageUrl or fallbackUrl on error
```

---

## Error Handling

If active slot's URL returns 404 or error:
1. Skip to next slot in order
2. If all slots fail, redirect to `fallbackUrl`
3. If no fallbackUrl, return generic error page

---

## Handler (Node/Edge Safe)

```typescript
export async function qrDynamicsHandler(req, res) {
  try {
    const instanceId = req.params.instanceId;

    // 1. Load instance
    const instance = await loadQRDynamicsInstance(instanceId);

    if (!instance || !instance.slots || instance.slots.length === 0) {
      res.status(404).send("QR Dynamics instance not configured");
      return;
    }

    // 2. Sort slots by order
    const sortedSlots = [...instance.slots].sort((a, b) => a.order - b.order);

    // 3. Time math
    const nowEpoch = Math.floor(Date.now() / 1000);
    const elapsed = nowEpoch - instance.startTimestamp;

    let cycleLength = 0;
    for (const slot of sortedSlots) {
      cycleLength += slot.durationSeconds;
    }

    if (cycleLength <= 0) {
      res.status(500).send("Invalid QR Dynamics cycle");
      return;
    }

    const position = elapsed % cycleLength;

    // 4. Resolve slot
    let running = 0;
    let activeSlot = null;

    for (const slot of sortedSlots) {
      running += slot.durationSeconds;
      if (position < running) {
        activeSlot = slot;
        break;
      }
    }

    if (!activeSlot) {
      res.status(500).send("Unable to resolve QR Dynamics slot");
      return;
    }

    // 5. Fetch packet and redirect
    const packet = await loadPacket(activeSlot.packetId);
    
    if (!packet || !packet.landingPageSlug) {
      // Skip to next slot or use fallback
      return handleSlotError(res, instance, sortedSlots, activeSlot);
    }

    const targetUrl = `/p/${packet.landingPageSlug}`;
    res.writeHead(302, { Location: targetUrl });
    res.end();

  } catch (err) {
    res.status(500).send("QR Dynamics resolver error");
  }
}
```

---

## Editing Behavior

When user edits slots:
- Do NOT rewrite history
- Reset `startTimestamp = nowEpoch`
- Rotation restarts cleanly

Why:
- Deterministic
- Predictable
- Avoids partial-cycle ambiguity

---

## Two-Phase Architecture

### Phase 1: Collection (Admin Template)
- Admin builds slots, durations, order
- Preview shows "if scanned right now, would show Slot X" using `now` as temporary startTimestamp
- This is for testing/approval

### Phase 2: Instance (Created at Sale)
- Copies slots from Collection template
- Sets `startTimestamp = sale timestamp`
- Bound to specific order/item
- This is what the real QR code resolves against

---

## API Endpoints

### Resolver
- `GET /qr/d/:instanceId` - Resolves and redirects to active slot

### Admin (Collection Management)
- `GET /api/test/stores/:storeId/channels/:channelId/dynamics-content` - Get packets filtered to qr-canvas/qr-play only
- `GET /api/dynamics/collections/:collectionId` - Get collection with slots
- `POST /api/dynamics/collections` - Create collection
- `PUT /api/dynamics/collections/:collectionId/slots` - Update slots (resets startTimestamp)

### Instance Management
- `POST /api/dynamics/instances` - Create instance from collection (at sale)
- `GET /api/dynamics/instances/:instanceId` - Get instance details
- `GET /api/dynamics/instances/:instanceId/preview` - Preview current active slot

---

## System Properties

- Stateless
- Deterministic
- Scales infinitely
- Survives downtime
- No race conditions
- No background workers
- Matches ad-rotator math

---

## Integration Notes

### Admin UI
- Filter packets to `qrProductType = 'qr-canvas'` OR `qrProductType = 'qr-play'`
- Display `landingPageSnapshotUrl` as thumbnail
- Slot duration selector with presets (minutes, hours, days, weeks, months)
- Preview panel showing current active slot using math

### Instance Creation
- Triggered at checkout/sale
- Links instanceId to order item
- QR code on product points to `/qr/d/{instanceId}`
