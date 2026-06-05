"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const constants_1 = require("../constants");
const middleware_1 = require("../middleware");
const email_1 = require("../services/email");
const members_library_1 = require("./members-library");
function register(app) {
    (0, members_library_1.registerMembersLibraryRoutes)(app);
    // ============ MEMBERS ROUTES (Batch 1) ============
    async function verifyMemberAuthCF(req, memberId) {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer "))
            return { authorized: false, error: "Authorization required" };
        try {
            const decodedToken = await core_1.admin.auth().verifyIdToken(authHeader.slice(7));
            if (!decodedToken)
                return { authorized: false, error: "Invalid token" };
            const isOwnData = decodedToken.uid === memberId;
            const adminIds = (process.env.ADMIN_USER_IDS || "").split(",").map(id => id.trim()).filter(Boolean);
            const isAdminUser = adminIds.includes(decodedToken.uid);
            if (!isOwnData && !isAdminUser)
                return { authorized: false, error: "Access denied" };
            return { authorized: true, userId: decodedToken.uid };
        }
        catch {
            return { authorized: false, error: "Invalid token" };
        }
    }
    app.post('/members/profile', middleware_1.requireAuth, async (req, res) => {
        try {
            const userId = req.user?.uid;
            const { fullName, storeName, creatorSlug, country, useCase, productInterests, socialSurfaces, primarySocial, socialHandle, contactEmail, phoneNumber, attributionSource } = req.body;
            if (!fullName || !storeName || !creatorSlug) {
                res.status(400).json({ error: "fullName, storeName, and creatorSlug are required" });
                return;
            }
            const profileData = { userId, fullName, storeName, creatorSlug, country: country || '', useCase: useCase || '', productInterests: productInterests || [], socialSurfaces: socialSurfaces || [], primarySocial: primarySocial || '', socialHandle: socialHandle || '', contactEmail: contactEmail || '', phoneNumber: phoneNumber || '', attributionSource: attributionSource || '', isMember: true, memberSince: new Date().toISOString(), updatedAt: new Date().toISOString() };
            await core_1.db.collection('member_profiles').doc(userId).set(profileData, { merge: true });
            res.json({ success: true, profile: profileData });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/members/profile', middleware_1.requireAuth, async (req, res) => {
        try {
            const userId = req.user?.uid;
            const doc = await core_1.db.collection('member_profiles').doc(userId).get();
            if (!doc.exists) {
                res.json({ isMember: false });
                return;
            }
            res.json({ isMember: true, profile: doc.data() });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/members/check-status', middleware_1.requireAuth, async (req, res) => {
        try {
            const userId = req.user?.uid;
            const doc = await core_1.db.collection('member_profiles').doc(userId).get();
            res.json({ isMember: doc.exists && doc.data()?.isMember === true });
        }
        catch {
            res.json({ isMember: false });
        }
    });
    app.post('/members/increment-publish', middleware_1.requireAuth, async (req, res) => {
        try {
            const userId = req.user?.uid;
            await core_1.db.collection('member_profiles').doc(userId).set({ publishCount: core_1.admin.firestore.FieldValue.increment(1), updatedAt: new Date().toISOString() }, { merge: true });
            const doc = await core_1.db.collection('member_profiles').doc(userId).get();
            const publishCount = doc.data()?.publishCount ?? 1;
            res.json({ success: true, publishCount });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/members/:memberId/social-handles', async (req, res) => {
        try {
            const { memberId } = req.params;
            const auth = await verifyMemberAuthCF(req, memberId);
            if (!auth.authorized) {
                res.status(401).json({ error: auth.error });
                return;
            }
            const { socialHandles } = req.body;
            if (!socialHandles || typeof socialHandles !== 'object') {
                res.status(400).json({ error: 'socialHandles object is required' });
                return;
            }
            const allowed = ['instagram', 'tiktok', 'x', 'facebook', 'youtube', 'linkedin'];
            const cleaned = {};
            for (const key of allowed) {
                if (typeof socialHandles[key] === 'string')
                    cleaned[key] = socialHandles[key].trim();
            }
            await core_1.db.collection('member_profiles').doc(memberId).set({ socialHandles: cleaned, updatedAt: new Date().toISOString() }, { merge: true });
            res.json({ success: true, socialHandles: cleaned });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/members/:memberId/contact-info', async (req, res) => {
        try {
            const { memberId } = req.params;
            const auth = await verifyMemberAuthCF(req, memberId);
            if (!auth.authorized) {
                res.status(401).json({ error: auth.error });
                return;
            }
            const { contactEmail, phoneNumber } = req.body;
            const update = { updatedAt: new Date().toISOString() };
            if (typeof contactEmail === 'string')
                update.contactEmail = contactEmail.trim();
            if (typeof phoneNumber === 'string')
                update.phoneNumber = phoneNumber.trim();
            await core_1.db.collection('member_profiles').doc(memberId).set(update, { merge: true });
            res.json({ success: true, contactEmail: update.contactEmail || '', phoneNumber: update.phoneNumber || '' });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/members/:memberId/social-schedule', async (req, res) => {
        try {
            const { memberId } = req.params;
            const auth = await verifyMemberAuthCF(req, memberId);
            if (!auth.authorized) {
                res.status(401).json({ error: auth.error });
                return;
            }
            const { packetId, cadence, platforms } = req.body;
            if (!packetId) {
                res.status(400).json({ error: 'packetId is required' });
                return;
            }
            const validCadences = ['daily', 'every-3-days', 'weekly', 'bi-weekly', 'monthly'];
            if (!cadence || !validCadences.includes(cadence)) {
                res.status(400).json({ error: `cadence must be one of: ${validCadences.join(', ')}` });
                return;
            }
            const packetDoc = await core_1.db.collection(constants_1.MEMBER_PACKETS_COLLECTION).doc(packetId).get();
            if (!packetDoc.exists) {
                res.status(404).json({ error: 'Packet not found' });
                return;
            }
            const packetData = packetDoc.data();
            if (packetData?.memberId !== memberId) {
                res.status(403).json({ error: 'Not your packet' });
                return;
            }
            const allowedPlatforms = ['instagram', 'tiktok', 'x', 'facebook', 'youtube', 'linkedin'];
            const cleanedPlatforms = Array.isArray(platforms) ? platforms.filter((p) => allowedPlatforms.includes(p)) : [];
            if (cleanedPlatforms.length === 0) {
                res.status(400).json({ error: 'At least one valid platform is required' });
                return;
            }
            const now = new Date();
            const cadenceMs = { 'daily': 86400000, 'every-3-days': 259200000, 'weekly': 604800000, 'bi-weekly': 1209600000, 'monthly': 2592000000 };
            const nextPostAt = new Date(now.getTime() + (cadenceMs[cadence] || 604800000));
            const scheduleData = { memberId, packetId, cadence, platforms: cleanedPlatforms, lastPostedAt: null, nextPostAt: nextPostAt.toISOString(), isActive: true, createdAt: now.toISOString() };
            const ref = await core_1.db.collection('member_social_schedule').add(scheduleData);
            res.json({ success: true, id: ref.id, ...scheduleData });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/members/:memberId/social-schedule', async (req, res) => {
        try {
            const { memberId } = req.params;
            const auth = await verifyMemberAuthCF(req, memberId);
            if (!auth.authorized) {
                res.status(401).json({ error: auth.error });
                return;
            }
            const snapshot = await core_1.db.collection('member_social_schedule').where('memberId', '==', memberId).get();
            const schedules = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const packetIds = [...new Set(schedules.map((s) => s.packetId).filter(Boolean))];
            const packetMap = {};
            for (const pid of packetIds) {
                const pdoc = await core_1.db.collection(constants_1.MEMBER_PACKETS_COLLECTION).doc(pid).get();
                if (pdoc.exists) {
                    const pd = pdoc.data();
                    packetMap[pid] = { id: pid, title: pd?.title || pd?.simpleTitle || 'Untitled', itemImage: pd?.socialPacket?.itemImage || pd?.itemImage || null, retailPrice: pd?.socialPacket?.retailPrice || pd?.retailPrice || null, shareUrl: pd?.socialPacket?.shareUrl || `/p/${pid}`, referralUrl: pd?.socialPacket?.referralUrl || null, shareCaption: pd?.socialPacket?.shareCaption || null, shareImageSquareUrl: pd?.socialPacket?.shareImageSquareUrl || null, shareImageLinkUrl: pd?.socialPacket?.shareImageLinkUrl || null, qrType: pd?.qrType || pd?.packetType || null };
                }
            }
            const enriched = schedules.map((s) => ({ ...s, packet: packetMap[s.packetId] || null }));
            res.json({ success: true, schedules: enriched });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/members/:memberId/social-schedule/:scheduleId', async (req, res) => {
        try {
            const { memberId, scheduleId } = req.params;
            const auth = await verifyMemberAuthCF(req, memberId);
            if (!auth.authorized) {
                res.status(401).json({ error: auth.error });
                return;
            }
            const docRef = core_1.db.collection('member_social_schedule').doc(scheduleId);
            const doc = await docRef.get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Schedule not found' });
                return;
            }
            if (doc.data()?.memberId !== memberId) {
                res.status(403).json({ error: 'Not your schedule' });
                return;
            }
            const updates = { updatedAt: new Date().toISOString() };
            const validCadences = ['daily', 'every-3-days', 'weekly', 'bi-weekly', 'monthly'];
            if (req.body.cadence && validCadences.includes(req.body.cadence))
                updates.cadence = req.body.cadence;
            if (typeof req.body.isActive === 'boolean')
                updates.isActive = req.body.isActive;
            if (Array.isArray(req.body.platforms)) {
                const allowedPlatforms = ['instagram', 'tiktok', 'x', 'facebook', 'youtube', 'linkedin'];
                updates.platforms = req.body.platforms.filter((p) => allowedPlatforms.includes(p));
            }
            if (req.body.cadence && validCadences.includes(req.body.cadence)) {
                const cadenceMs = { 'daily': 86400000, 'every-3-days': 259200000, 'weekly': 604800000, 'bi-weekly': 1209600000, 'monthly': 2592000000 };
                const lastPosted = doc.data()?.lastPostedAt ? new Date(doc.data()?.lastPostedAt).getTime() : Date.now();
                updates.nextPostAt = new Date(lastPosted + (cadenceMs[req.body.cadence] || 604800000)).toISOString();
            }
            await docRef.update(updates);
            const updated = await docRef.get();
            res.json({ success: true, schedule: { id: scheduleId, ...updated.data() } });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/members/:memberId/social-schedule/:scheduleId', async (req, res) => {
        try {
            const { memberId, scheduleId } = req.params;
            const auth = await verifyMemberAuthCF(req, memberId);
            if (!auth.authorized) {
                res.status(401).json({ error: auth.error });
                return;
            }
            const docRef = core_1.db.collection('member_social_schedule').doc(scheduleId);
            const doc = await docRef.get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Schedule not found' });
                return;
            }
            if (doc.data()?.memberId !== memberId) {
                res.status(403).json({ error: 'Not your schedule' });
                return;
            }
            await docRef.delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/members/:memberId/social-schedule/:scheduleId/mark-posted', async (req, res) => {
        try {
            const { memberId, scheduleId } = req.params;
            const auth = await verifyMemberAuthCF(req, memberId);
            if (!auth.authorized) {
                res.status(401).json({ error: auth.error });
                return;
            }
            const docRef = core_1.db.collection('member_social_schedule').doc(scheduleId);
            const doc = await docRef.get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Schedule not found' });
                return;
            }
            if (doc.data()?.memberId !== memberId) {
                res.status(403).json({ error: 'Not your schedule' });
                return;
            }
            const now = new Date();
            const cadence = doc.data()?.cadence || 'weekly';
            const cadenceMs = { 'daily': 86400000, 'every-3-days': 259200000, 'weekly': 604800000, 'bi-weekly': 1209600000, 'monthly': 2592000000 };
            const nextPostAt = new Date(now.getTime() + (cadenceMs[cadence] || 604800000));
            await docRef.update({ lastPostedAt: now.toISOString(), nextPostAt: nextPostAt.toISOString(), updatedAt: now.toISOString() });
            res.json({ success: true, lastPostedAt: now.toISOString(), nextPostAt: nextPostAt.toISOString() });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/members/:memberId/social-schedule/send-reminders', async (req, res) => {
        try {
            const { memberId } = req.params;
            const auth = await verifyMemberAuthCF(req, memberId);
            if (!auth.authorized) {
                res.status(401).json({ error: auth.error });
                return;
            }
            const profileDoc = await core_1.db.collection('member_profiles').doc(memberId).get();
            const profile = profileDoc.data();
            let memberEmail = profile?.email || null;
            if (!memberEmail) {
                try {
                    const userRecord = await core_1.admin.auth().getUser(memberId);
                    memberEmail = userRecord.email || null;
                }
                catch { }
            }
            if (!memberEmail) {
                res.status(400).json({ error: 'No email address found' });
                return;
            }
            const memberName = profile?.fullName || profile?.storeName || 'Creator';
            const snapshot = await core_1.db.collection('member_social_schedule').where('memberId', '==', memberId).where('isActive', '==', true).get();
            const now = new Date();
            const dueItems = [];
            for (const doc of snapshot.docs) {
                const data = doc.data();
                if (new Date(data.nextPostAt) <= now) {
                    const packetDoc = await core_1.db.collection(constants_1.MEMBER_PACKETS_COLLECTION).doc(data.packetId).get();
                    const pd = packetDoc.data();
                    dueItems.push({
                        title: pd?.title || pd?.simpleTitle || 'Your Product',
                        image: pd?.socialPacket?.itemImage || pd?.itemImage || null,
                        shareUrl: pd?.socialPacket?.referralUrl || pd?.socialPacket?.shareUrl || `https://qrgear-c1ffd.web.app/p/${data.packetId}`,
                        caption: pd?.socialPacket?.shareCaption || `Check out ${pd?.title || 'this product'}!`,
                        cadence: data.cadence,
                        platforms: data.platforms || [],
                    });
                }
            }
            if (dueItems.length === 0) {
                res.json({ success: true, sent: false, message: 'No items due for posting' });
                return;
            }
            const resend = (0, email_1.getResendClient)();
            if (!resend) {
                res.status(500).json({ error: 'Email service not configured' });
                return;
            }
            const platformLabels = { instagram: 'Instagram', tiktok: 'TikTok', x: 'X (Twitter)', facebook: 'Facebook', youtube: 'YouTube', linkedin: 'LinkedIn' };
            const itemsHtml = dueItems.map(item => `
      <div style="margin-bottom:24px;padding:16px;background:#f8f9fa;border-radius:8px;border:1px solid #e9ecef;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          ${item.image ? `<img src="${item.image}" alt="" style="width:60px;height:60px;object-fit:cover;border-radius:6px;" />` : ''}
          <div>
            <h3 style="margin:0;font-size:16px;color:#1a1a2e;">${item.title}</h3>
            <p style="margin:4px 0 0;font-size:13px;color:#666;">Post to: ${item.platforms.map((p) => platformLabels[p] || p).join(', ')}</p>
          </div>
        </div>
        <div style="padding:12px;background:#fff;border-radius:6px;margin-bottom:12px;">
          <p style="margin:0;font-size:14px;color:#333;">${item.caption}</p>
        </div>
        <a href="${item.shareUrl}" style="display:inline-block;padding:8px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;">View Product</a>
      </div>
    `).join('');
            const html = `
      <div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="padding:24px;background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:12px 12px 0 0;">
          <h1 style="margin:0;color:#fff;font-size:22px;">Time to Post!</h1>
          <p style="margin:8px 0 0;color:#a0aec0;font-size:14px;">Hey ${memberName}, you have ${dueItems.length} ${dueItems.length === 1 ? 'product' : 'products'} ready to share.</p>
        </div>
        <div style="padding:24px;background:#fff;">
          ${itemsHtml}
          <div style="text-align:center;margin-top:24px;">
            <a href="https://qrgear-c1ffd.web.app/members" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">Open Social Hub</a>
          </div>
        </div>
        <div style="padding:16px;text-align:center;color:#999;font-size:12px;">
          <p>You're receiving this because you have active social schedules on QR Gear.</p>
          <p>Share & Earn — Forever. 25% of every sale, for life.</p>
        </div>
      </div>
    `;
            await resend.emails.send({
                from: email_1.QR_GEAR_FROM_EMAIL,
                to: memberEmail,
                subject: `${dueItems.length} ${dueItems.length === 1 ? 'product' : 'products'} ready to post — QR Gear`,
                html,
            });
            res.json({ success: true, sent: true, itemCount: dueItems.length });
        }
        catch (error) {
            console.error('[Social Reminder Email]', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/members/:memberId/channels', async (req, res) => {
        try {
            const { memberId } = req.params;
            const auth = await verifyMemberAuthCF(req, memberId);
            if (!auth.authorized) {
                res.status(401).json({ error: auth.error });
                return;
            }
            const snapshot = await core_1.db.collection("channels").where("ownerId", "==", memberId).get();
            const channels = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            res.json(channels);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/members/:memberId/channels', async (req, res) => {
        try {
            const { memberId } = req.params;
            const { name, storeId } = req.body;
            if (!memberId || !name) {
                res.status(400).json({ error: "memberId and name are required" });
                return;
            }
            const auth = await verifyMemberAuthCF(req, memberId);
            if (!auth.authorized) {
                res.status(401).json({ error: auth.error });
                return;
            }
            const channelData = { name, storeId: storeId || constants_1.PLATFORM_STORE_ID, ownerId: memberId, type: 'member', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            const docRef = await core_1.db.collection("channels").add(channelData);
            res.json({ id: docRef.id, ...channelData });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/members/:memberId/channels/:channelId', async (req, res) => {
        try {
            const { memberId, channelId } = req.params;
            const auth = await verifyMemberAuthCF(req, memberId);
            if (!auth.authorized) {
                res.status(401).json({ error: auth.error });
                return;
            }
            const channelDoc = await core_1.db.collection('channels').doc(channelId).get();
            if (!channelDoc.exists) {
                res.status(404).json({ error: 'Channel not found' });
                return;
            }
            if (channelDoc.data()?.ownerId !== memberId) {
                res.status(403).json({ error: 'Not authorized' });
                return;
            }
            const packetsSnap = await core_1.db.collection(constants_1.MEMBER_PACKETS_COLLECTION).where('channelId', '==', channelId).where('memberId', '==', memberId).get();
            const batch = core_1.db.batch();
            packetsSnap.docs.forEach(doc => batch.update(doc.ref, { channelId: null }));
            batch.delete(core_1.db.collection('channels').doc(channelId));
            await batch.commit();
            console.log(`[CF] Deleted channel ${channelId}, unlinked ${packetsSnap.size} packets`);
            res.json({ success: true, unlinkedPackets: packetsSnap.size });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/members/:memberId/channels/:channelId/remove-item', async (req, res) => {
        try {
            const { memberId, channelId } = req.params;
            const { itemId, itemType } = req.body;
            if (itemType !== 'packet') {
                res.status(400).json({ error: 'Only packet items are supported' });
                return;
            }
            const auth = await verifyMemberAuthCF(req, memberId);
            if (!auth.authorized) {
                res.status(401).json({ error: auth.error });
                return;
            }
            const doc = await core_1.db.collection(constants_1.MEMBER_PACKETS_COLLECTION).doc(itemId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Item not found' });
                return;
            }
            const data = doc.data();
            if (data?.memberId !== memberId && data?.ownerId !== memberId) {
                res.status(403).json({ error: 'Not authorized' });
                return;
            }
            if (data?.channelId !== channelId) {
                res.status(400).json({ error: 'Item not in this channel' });
                return;
            }
            await core_1.db.collection(constants_1.MEMBER_PACKETS_COLLECTION).doc(itemId).update({ channelId: null });
            console.log(`[CF] Removed packet ${itemId} from channel ${channelId}`);
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.patch('/members/:memberId/packets/:packetId/description', async (req, res) => {
        try {
            const { memberId, packetId } = req.params;
            const auth = await verifyMemberAuthCF(req, memberId);
            if (!auth.authorized) {
                res.status(401).json({ error: auth.error });
                return;
            }
            const { memberPacketDescription } = req.body;
            if (typeof memberPacketDescription !== 'string') {
                res.status(400).json({ error: 'memberPacketDescription is required' });
                return;
            }
            const packetDoc = await core_1.db.collection(constants_1.MEMBER_PACKETS_COLLECTION).doc(packetId).get();
            if (!packetDoc.exists) {
                res.status(404).json({ error: 'Packet not found' });
                return;
            }
            const packetData = packetDoc.data();
            if (packetData?.memberId !== memberId) {
                res.status(403).json({ error: 'Not your packet' });
                return;
            }
            const boundProduct = packetData?.boundProduct || {};
            const providerDesc = boundProduct.providerDescription || '';
            const adminDesc = boundProduct.adminCatalogDescription || '';
            const effectiveDescription = memberPacketDescription || adminDesc || providerDesc || '';
            await core_1.db.collection(constants_1.MEMBER_PACKETS_COLLECTION).doc(packetId).update({
                'boundProduct.memberPacketDescription': memberPacketDescription,
                'boundProduct.effectiveDescription': effectiveDescription,
                'boundProduct.description': effectiveDescription,
                updatedAt: new Date().toISOString(),
            });
            res.json({ success: true, effectiveDescription });
        }
        catch (error) {
            console.error('[Members] Patch packet description error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/members/:memberId/products/:productId', async (_req, res) => {
        res.status(410).json({ error: 'This endpoint is deprecated. Use /members/:memberId/packets/:packetId instead.' });
    });
    app.get('/members/:memberId/products', async (_req, res) => {
        res.status(410).json({ error: 'This endpoint is deprecated. Use /members/:memberId/packets instead.' });
    });
    app.post('/members/:memberId/products', async (req, res) => {
        try {
            const { memberId } = req.params;
            const body = req.body;
            const auth = await verifyMemberAuthCF(req, memberId);
            if (!auth.authorized) {
                res.status(401).json({ error: auth.error });
                return;
            }
            const { packetType, title, description, storeId, status, qrType, channelId, headerText, footerText, videoUrl, textLines, textUpcharge, placementUpcharge, memberEarnings, boundProduct, selectedColor, selectedShirtSize, selectedPlacements, perPlacementConfigs, perPlacementSizes, graphicSize, textLayoutChoice, headerStyle, footerStyle, qrDestination, qrBasicInputType, qrBasicContent, qrBasicMockup, qrBasicSaveChoice, qrPlusMockup, qrPlusSaveChoice, qrCanvasMockup, qrPlayMockup, source, printfulProductId, variantId, graphicUrl, name, price } = body;
            if (packetType === 'qr-canvas' || packetType === 'qr-play' || packetType === 'qr-basic' || packetType === 'qr-plus' || packetType === 'qr-compose') {
                const existingPacketId = body.existingPacketId;
                let packetId = existingPacketId || `pkt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
                const baseUrl = process.env.PUBLIC_URL || 'https://qrgear-c1ffd.web.app';
                const destinationUrl = `${baseUrl}/view/${packetId}`;
                const now = new Date().toISOString();
                const packetData = {
                    id: packetId, memberId, storeId: storeId || constants_1.PLATFORM_STORE_ID, channelId: channelId || null, packetType,
                    title: title || 'Untitled', description: description || '', status: status || 'published',
                    createdAt: now, updatedAt: now, source: source || { entryPoint: 'wizard' },
                    boundProduct: boundProduct || null, selectedColor: selectedColor || null,
                    selectedShirtSize: selectedShirtSize || null, selectedPlacements: selectedPlacements || null,
                    perPlacementConfigs: perPlacementConfigs || null, perPlacementSizes: perPlacementSizes || null,
                    graphicSize: graphicSize || null, textLayoutChoice: textLayoutChoice || null,
                    headerStyle: (0, core_1.sanitizeStyleForFirestore)(headerStyle) || null, footerStyle: (0, core_1.sanitizeStyleForFirestore)(footerStyle) || null,
                    qrType: qrType || packetType, qrDestination: qrDestination || null,
                    qrGraphic: body.qrGraphic || null, productGraphic: body.productGraphic || null,
                    urlGraphic: body.background || null, originalUrlGraphic: body.originalUrlGraphic || null,
                    videoUrl: videoUrl || null,
                    destinationUrl: (packetType === 'qr-canvas' || packetType === 'qr-play') ? destinationUrl : null,
                    qrBasicInputType: qrBasicInputType || null, qrBasicContent: qrBasicContent || null,
                    qrBasicMockup: qrBasicMockup || null, qrBasicSaveChoice: qrBasicSaveChoice || null,
                    qrPlusMockup: qrPlusMockup || null, qrPlusSaveChoice: qrPlusSaveChoice || null,
                    qrCanvasMockup: qrCanvasMockup || null, qrPlayMockup: qrPlayMockup || null,
                    composeMockup: body.composeMockup || null, composeItems: body.composeItems || null,
                    composeMode: body.composeMode || 'auto-rotate', composeHostingTerm: body.composeHostingTerm || null,
                    composeInstanceId: null, textLines: textLines || 0, textUpcharge: textUpcharge || 0,
                    placementUpcharge: placementUpcharge || 0, memberEarnings: memberEarnings || 0,
                    itemImage: body.itemImage || qrCanvasMockup || qrBasicMockup || qrPlusMockup || qrPlayMockup || body.composeMockup || body.productGraphic || body.qrGraphic || null,
                };
                try {
                    if (boundProduct?.blueprintId && boundProduct?.printProviderId) {
                        const providerDocId = `${boundProduct.blueprintId}_${boundProduct.printProviderId}`;
                        const providerDoc = await core_1.db.collection('printifyPrintProviders').doc(providerDocId).get();
                        if (providerDoc.exists) {
                            const provData = providerDoc.data();
                            const printifyCostBase = (provData?.minCost || 0) / 100;
                            const pricingDoc = await core_1.db.collection("testSettings").doc("pricing").get();
                            const ps = pricingDoc.exists ? pricingDoc.data() : {};
                            const pMP = ps?.markupPercent ?? 25;
                            const pMF = ps?.markupFixed ?? 0;
                            const pAPC = ps?.additionalPlacementCost ?? 4;
                            const pTLU = ps?.textLineUpcharge ?? 2;
                            const pMPS = ps?.memberProfitShare ?? 0.25;
                            const numTL = textLines || 0;
                            const textUpT = numTL * pTLU;
                            const plArr = selectedPlacements ? (Array.isArray(selectedPlacements) ? selectedPlacements : [selectedPlacements]) : [];
                            const placementUpT = Math.max(0, plArr.length - 1) * pAPC;
                            const totalCostBase = printifyCostBase + textUpT + placementUpT;
                            const retailPriceBase = Math.round((totalCostBase * (1 + pMP / 100) + pMF) * 100) / 100;
                            const profitBase = Math.round((retailPriceBase - printifyCostBase) * 100) / 100;
                            const memberEarningsBase = Math.round((profitBase * pMPS) * 100) / 100;
                            const adminMarginBase = Math.round((profitBase - memberEarningsBase) * 100) / 100;
                            packetData.pricingSnapshot = { printifyCostBase, customerPrice: retailPriceBase, textLines: numTL, textUpchargeTotal: textUpT, extraPlacements: Math.max(0, plArr.length - 1), placementUpchargeTotal: placementUpT, markupPercent: pMP, markupFixed: pMF, totalCostBase, retailPriceBase, profitBase, memberProfitShare: pMPS, memberEarningsBase, adminMarginBase, memberEarningsRange: { min: memberEarningsBase, max: memberEarningsBase }, calculatedAt: new Date().toISOString() };
                        }
                    }
                }
                catch (pricingErr) {
                    console.error('[UnifiedPublish CF] Pricing snapshot failed (non-fatal):', pricingErr.message);
                }
                const socialBaseUrl = process.env.PUBLIC_URL || 'https://qrgear-c1ffd.web.app';
                packetData.socialPacket = {
                    itemImage: packetData.itemImage || null,
                    title: packetData.title || 'QR Gear Product',
                    description: packetData.description || '',
                    retailPrice: packetData.pricingSnapshot?.retailPriceBase || boundProduct?.retailPrice || null,
                    shareUrl: `${socialBaseUrl}/p/${packetId}`,
                    referralUrl: `${socialBaseUrl}/p/${packetId}?ref=${memberId}`,
                    memberId,
                    createdAt: new Date().toISOString(),
                };
                await core_1.db.collection(constants_1.MEMBER_PACKETS_COLLECTION).doc(packetId).set(packetData);
                if (packetType === 'qr-compose' && body.composeItems && Array.isArray(body.composeItems)) {
                    try {
                        const nowEpoch = Math.floor(Date.now() / 1000);
                        const instanceData = { memberId, packetId, createdAt: nowEpoch, startTimestamp: nowEpoch, mode: 'loop', composeMode: body.composeMode || 'auto-rotate', hostingTerm: body.composeHostingTerm || '1-year', fallbackUrl: null, slots: body.composeItems.map((item, index) => ({ slotId: `slot-${Date.now()}-${index}`, packetId: item.packetId, name: item.name || 'Untitled', thumbnailUrl: item.thumbnailUrl || null, type: item.type || 'qr-canvas', durationSeconds: item.durationSeconds || 86400, order: item.order ?? index + 1 })) };
                        const instanceRef = await core_1.db.collection(constants_1.QR_DYNAMICS_INSTANCES_COLLECTION).add(instanceData);
                        await core_1.db.collection(constants_1.MEMBER_PACKETS_COLLECTION).doc(packetId).update({ composeInstanceId: instanceRef.id, destinationUrl: `/qr/d/${instanceRef.id}` });
                        packetData.composeInstanceId = instanceRef.id;
                        packetData.destinationUrl = `/qr/d/${instanceRef.id}`;
                    }
                    catch (instanceErr) {
                        console.error('[QR Compose CF] Instance creation failed:', instanceErr);
                    }
                }
                res.json(packetData);
                return;
            }
            res.status(400).json({ error: "Direct product creation is deprecated. Submit a packet via packetType field instead." });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/members/:memberId/published-items', async (req, res) => {
        try {
            const { memberId } = req.params;
            const types = req.query.types;
            const auth = await verifyMemberAuthCF(req, memberId);
            if (!auth.authorized) {
                res.status(401).json({ error: auth.error });
                return;
            }
            const normalizeType = (type) => {
                if (!type)
                    return '';
                return String(type).replace(/_/g, '-').toLowerCase();
            };
            const requestedTypes = types
                ? types.split(',').map((t) => normalizeType(t.trim()))
                : [];
            const snapshot = await core_1.db.collection(constants_1.MEMBER_PACKETS_COLLECTION).where('memberId', '==', memberId).where('status', '==', 'published').get();
            const items = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                const rawType = data.packetType || data.kind || '';
                const normalizedType = normalizeType(rawType);
                const normalizedItem = { id: doc.id, packetId: doc.id, ...data, packetType: normalizedType };
                if (requestedTypes.length === 0 || requestedTypes.includes(normalizedType)) {
                    items.push(normalizedItem);
                }
            });
            res.json({ items });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/members/:memberId/earnings', async (req, res) => {
        try {
            const { memberId } = req.params;
            const auth = await verifyMemberAuthCF(req, memberId);
            if (!auth.authorized) {
                res.status(401).json({ error: auth.error });
                return;
            }
            const snapshot = await core_1.db.collection("memberEarnings").where("memberId", "==", memberId).orderBy("createdAt", "desc").get();
            const earnings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const totalEarnings = earnings.reduce((sum, e) => sum + (e.amount || 0), 0);
            const pendingEarnings = earnings.filter((e) => e.status === 'pending').reduce((sum, e) => sum + (e.amount || 0), 0);
            const paidEarnings = earnings.filter((e) => e.status === 'paid').reduce((sum, e) => sum + (e.amount || 0), 0);
            res.json({ earnings, summary: { total: totalEarnings, pending: pendingEarnings, paid: paidEarnings, profitShare: 0.25 } });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // ── Public creator surface ────────────────────────────────────────────────────
    // GET /public/creator/:slug
    // No auth required. Accepts creatorSlug (human-readable) or memberId (UID fallback).
    app.get('/public/creator/:slug', async (req, res) => {
        try {
            const { slug } = req.params;
            if (!slug) {
                res.status(400).json({ error: 'slug is required' });
                return;
            }
            let profileSnap = null;
            let userId = null;
            // Primary lookup: creatorSlug field
            const bySlug = await core_1.db.collection('member_profiles').where('creatorSlug', '==', slug).limit(1).get();
            if (!bySlug.empty) {
                profileSnap = bySlug.docs[0];
                userId = bySlug.docs[0].id;
            }
            else {
                // Fallback: treat slug as Firebase UID (doc ID)
                const byId = await core_1.db.collection('member_profiles').doc(slug).get();
                if (byId.exists) {
                    profileSnap = byId;
                    userId = byId.id;
                }
            }
            if (!profileSnap || !userId) {
                res.status(404).json({ error: 'Creator not found' });
                return;
            }
            const profileData = profileSnap.data();
            // Optional channel filter from query string
            const channelFilter = req.query.channel;
            // Build query — filter by channel if provided
            let query = core_1.db.collection(constants_1.MEMBER_PACKETS_COLLECTION)
                .where('memberId', '==', userId)
                .where('status', '==', 'published');
            if (channelFilter)
                query = query.where('channelId', '==', channelFilter);
            const packetsSnap = await query.orderBy('updatedAt', 'desc').limit(50).get();
            const items = packetsSnap.docs.map(doc => {
                const d = doc.data();
                return {
                    id: doc.id,
                    title: d.title || 'QR Gear Product',
                    description: d.description || '',
                    itemImage: d.qrCanvasMockup || d.qrBasicMockup || d.qrPlusMockup || d.qrPlayMockup || d.composeMockup || d.productGraphic || null,
                    retailPrice: d.pricingSnapshot?.retailPriceBase ?? d.pricingSnapshot?.customerPrice ?? null,
                    qrType: d.qrType || d.packetType || null,
                    status: d.status || 'published',
                    channelId: d.channelId || null,
                    updatedAt: d.updatedAt || '',
                };
            });
            // Resolve channel display name: prefer explicit filter, else first packet's channel
            let channelName = null;
            const resolveChannelId = channelFilter || items.find(p => p.channelId)?.channelId;
            if (resolveChannelId) {
                try {
                    const channelDoc = await core_1.db.collection('channels').doc(resolveChannelId).get();
                    if (channelDoc.exists)
                        channelName = channelDoc.data()?.name || null;
                }
                catch (_) { }
            }
            res.json({
                success: true,
                profile: {
                    storeName: profileData.storeName || '',
                    fullName: profileData.fullName || '',
                    creatorSlug: profileData.creatorSlug || slug,
                    memberId: userId,
                    socialHandle: profileData.socialHandle || '',
                    primarySocial: profileData.primarySocial || '',
                },
                items,
                channelName,
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=members.js.map