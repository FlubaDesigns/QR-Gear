import type { Express } from "express";

export function registerDynamicsV2Routes(app: Express): void {

  app.get("/api/dynamics/packets", async (req: any, res) => {
    try {
      const { storeId, channelId } = req.query;

      if (!storeId) {
        return res.status(400).json({ error: "storeId is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      const channelIdLower = channelId ? (channelId as string).toLowerCase() : null;

      let packetsSnapshot = await firestoreDb.collection("productPackets")
        .where("storeId", "==", storeId)
        .get();

      let docs = packetsSnapshot.docs;
      if (channelId) {
        docs = docs.filter(doc => {
          const data = doc.data();
          return data.channelId === channelId || data.channelId === channelIdLower;
        });
      }

      const packets = docs
        .map(doc => {
          const data = doc.data();

          if (!data.landingPageSnapshotUrl) return null;

          const url = data.landingPageSnapshotUrl || '';
          let qrType: 'qr-canvas' | 'qr-play' = 'qr-canvas';
          if (url.includes('/play/')) {
            qrType = 'qr-play';
          } else if (url.includes('/canvas/')) {
            qrType = 'qr-canvas';
          }

          return {
            id: doc.id,
            packetId: doc.id,
            name: data.productName || data.landingPageTitle || 'Untitled',
            qrProductType: qrType,
            thumbnailUrl: data.landingPageSnapshotUrl,
            landingPageSlug: data.landingPageSlug,
            landingPageUrl: data.landingPageSlug ? `/p/${data.landingPageSlug}` : null,
            storeId: data.storeId,
            channelId: data.channelId,
          };
        })
        .filter(Boolean);

      console.log(`[Dynamics Packets] Found ${packets.length} eligible packets for ${storeId}/${channelId || 'all'}`);

      res.json({
        success: true,
        packets,
        count: packets.length,
      });
    } catch (error: any) {
      console.error("[Dynamics Packets] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/dynamics/instances", async (req: any, res) => {
    try {
      const { orderId, collectionId, slots, fallbackUrl } = req.body;

      if (!slots || !Array.isArray(slots) || slots.length === 0) {
        return res.status(400).json({ error: "slots array is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      const nowEpoch = Math.floor(Date.now() / 1000);

      const instanceData = {
        orderId: orderId || null,
        collectionId: collectionId || null,
        createdAt: nowEpoch,
        startTimestamp: nowEpoch,
        mode: 'loop',
        fallbackUrl: fallbackUrl || null,
        slots: slots.map((slot: any, index: number) => ({
          slotId: slot.slotId || `slot-${Date.now()}-${index}`,
          packetId: slot.packetId,
          durationSeconds: slot.durationSeconds || 86400,
          order: slot.order ?? index + 1,
        })),
      };

      const docRef = await firestoreDb.collection("qr_dynamics_instances").add(instanceData);

      console.log(`[Dynamics Instance] Created instance ${docRef.id} with ${slots.length} slots`);

      res.json({
        success: true,
        instanceId: docRef.id,
        resolverUrl: `/qr/d/${docRef.id}`,
      });
    } catch (error: any) {
      console.error("[Dynamics Instance] Error creating:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/dynamics/instances/:instanceId", async (req: any, res) => {
    try {
      const { instanceId } = req.params;

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      const doc = await firestoreDb.collection("qr_dynamics_instances").doc(instanceId).get();

      if (!doc.exists) {
        return res.status(404).json({ error: "Instance not found" });
      }

      res.json({
        success: true,
        instance: {
          id: doc.id,
          ...doc.data(),
        },
      });
    } catch (error: any) {
      console.error("[Dynamics Instance] Error fetching:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/dynamics/instances/:instanceId/preview", async (req: any, res) => {
    try {
      const { instanceId } = req.params;

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      const doc = await firestoreDb.collection("qr_dynamics_instances").doc(instanceId).get();

      if (!doc.exists) {
        return res.status(404).json({ error: "Instance not found" });
      }

      const instance = doc.data() as any;
      const slots = instance.slots || [];

      if (slots.length === 0) {
        return res.json({
          success: true,
          activeSlot: null,
          message: "No slots configured",
        });
      }

      const sortedSlots = [...slots].sort((a: any, b: any) => a.order - b.order);

      const nowEpoch = Math.floor(Date.now() / 1000);
      const elapsed = nowEpoch - instance.startTimestamp;

      let cycleLength = 0;
      for (const slot of sortedSlots) {
        cycleLength += slot.durationSeconds;
      }

      if (cycleLength <= 0) {
        return res.status(500).json({ error: "Invalid cycle length" });
      }

      const position = elapsed % cycleLength;

      let running = 0;
      let activeSlot = null;
      let activeIndex = 0;

      for (let i = 0; i < sortedSlots.length; i++) {
        running += sortedSlots[i].durationSeconds;
        if (position < running) {
          activeSlot = sortedSlots[i];
          activeIndex = i;
          break;
        }
      }

      let packetDetails = null;
      if (activeSlot) {
        const packetDoc = await firestoreDb.collection("productPackets").doc(activeSlot.packetId).get();
        if (packetDoc.exists) {
          const packetData = packetDoc.data() as any;
          packetDetails = {
            name: packetData.productName || packetData.landingPageTitle || 'Untitled',
            thumbnailUrl: packetData.landingPageSnapshotUrl,
            landingPageSlug: packetData.landingPageSlug,
            qrProductType: packetData.qrProductType,
          };
        }
      }

      let timeRemainingSeconds = 0;
      if (activeSlot) {
        const slotStart = running - activeSlot.durationSeconds;
        timeRemainingSeconds = activeSlot.durationSeconds - (position - slotStart);
      }

      res.json({
        success: true,
        nowEpoch,
        elapsed,
        cycleLength,
        position,
        activeIndex,
        totalSlots: sortedSlots.length,
        activeSlot: activeSlot ? {
          ...activeSlot,
          packet: packetDetails,
        } : null,
        timeRemainingSeconds,
        nextSlotIndex: (activeIndex + 1) % sortedSlots.length,
      });
    } catch (error: any) {
      console.error("[Dynamics Preview] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/dynamics/instances/:instanceId/slots", async (req: any, res) => {
    try {
      const { instanceId } = req.params;
      const { slots } = req.body;

      if (!slots || !Array.isArray(slots)) {
        return res.status(400).json({ error: "slots array is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      const nowEpoch = Math.floor(Date.now() / 1000);

      await firestoreDb.collection("qr_dynamics_instances").doc(instanceId).update({
        slots: slots.map((slot: any, index: number) => ({
          slotId: slot.slotId || `slot-${Date.now()}-${index}`,
          packetId: slot.packetId,
          durationSeconds: slot.durationSeconds || 86400,
          order: slot.order ?? index + 1,
        })),
        startTimestamp: nowEpoch,
      });

      console.log(`[Dynamics Instance] Updated slots for ${instanceId}, reset startTimestamp`);

      res.json({
        success: true,
        instanceId,
        newStartTimestamp: nowEpoch,
      });
    } catch (error: any) {
      console.error("[Dynamics Instance] Error updating slots:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/qr/d/:instanceId", async (req: any, res) => {
    try {
      const { instanceId } = req.params;

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      const doc = await firestoreDb.collection("qr_dynamics_instances").doc(instanceId).get();

      if (!doc.exists) {
        return res.status(404).send("QR Dynamics instance not found");
      }

      const instance = doc.data() as any;
      const slots = instance.slots || [];

      if (slots.length === 0) {
        if (instance.fallbackUrl) {
          return res.redirect(302, instance.fallbackUrl);
        }
        return res.status(404).send("No content configured");
      }

      const sortedSlots = [...slots].sort((a: any, b: any) => a.order - b.order);

      if (instance.composeMode === 'scan-to-reveal') {
        const slotPacketIds = sortedSlots.map((s: any) => s.packetId);
        const packetSlugs: string[] = [];

        for (const pid of slotPacketIds) {
          let pDoc = await firestoreDb.collection("productPackets").doc(pid).get();
          if (!pDoc.exists) {
            pDoc = await firestoreDb.collection("memberPackets").doc(pid).get();
          }
          const pData = pDoc.exists ? (pDoc.data() as any) : null;
          packetSlugs.push(pData?.landingPageSlug || '');
        }

        const validSlugs = packetSlugs.filter(s => s !== '');
        if (validSlugs.length === 0) {
          if (instance.fallbackUrl) {
            return res.redirect(302, instance.fallbackUrl);
          }
          return res.status(404).send("No content configured");
        }

        console.log(`[QR Dynamics] Scan-to-Reveal instance ${instanceId} with ${validSlugs.length} items`);

        const slugsJson = JSON.stringify(validSlugs);
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Loading...</title></head><body><script>
(function(){
  var k='qr_str_'+${JSON.stringify(instanceId)};
  var slugs=${slugsJson};
  var idx=parseInt(localStorage.getItem(k)||'0',10);
  if(isNaN(idx)||idx<0)idx=0;
  var current=idx%slugs.length;
  localStorage.setItem(k,String(idx+1));
  window.location.replace('/p/'+slugs[current]);
})();
</script><noscript><p>JavaScript is required.</p></noscript></body></html>`;

        return res.status(200).type('html').send(html);
      }

      const nowEpoch = Math.floor(Date.now() / 1000);
      const elapsed = nowEpoch - instance.startTimestamp;

      let cycleLength = 0;
      for (const slot of sortedSlots) {
        cycleLength += slot.durationSeconds;
      }

      if (cycleLength <= 0) {
        if (instance.fallbackUrl) {
          return res.redirect(302, instance.fallbackUrl);
        }
        return res.status(500).send("Invalid QR Dynamics configuration");
      }

      const position = elapsed % cycleLength;

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
        if (instance.fallbackUrl) {
          return res.redirect(302, instance.fallbackUrl);
        }
        return res.status(500).send("Unable to resolve slot");
      }

      let packetDoc = await firestoreDb.collection("productPackets").doc(activeSlot.packetId).get();
      if (!packetDoc.exists) {
        packetDoc = await firestoreDb.collection("memberPackets").doc(activeSlot.packetId).get();
      }

      if (!packetDoc.exists) {
        console.log(`[QR Dynamics] Packet ${activeSlot.packetId} not found, trying next slot`);

        const nextSlotIndex = (sortedSlots.indexOf(activeSlot) + 1) % sortedSlots.length;
        const nextSlot = sortedSlots[nextSlotIndex];

        if (nextSlot && nextSlot.packetId !== activeSlot.packetId) {
          const nextPacketDoc = await firestoreDb.collection("productPackets").doc(nextSlot.packetId).get();
          if (nextPacketDoc.exists) {
            const nextPacketData = nextPacketDoc.data() as any;
            if (nextPacketData.landingPageSlug) {
              return res.redirect(302, `/p/${nextPacketData.landingPageSlug}`);
            }
          }
        }

        if (instance.fallbackUrl) {
          return res.redirect(302, instance.fallbackUrl);
        }
        return res.status(404).send("Content not available");
      }

      const packetData = packetDoc.data() as any;

      if (!packetData.landingPageSlug) {
        if (instance.fallbackUrl) {
          return res.redirect(302, instance.fallbackUrl);
        }
        return res.status(404).send("Landing page not configured");
      }

      console.log(`[QR Dynamics] Instance ${instanceId} → Slot ${activeSlot.order} → /p/${packetData.landingPageSlug}`);

      res.redirect(302, `/p/${packetData.landingPageSlug}`);
    } catch (error: any) {
      console.error("[QR Dynamics Resolver] Error:", error);
      res.status(500).send("QR Dynamics error");
    }
  });
}
