"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const constants_1 = require("../constants");
const middleware_1 = require("../middleware");
const mockup_generator_1 = require("../services/mockup-generator");
const email_1 = require("../services/email");
const composite_image_1 = require("../services/composite-image");
function register(app) {
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
            const packetDoc = await core_1.db.collection('memberPackets').doc(packetId).get();
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
                const pdoc = await core_1.db.collection('memberPackets').doc(pid).get();
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
                    const packetDoc = await core_1.db.collection('memberPackets').doc(data.packetId).get();
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
            const productsSnap = await core_1.db.collection('memberProducts').where('channelId', '==', channelId).get();
            const packetsSnap = await core_1.db.collection('memberPackets').where('channelId', '==', channelId).where('memberId', '==', memberId).get();
            const batch = core_1.db.batch();
            productsSnap.docs.forEach(doc => batch.update(doc.ref, { channelId: null }));
            packetsSnap.docs.forEach(doc => batch.update(doc.ref, { channelId: null }));
            batch.delete(core_1.db.collection('channels').doc(channelId));
            await batch.commit();
            console.log(`[CF] Deleted channel ${channelId}, unlinked ${productsSnap.size} products and ${packetsSnap.size} packets`);
            res.json({ success: true, unlinkedProducts: productsSnap.size, unlinkedPackets: packetsSnap.size });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/members/:memberId/channels/:channelId/remove-item', async (req, res) => {
        try {
            const { memberId, channelId } = req.params;
            const { itemId, itemType } = req.body;
            const auth = await verifyMemberAuthCF(req, memberId);
            if (!auth.authorized) {
                res.status(401).json({ error: auth.error });
                return;
            }
            const collection = itemType === 'packet' ? 'memberPackets' : 'memberProducts';
            const doc = await core_1.db.collection(collection).doc(itemId).get();
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
            await core_1.db.collection(collection).doc(itemId).update({ channelId: null });
            console.log(`[CF] Removed ${itemType} ${itemId} from channel ${channelId}`);
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/members/:memberId/products/:productId', async (req, res) => {
        try {
            const { memberId, productId } = req.params;
            const auth = await verifyMemberAuthCF(req, memberId);
            if (!auth.authorized) {
                res.status(401).json({ error: auth.error });
                return;
            }
            const doc = await core_1.db.collection('memberProducts').doc(productId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Product not found' });
                return;
            }
            if (doc.data()?.memberId !== memberId) {
                res.status(403).json({ error: 'Not authorized' });
                return;
            }
            const packetId = doc.data()?.packetId;
            if (packetId) {
                const packetDoc = await core_1.db.collection('memberPackets').doc(packetId).get();
                if (packetDoc.exists && packetDoc.data()?.memberId === memberId) {
                    await core_1.db.collection('memberPackets').doc(packetId).delete();
                }
            }
            await core_1.db.collection('memberProducts').doc(productId).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/members/:memberId/products', async (req, res) => {
        try {
            const { memberId } = req.params;
            const auth = await verifyMemberAuthCF(req, memberId);
            if (!auth.authorized) {
                res.status(401).json({ error: auth.error });
                return;
            }
            const snapshot = await core_1.db.collection("memberProducts").where("memberId", "==", memberId).orderBy("createdAt", "desc").get();
            const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            res.json(products);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
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
                    id: packetId, memberId, storeId: storeId || memberId, channelId: channelId || null, packetType,
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
                await core_1.db.collection("memberPackets").doc(packetId).set(packetData);
                if (packetType === 'qr-compose' && body.composeItems && Array.isArray(body.composeItems)) {
                    try {
                        const nowEpoch = Math.floor(Date.now() / 1000);
                        const instanceData = { memberId, packetId, createdAt: nowEpoch, startTimestamp: nowEpoch, mode: 'loop', composeMode: body.composeMode || 'auto-rotate', hostingTerm: body.composeHostingTerm || '1-year', fallbackUrl: null, slots: body.composeItems.map((item, index) => ({ slotId: `slot-${Date.now()}-${index}`, packetId: item.packetId, name: item.name || 'Untitled', thumbnailUrl: item.thumbnailUrl || null, type: item.type || 'qr-canvas', durationSeconds: item.durationSeconds || 86400, order: item.order ?? index + 1 })) };
                        const instanceRef = await core_1.db.collection("qr_dynamics_instances").add(instanceData);
                        await core_1.db.collection("memberPackets").doc(packetId).update({ composeInstanceId: instanceRef.id, destinationUrl: `/qr/d/${instanceRef.id}` });
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
            if (!printfulProductId) {
                res.status(400).json({ error: "printfulProductId is required for product creation" });
                return;
            }
            const productData = { memberId, printfulProductId, variantId, graphicUrl, qrType: qrType || 'play', qrDestination, channelId, name: name || 'My Product', price: price || 0, textLines: textLines || 0, textUpcharge: textUpcharge || 0, placementUpcharge: placementUpcharge || 0, memberEarnings: memberEarnings || 0, status: 'draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            const docRef = await core_1.db.collection("memberProducts").add(productData);
            res.json({ id: docRef.id, ...productData });
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
            const snapshot = await core_1.db.collection('memberPackets').where('memberId', '==', memberId).where('status', '==', 'published').get();
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
    app.get('/members/:memberId/graphics', async (req, res) => {
        try {
            const { memberId } = req.params;
            const auth = await verifyMemberAuthCF(req, memberId);
            if (!auth.authorized) {
                res.status(401).json({ error: auth.error });
                return;
            }
            const snapshot = await core_1.db.collection("hostedImages").where("userId", "==", memberId).get();
            const images = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const graphicSets = [{ id: 'my-uploads', name: 'My Uploads', thumbnailUrl: images[0]?.storageUrl || '', imageCount: images.length, images: images.map((img) => ({ id: img.id, url: img.storageUrl, name: img.fileName, createdAt: img.createdAt })) }];
            res.json(graphicSets);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/members/:memberId/packets', async (req, res) => {
        try {
            const { memberId } = req.params;
            const { kind, urlContent, background, textLayers, boundProduct, metadata, source, status } = req.body;
            if (!memberId) {
                res.status(400).json({ error: "memberId is required" });
                return;
            }
            if (!background?.url) {
                res.status(400).json({ error: "background.url is required" });
                return;
            }
            const packetId = `pkt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const packetData = { packetId, memberId, kind: kind || 'qr_canvas', urlContent: urlContent || null, background: { url: background.url, crop: background.crop || null, assetId: background.assetId || null }, textLayers: textLayers || [], boundProduct: boundProduct || null, metadata: metadata || null, source: source || { entryPoint: 'wizard' }, status: status || 'draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            await core_1.db.collection('memberPackets').doc(packetId).set(packetData);
            res.json({ packetId, success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.patch('/members/:memberId/packets/:packetId', async (req, res) => {
        try {
            const { memberId, packetId } = req.params;
            const updates = req.body;
            if (!memberId || !packetId) {
                res.status(400).json({ error: "memberId and packetId are required" });
                return;
            }
            const doc = await core_1.db.collection('memberPackets').doc(packetId).get();
            if (!doc.exists) {
                res.status(404).json({ error: "Packet not found" });
                return;
            }
            if (doc.data()?.memberId !== memberId) {
                res.status(403).json({ error: "Not authorized" });
                return;
            }
            const memberClean = (0, core_1.stripUndef)(updates);
            if (memberClean.headerStyle)
                memberClean.headerStyle = (0, core_1.sanitizeStyleForFirestore)(memberClean.headerStyle);
            if (memberClean.footerStyle)
                memberClean.footerStyle = (0, core_1.sanitizeStyleForFirestore)(memberClean.footerStyle);
            await core_1.db.collection('memberPackets').doc(packetId).update({ ...memberClean, updatedAt: new Date().toISOString() });
            res.json({ success: true, packetId });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/members/:memberId/claim-temp-packet', middleware_1.requireAuth, async (req, res) => {
        try {
            const { memberId } = req.params;
            const { tempPacketId } = req.body;
            if (!tempPacketId) {
                res.status(400).json({ error: "tempPacketId is required" });
                return;
            }
            const docRef = core_1.db.collection('temp_packets').doc(tempPacketId);
            const doc = await docRef.get();
            if (!doc.exists) {
                res.status(404).json({ error: "Temp packet not found or expired" });
                return;
            }
            const packet = doc.data();
            if (packet.status === 'completed') {
                res.status(410).json({ error: "Temp packet already used" });
                return;
            }
            await docRef.update({ claimedByMemberId: memberId, claimedAt: new Date().toISOString(), status: 'claimed', updatedAt: new Date().toISOString() });
            res.json({ success: true, packetConfig: { blueprintId: packet.blueprintId || null, productTitle: packet.productTitle || null, selectedColor: packet.selectedColor || null, selectedShirtSize: packet.selectedShirtSize || null, qrType: packet.qrType || null, selectedPlacements: packet.selectedPlacements || [], graphicSize: packet.graphicSize || null, headerStyle: packet.headerStyle || null, footerStyle: packet.footerStyle || null, textLayoutChoice: packet.textLayoutChoice || null, qrBasicContent: packet.qrBasicContent || null, mockupUrl: packet.mockupUrl || null, lifestyleMockupUrl: packet.lifestyleMockupUrl || null } });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/member/packets', async (req, res) => {
        try {
            const { memberId, kind, urlContent, background, textLayers, boundProduct, metadata, source, status } = req.body;
            if (!memberId) {
                res.status(400).json({ error: "memberId is required" });
                return;
            }
            if (!background?.url) {
                res.status(400).json({ error: "background.url is required" });
                return;
            }
            const packetId = `pkt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const packetData = { packetId, memberId, kind: kind || 'qr_canvas', urlContent: urlContent || null, background: { url: background.url, crop: background.crop || null, assetId: background.assetId || null }, textLayers: textLayers || [], boundProduct: boundProduct || null, metadata: metadata || null, source: source || { entryPoint: 'wizard' }, status: status || 'draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            await core_1.db.collection('memberPackets').doc(packetId).set(packetData);
            res.json({ packetId, success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/member/packets', async (req, res) => {
        try {
            const memberId = req.query.memberId;
            if (!memberId) {
                res.status(400).json({ error: "memberId is required" });
                return;
            }
            const snapshot = await core_1.db.collection('memberPackets').where('memberId', '==', memberId).limit(100).get();
            const packets = snapshot.docs.map(doc => doc.data());
            res.json({ packets });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/member/packets/:packetId', async (req, res) => {
        try {
            const { packetId } = req.params;
            const { memberId } = req.body;
            if (!packetId || !memberId) {
                res.status(400).json({ error: "packetId and memberId are required" });
                return;
            }
            const doc = await core_1.db.collection('memberPackets').doc(packetId).get();
            if (!doc.exists) {
                res.status(404).json({ error: "Packet not found" });
                return;
            }
            if (doc.data()?.memberId !== memberId) {
                res.status(403).json({ error: "Not authorized" });
                return;
            }
            await core_1.db.collection('memberPackets').doc(packetId).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/member/graphics/create', async (req, res) => {
        try {
            const { memberId, packetId } = req.body;
            if (!memberId || !packetId) {
                res.status(400).json({ error: "memberId and packetId are required" });
                return;
            }
            const packetDoc = await core_1.db.collection('memberPackets').doc(packetId).get();
            if (!packetDoc.exists) {
                res.status(404).json({ error: "Packet not found" });
                return;
            }
            const packet = packetDoc.data();
            if (!packet || packet.memberId !== memberId) {
                res.status(403).json({ error: "Not authorized" });
                return;
            }
            const graphicsId = `gfx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const compositeUrl = packet.background?.url || null;
            const graphicsData = { graphicsId, packetId, memberId, compositeUrl, qrOnlyUrl: null, status: 'generated', createdAt: new Date().toISOString() };
            await core_1.db.collection('memberGraphics').doc(graphicsId).set(graphicsData);
            await core_1.db.collection('memberPackets').doc(packetId).update({ status: 'graphics_ready', graphicsId, updatedAt: new Date().toISOString() });
            res.json({ graphicsId, compositeUrl, qrOnlyUrl: null });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/member/templates/save', async (req, res) => {
        try {
            const { memberId, packetId, compositeUrl, titleText, descriptionText, kind, metadata } = req.body;
            if (!memberId || !packetId) {
                res.status(400).json({ error: "memberId and packetId are required" });
                return;
            }
            const templateId = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const packetDoc = await core_1.db.collection('memberPackets').doc(packetId).get();
            const packetData = packetDoc.data() || {};
            const templateData = { templateId, packetId, memberId, kind: kind || packetData.kind || 'qr_canvas', compositeUrl: compositeUrl || null, titleText: titleText || '', descriptionText: descriptionText || '', background: packetData.background || null, textLayers: packetData.textLayers || [], metadata: metadata || null, createdAt: new Date().toISOString() };
            await core_1.db.collection('memberTemplates').doc(templateId).set(templateData);
            await core_1.db.collection('memberPackets').doc(packetId).update({ templateId, updatedAt: new Date().toISOString() });
            res.json({ templateId });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/member/library-links', async (req, res) => {
        try {
            const { memberId, packetId, channelId, templateId, compositeUrl, qrOnlyUrl, boundProduct, metadata, status } = req.body;
            if (!memberId || !packetId) {
                res.status(400).json({ error: "memberId and packetId are required" });
                return;
            }
            const libraryLinkId = `lib-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const linkData = { libraryLinkId, packetId, channelId: channelId || null, storeId: memberId, templateId: templateId || null, memberId, compositeUrl: compositeUrl || null, qrOnlyUrl: qrOnlyUrl || null, boundProduct: boundProduct || null, metadata: metadata || null, status: status || 'active', shareUrl: `/share/${packetId}`, createdAt: new Date().toISOString() };
            await core_1.db.collection('memberLibraryLinks').doc(libraryLinkId).set(linkData);
            await core_1.db.collection('memberPackets').doc(packetId).update({ status: 'published', libraryLinkId, updatedAt: new Date().toISOString() });
            res.json({ libraryLinkId, shareUrl: `/share/${packetId}` });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/member/library-links', async (req, res) => {
        try {
            const memberId = req.query.memberId;
            if (!memberId) {
                res.status(400).json({ error: "memberId is required" });
                return;
            }
            const snapshot = await core_1.db.collection('memberLibraryLinks').where('memberId', '==', memberId).limit(100).get();
            const items = snapshot.docs.map(doc => doc.data());
            res.json({ items });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // ============ PRICING ROUTES (Batch 2) ============
    app.post('/pricing-settings', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { markupPercent, markupFixed, additionalPlacementCost, textLineUpcharge, centerGraphicUpcharge, memberProfitShare, hostingTiers, sizeUpcharges, brandLabelPricing, preferredLabelPosition } = req.body;
            const defaultSU = { 'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10, '4XL': 12 };
            const defaultBLP = { printifyInside: 0.55, printifyOutside: 0.55, printfulInside: 0.99, printfulOutside: 2.49 };
            const settings = { markupPercent: parseFloat(markupPercent) || 25, markupFixed: parseFloat(markupFixed) || 0, additionalPlacementCost: parseFloat(additionalPlacementCost) || 4, textLineUpcharge: parseFloat(textLineUpcharge) || 2, centerGraphicUpcharge: parseFloat(centerGraphicUpcharge) || 5, memberProfitShare: parseFloat(memberProfitShare) || 0.25, sizeUpcharges: sizeUpcharges || defaultSU, hostingTiers: hostingTiers || [{ code: "1_year", name: "1 Year", price: 5 }, { code: "2_year", name: "2 Years", price: 8 }, { code: "3_year", name: "3 Years", price: 10 }], brandLabelPricing: brandLabelPricing || defaultBLP, preferredLabelPosition: preferredLabelPosition || 'outside', updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp() };
            await core_1.db.collection("testSettings").doc("pricing").set(settings, { merge: true });
            res.json({ success: true, settings, message: "Pricing settings saved" });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // ============ MEMBER PLAY PACKETS ============
    app.post('/member/play-packets', async (req, res) => {
        try {
            const { memberId, videoUrl, title, description, background, thumbnailUrl, metadata, storeId, channelId, source, status } = req.body;
            if (!memberId) {
                res.status(400).json({ error: "memberId is required" });
                return;
            }
            const packetId = `pkt-play-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const packetData = { packetId, memberId, packetType: 'qr-play', videoUrl: videoUrl || null, title: title || 'Untitled', description: description || '', background: background || null, thumbnailUrl: thumbnailUrl || null, metadata: metadata || null, storeId: storeId || memberId, channelId: channelId || null, source: source || { entryPoint: 'wizard' }, status: status || 'draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            await core_1.db.collection('memberPackets').doc(packetId).set(packetData);
            res.json({ packetId, success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // ============ BATCH: MEMBER MOCKUP & GRAPHIC ROUTES ============
    app.post('/members/mockup/priority', middleware_1.requireAuth, async (req, res) => {
        try {
            const { blueprintId, printProviderId, colorName, colorHex, placement, artworkUrl, qrSize = "medium", fulfillmentProvider = "printify" } = req.body;
            if (!blueprintId || !colorName || !artworkUrl) {
                res.status(400).json({ error: "Missing required fields: blueprintId, colorName, artworkUrl" });
                return;
            }
            console.log(`[CF Member Mockup] Generating for: ${colorName} @ ${placement}, provider: ${fulfillmentProvider}`);
            const result = await (0, mockup_generator_1.generateMockupFromPrintful)({
                blueprintId: parseInt(blueprintId), printProviderId: parseInt(printProviderId) || 99,
                colorName, colorHex, artworkUrl, artworkVariant: 'black',
                fulfillmentProvider: fulfillmentProvider,
                placement: placement || 'front',
                qrSize: qrSize,
                hasCompositeGraphic: true,
            });
            console.log(`[CF Member Mockup] Generated: ${result.mockupUrl} (cached: ${result.fromCache})`);
            res.json({ success: true, mockupUrl: result.mockupUrl, lifestyleMockupUrl: result.lifestyleMockupUrl, fromCache: result.fromCache, generatedAt: new Date().toISOString() });
        }
        catch (error) {
            console.error("[CF Member Mockup] Error:", error);
            console.error("[CF Member Mockup] Mockup generation failed:", error.message);
            res.json({ success: false, error: error.message, mockupUrl: null, lifestyleMockupUrl: null, message: "Mockup generation failed - please try again" });
        }
    });
    app.post('/members/generate-product-graphic', middleware_1.requireAuth, async (req, res) => {
        try {
            const { qrUrl, headerStyle, footerStyle, textLayoutChoice, qrColor = 'black' } = req.body;
            if (!qrUrl) {
                res.status(400).json({ error: "Missing required field: qrUrl" });
                return;
            }
            console.log(`[CF ProductGraphic] Generating composite with layout: ${textLayoutChoice}`);
            const showHeader = textLayoutChoice === 'header' || textLayoutChoice === 'both';
            const showFooter = textLayoutChoice === 'footer' || textLayoutChoice === 'both';
            const topText = showHeader && headerStyle?.text ? {
                text: headerStyle.text, fontFamily: headerStyle.fontFamily || 'Arial',
                fontSize: headerStyle.fontSize || '48', color: headerStyle.color || '#000000',
                letterSpacing: headerStyle.letterSpacing || 0, warpPreset: headerStyle.warpPreset || 'straight',
                strokeColor: headerStyle.strokeColor, strokeWidth: headerStyle.strokeWidth,
            } : null;
            const bottomText = showFooter && footerStyle?.text ? {
                text: footerStyle.text, fontFamily: footerStyle.fontFamily || 'Arial',
                fontSize: footerStyle.fontSize || '48', color: footerStyle.color || '#000000',
                letterSpacing: footerStyle.letterSpacing || 0, warpPreset: footerStyle.warpPreset || 'straight',
                strokeColor: footerStyle.strokeColor, strokeWidth: footerStyle.strokeWidth,
            } : null;
            const productGraphicDataUrl = await (0, composite_image_1.cfGeneratePrintifyComposite)(qrUrl, topText, bottomText, 1200, 1800, qrColor);
            const match = productGraphicDataUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (!match)
                throw new Error("Invalid data URL format from composite generator");
            const buffer = Buffer.from(match[2], 'base64');
            const uploadResult = await (0, composite_image_1.cfUploadBufferToStorage)(buffer, match[1], 'member-graphics');
            console.log(`[CF ProductGraphic] Uploaded: ${uploadResult.publicUrl}`);
            res.json({ success: true, productGraphic: uploadResult.publicUrl });
        }
        catch (error) {
            console.error("[CF ProductGraphic] Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
    app.post('/public/generate-product-graphic', async (req, res) => {
        try {
            const { qrUrl, headerStyle, footerStyle, textLayoutChoice, qrColor = 'black' } = req.body;
            if (!qrUrl) {
                res.status(400).json({ error: "Missing required field: qrUrl" });
                return;
            }
            console.log(`[CF PublicProductGraphic] Generating composite with layout: ${textLayoutChoice}`);
            const showHeader = textLayoutChoice === 'header' || textLayoutChoice === 'both';
            const showFooter = textLayoutChoice === 'footer' || textLayoutChoice === 'both';
            const topText = showHeader && headerStyle?.text ? {
                text: headerStyle.text, fontFamily: headerStyle.fontFamily || 'Arial',
                fontSize: headerStyle.fontSize || '48', color: headerStyle.color || '#000000',
                letterSpacing: headerStyle.letterSpacing || 0, warpPreset: headerStyle.warpPreset || 'straight',
                strokeColor: headerStyle.strokeColor, strokeWidth: headerStyle.strokeWidth,
            } : null;
            const bottomText = showFooter && footerStyle?.text ? {
                text: footerStyle.text, fontFamily: footerStyle.fontFamily || 'Arial',
                fontSize: footerStyle.fontSize || '48', color: footerStyle.color || '#000000',
                letterSpacing: footerStyle.letterSpacing || 0, warpPreset: footerStyle.warpPreset || 'straight',
                strokeColor: footerStyle.strokeColor, strokeWidth: footerStyle.strokeWidth,
            } : null;
            const productGraphicDataUrl = await (0, composite_image_1.cfGeneratePrintifyComposite)(qrUrl, topText, bottomText, 1200, 1800, qrColor);
            const match = productGraphicDataUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (!match)
                throw new Error("Invalid data URL format from composite generator");
            const buffer = Buffer.from(match[2], 'base64');
            const uploadResult = await (0, composite_image_1.cfUploadBufferToStorage)(buffer, match[1], 'public-graphics');
            console.log(`[CF PublicProductGraphic] Uploaded: ${uploadResult.publicUrl}`);
            res.json({ success: true, productGraphic: uploadResult.publicUrl });
        }
        catch (error) {
            console.error("[CF PublicProductGraphic] Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
    app.post('/public/generate-mockup', async (req, res) => {
        try {
            const { tempPacketId, blueprintId, printProviderId, colorName, colorHex, placement = 'front', qrSize = 'medium', fulfillmentProvider = 'printify', qrUrl, headerStyle, footerStyle, textLayoutChoice, qrColor = 'black', } = req.body;
            if (!blueprintId || !colorName) {
                res.status(400).json({ error: "Missing required fields: blueprintId, colorName" });
                return;
            }
            console.log(`[CF PublicMockup] Starting for packet: ${tempPacketId || 'none'}, color: ${colorName}`);
            let artworkUrl;
            if (textLayoutChoice && textLayoutChoice !== '' && (headerStyle?.text || footerStyle?.text)) {
                console.log(`[CF PublicMockup] Generating composite artwork with text layout: ${textLayoutChoice}`);
                const showHeader = textLayoutChoice === 'header' || textLayoutChoice === 'both';
                const showFooter = textLayoutChoice === 'footer' || textLayoutChoice === 'both';
                const topText = showHeader && headerStyle?.text ? {
                    text: headerStyle.text, fontFamily: headerStyle.fontFamily || 'Arial',
                    fontSize: headerStyle.fontSize || '48', color: headerStyle.color || '#000000',
                    letterSpacing: headerStyle.letterSpacing || 0, warpPreset: headerStyle.warpPreset || 'straight',
                    strokeColor: headerStyle.strokeColor, strokeWidth: headerStyle.strokeWidth,
                } : null;
                const bottomText = showFooter && footerStyle?.text ? {
                    text: footerStyle.text, fontFamily: footerStyle.fontFamily || 'Arial',
                    fontSize: footerStyle.fontSize || '48', color: footerStyle.color || '#000000',
                    letterSpacing: footerStyle.letterSpacing || 0, warpPreset: footerStyle.warpPreset || 'straight',
                    strokeColor: footerStyle.strokeColor, strokeWidth: footerStyle.strokeWidth,
                } : null;
                const compositeDataUrl = await (0, composite_image_1.cfGeneratePrintifyComposite)(qrUrl || 'https://example.com', topText, bottomText, 1200, 1800, qrColor);
                const match = compositeDataUrl.match(/^data:([^;]+);base64,(.+)$/);
                if (!match)
                    throw new Error("Invalid data URL format from composite generator");
                const buffer = Buffer.from(match[2], 'base64');
                const uploadResult = await (0, composite_image_1.cfUploadBufferToStorage)(buffer, match[1], 'public-graphics');
                artworkUrl = uploadResult.publicUrl;
                console.log(`[CF PublicMockup] Composite uploaded: ${artworkUrl}`);
            }
            else {
                const qrContent = qrUrl || 'https://example.com';
                artworkUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(qrContent)}&format=png&qzone=2&ecc=H&color=000000&bgcolor=ffffff`;
                console.log(`[CF PublicMockup] Using raw QR artwork: ${artworkUrl}`);
            }
            const hasComposite = !!(textLayoutChoice && textLayoutChoice !== '' && (headerStyle?.text || footerStyle?.text));
            const result = await (0, mockup_generator_1.generateMockupFromPrintful)({
                blueprintId: parseInt(blueprintId), printProviderId: parseInt(printProviderId) || 99,
                colorName, colorHex: colorHex || '#000000', artworkUrl,
                artworkVariant: qrColor === 'white' ? 'white' : 'black',
                fulfillmentProvider: fulfillmentProvider,
                placement,
                qrSize: qrSize,
                hasCompositeGraphic: hasComposite,
            });
            console.log(`[CF PublicMockup] Mockup generated: ${result.mockupUrl} (cached: ${result.fromCache})`);
            if (tempPacketId) {
                try {
                    await core_1.db.collection('temp_packets').doc(tempPacketId).update({
                        mockupUrl: result.mockupUrl, lifestyleMockupUrl: result.lifestyleMockupUrl,
                        artworkUrl, updatedAt: new Date().toISOString(),
                    });
                    console.log(`[CF PublicMockup] Packet ${tempPacketId} updated with mockup`);
                }
                catch (pktErr) {
                    console.warn(`[CF PublicMockup] Failed to update packet: ${pktErr.message}`);
                }
            }
            res.json({ success: true, mockupUrl: result.mockupUrl, lifestyleMockupUrl: result.lifestyleMockupUrl, artworkUrl, fromCache: result.fromCache });
        }
        catch (error) {
            console.error("[CF PublicMockup] Error:", error);
            const bid = parseInt(req.body.blueprintId);
            let fallbackUrl = null;
            try {
                const bpDoc = await core_1.db.collection('printifyBlueprints').doc(String(bid)).get();
                if (bpDoc.exists) {
                    const bpData = bpDoc.data();
                    fallbackUrl = bpData.images?.[0] || bpData.image || null;
                }
                if (!fallbackUrl) {
                    const memberProds = await core_1.db.collection('storeAllowedProducts').doc('member-products').get();
                    if (memberProds.exists) {
                        const prods = memberProds.data()?.products || [];
                        const match = prods.find((p) => p.blueprintId === bid);
                        if (match?.image)
                            fallbackUrl = match.image;
                    }
                }
                if (fallbackUrl) {
                    console.log(`[CF PublicMockup] Using catalog fallback image for blueprint ${bid}`);
                }
            }
            catch (fbErr) {
                console.error("[CF PublicMockup] Fallback lookup failed:", fbErr.message);
            }
            if (fallbackUrl) {
                res.json({ success: true, mockupUrl: fallbackUrl, lifestyleMockupUrl: null, fromCache: false, fallback: true });
            }
            else {
                res.json({ success: false, error: error.message, mockupUrl: null, message: "Mockup generation in progress - check back shortly" });
            }
        }
    });
    // ============ BATCH: MEMBER ALLOWED PRODUCTS ============
    app.post('/members/allowed-products', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { products } = req.body;
            if (!Array.isArray(products)) {
                res.status(400).json({ error: "products must be an array" });
                return;
            }
            await core_1.db.collection("storeAllowedProducts").doc("member-products").set({ products, updatedAt: new Date().toISOString() });
            console.log(`[CF Member Product Library] Saved ${products.length} products to storeAllowedProducts/member-products`);
            res.json({ success: true, count: products.length });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // ============ BATCH: MEMBER LIBRARY SYSTEM ============
    app.get('/members/common-library', async (req, res) => {
        try {
            const assetType = req.query.assetType || 'background';
            let commonQuery = core_1.db.collection('commonLibrary').where('isActive', '==', true);
            if (assetType)
                commonQuery = commonQuery.where('assetType', '==', assetType);
            let adminQuery = core_1.db.collection('libraryAssets').where('ownerType', '==', 'admin');
            const [commonSnapshot, adminSnapshot] = await Promise.all([
                commonQuery.orderBy('createdAt', 'desc').get(),
                adminQuery.get(),
            ]);
            const mapAsset = (doc) => { const d = doc.data(); return { id: doc.id, name: d.name, assetType: d.assetType, mediaType: d.mediaType || 'image', thumbnailUrl: d.thumbnailUrl || d.publicUrl || d.storageUrl, publicUrl: d.publicUrl || d.storageUrl, width: d.width, height: d.height, category: d.category }; };
            const commonAssets = commonSnapshot.docs.map(mapAsset);
            const adminAssets = adminSnapshot.docs.map(mapAsset).filter((a) => a.assetType === assetType);
            const seenIds = new Set();
            const assets = [...commonAssets, ...adminAssets].filter((a) => { if (seenIds.has(a.id))
                return false; seenIds.add(a.id); return true; }).sort((a, b) => (b.createdAt || '') > (a.createdAt || '') ? 1 : -1);
            console.log(`[CF Common Library] Found ${assets.length} ${assetType} assets (${commonAssets.length} common + ${adminAssets.length} admin)`);
            res.json({ assets });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/members/:memberId/library', async (req, res) => {
        try {
            const { memberId } = req.params;
            const assetType = req.query.assetType;
            let query = core_1.db.collection('memberLibrary').where('memberId', '==', memberId).where('isActive', '==', true);
            if (assetType)
                query = query.where('assetType', '==', assetType);
            const snapshot = await query.orderBy('createdAt', 'desc').get();
            const assets = snapshot.docs.map((doc) => {
                const data = doc.data();
                return { id: doc.id, name: data.name, assetType: data.assetType, mediaType: data.mediaType || 'image', thumbnailUrl: data.thumbnailUrl || data.publicUrl, publicUrl: data.publicUrl, width: data.width, height: data.height, sourceAssetId: data.sourceAssetId, isCropped: data.isCropped || false, originalAssetId: data.originalAssetId };
            });
            console.log(`[CF Member Library] Found ${assets.length} assets for member ${memberId}`);
            res.json({ assets });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/members/:memberId/library', async (req, res) => {
        try {
            const { memberId } = req.params;
            const { publicUrl, storageUrl, assetType, mediaType, name, fileName } = req.body;
            if (!publicUrl) {
                res.status(400).json({ error: 'publicUrl is required' });
                return;
            }
            const now = new Date().toISOString();
            const ref = await core_1.db.collection('memberLibrary').add({
                memberId,
                publicUrl,
                storageUrl: storageUrl || publicUrl,
                assetType: assetType || 'graphic',
                mediaType: mediaType || 'image',
                name: name || 'Untitled',
                fileName: fileName || 'untitled.png',
                isActive: true,
                createdAt: now,
                updatedAt: now,
            });
            console.log(`[CF Member Library] Saved asset ${ref.id} for member ${memberId}`);
            res.json({ id: ref.id, publicUrl, assetType: assetType || 'graphic', name: name || 'Untitled' });
        }
        catch (error) {
            console.error('[CF Member Library] Save error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/members/:memberId/library/upload', async (req, res) => {
        try {
            const { memberId } = req.params;
            const { assetType = 'background', name, imageData, mimeType: inputMimeType, originalName: inputOriginalName, isCropped = false, originalAssetId } = req.body;
            if (!imageData) {
                res.status(400).json({ error: "No imageData provided" });
                return;
            }
            const base64Data = imageData.replace(/^data:[^;]+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const mimeType = inputMimeType || 'image/png';
            const originalName = inputOriginalName || `upload-${Date.now()}.png`;
            const displayName = name || originalName;
            const mediaType = mimeType.startsWith('video/') ? 'video' : 'image';
            const sanitizedName = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            const folder = isCropped ? `members/${memberId}/library/cropped` : mediaType === 'video' ? `members/${memberId}/library/videos` : `members/${memberId}/library/backgrounds`;
            const bucket = core_1.storage.bucket();
            const file = bucket.file(`${folder}/${sanitizedName}`);
            await file.save(buffer, { metadata: { contentType: mimeType } });
            const storageUrl = `gs://${bucket.name}/${folder}/${sanitizedName}`;
            const proxyUrl = `/api/member-files/${memberId}/${encodeURIComponent(sanitizedName)}`;
            const assetData = {
                memberId, assetType, mediaType, name: displayName, fileName: sanitizedName, originalName,
                storageUrl, publicUrl: proxyUrl, mimeType, sizeBytes: buffer.length, isActive: true,
                isCropped, createdAt: new Date().toISOString(),
            };
            if (originalAssetId)
                assetData.originalAssetId = originalAssetId;
            const assetDoc = await core_1.db.collection('memberLibrary').add(assetData);
            console.log(`[CF Member Upload] Created ${assetType} asset ${assetDoc.id} for member ${memberId}`);
            res.json({ success: true, asset: { id: assetDoc.id, name: displayName, publicUrl: proxyUrl, assetType, mediaType, isCropped } });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/members/:memberId/library/crop', async (req, res) => {
        try {
            const { memberId } = req.params;
            const { sourceAssetId, name, cropData, imageData } = req.body;
            if (!imageData) {
                res.status(400).json({ error: "No imageData provided" });
                return;
            }
            const base64Data = imageData.replace(/^data:[^;]+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const mimeType = 'image/png';
            const sanitizedName = `${Date.now()}-cropped-${sourceAssetId}.png`;
            const folder = `members/${memberId}/library/cropped`;
            const bucket = core_1.storage.bucket();
            const file = bucket.file(`${folder}/${sanitizedName}`);
            await file.save(buffer, { metadata: { contentType: mimeType } });
            const storageUrl = `gs://${bucket.name}/${folder}/${sanitizedName}`;
            const proxyUrl = `/api/member-files/${memberId}/${encodeURIComponent(sanitizedName)}`;
            const assetDoc = await core_1.db.collection('memberLibrary').add({
                memberId, assetType: 'cropped', mediaType: 'image', name: name || 'Cropped Image',
                fileName: sanitizedName, originalName: `cropped-${sourceAssetId}`,
                storageUrl, publicUrl: proxyUrl, mimeType, sizeBytes: buffer.length,
                sourceAssetId, cropData: cropData ? JSON.parse(cropData) : null,
                isActive: true, createdAt: new Date().toISOString(),
            });
            console.log(`[CF Member Crop] Created cropped asset ${assetDoc.id} from ${sourceAssetId} for member ${memberId}`);
            res.json({ success: true, asset: { id: assetDoc.id, name: name || 'Cropped Image', publicUrl: proxyUrl, sourceAssetId } });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/members/:memberId/videos/upload', async (req, res) => {
        try {
            const { memberId } = req.params;
            const { videoData, mimeType: inputMimeType, fileName: inputFileName } = req.body;
            if (!videoData) {
                res.status(400).json({ error: "No videoData provided" });
                return;
            }
            const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
            const mimeType = inputMimeType || 'video/mp4';
            if (!allowedVideoTypes.includes(mimeType)) {
                res.status(400).json({ error: "Invalid video type. Allowed: MP4, WebM, MOV" });
                return;
            }
            const base64Data = videoData.replace(/^data:[^;]+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const maxSize = 100 * 1024 * 1024;
            if (buffer.length > maxSize) {
                res.status(400).json({ error: "Video exceeds 100MB limit" });
                return;
            }
            const ext = mimeType === 'video/mp4' ? 'mp4' : mimeType === 'video/webm' ? 'webm' : 'mov';
            const originalName = inputFileName || `video-${Date.now()}.${ext}`;
            const sanitizedName = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            const folder = `members/${memberId}/library/videos`;
            const bucket = core_1.storage.bucket();
            const file = bucket.file(`${folder}/${sanitizedName}`);
            await file.save(buffer, { metadata: { contentType: mimeType } });
            const storageUrl = `gs://${bucket.name}/${folder}/${sanitizedName}`;
            const proxyUrl = `/api/member-files/${memberId}/${encodeURIComponent(sanitizedName)}`;
            const assetDoc = await core_1.db.collection('memberLibrary').add({
                memberId, assetType: 'video', mediaType: 'video', name: originalName,
                fileName: sanitizedName, originalName, storageUrl, publicUrl: proxyUrl,
                mimeType, sizeBytes: buffer.length, isActive: true, createdAt: new Date().toISOString(),
            });
            console.log(`[CF Member Video] Created video asset ${assetDoc.id} for member ${memberId}, size: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
            res.json({ success: true, videoUrl: proxyUrl, assetId: assetDoc.id, fileName: sanitizedName });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // ============ BATCH: MEMBER PLAY-PACKET PUBLISH & SHARE-CARD ============
    app.post('/member/play-packets/:packetId/share-card', async (req, res) => {
        try {
            const { packetId } = req.params;
            const { memberId } = req.body;
            if (!packetId || !memberId) {
                res.status(400).json({ error: "packetId and memberId are required" });
                return;
            }
            const packetDoc = await core_1.db.collection('memberPackets').doc(packetId).get();
            if (!packetDoc.exists) {
                res.status(404).json({ error: "Packet not found" });
                return;
            }
            const packet = packetDoc.data();
            if (packet?.memberId !== memberId) {
                res.status(403).json({ error: "Not authorized" });
                return;
            }
            const shareCardUrl = packet?.videoSource?.posterUrl || null;
            await core_1.db.collection('memberPackets').doc(packetId).update({ shareCardUrl, updatedAt: new Date().toISOString() });
            console.log(`[CF QR Play] Generated share card for ${packetId}`);
            res.json({ shareCardUrl, success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/member/play-packets/:packetId/publish', async (req, res) => {
        try {
            const { packetId } = req.params;
            const { memberId, channelId, metadata } = req.body;
            if (!packetId || !memberId) {
                res.status(400).json({ error: "packetId and memberId are required" });
                return;
            }
            const packetDoc = await core_1.db.collection('memberPackets').doc(packetId).get();
            if (!packetDoc.exists) {
                res.status(404).json({ error: "Packet not found" });
                return;
            }
            const packet = packetDoc.data();
            if (packet?.memberId !== memberId) {
                res.status(403).json({ error: "Not authorized" });
                return;
            }
            const libraryLinkId = `link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const titleLayer = packet?.textLayers?.find((l) => l.id === 'title' || l.label?.toLowerCase() === 'title');
            const linkData = {
                libraryLinkId, packetId, channelId: channelId || null, storeId: memberId, memberId,
                kind: 'qr_play', videoSource: packet?.videoSource || null,
                shareCardUrl: packet?.shareCardUrl || packet?.videoSource?.posterUrl || null,
                titleText: titleLayer?.text || 'Untitled Video', textLayers: packet?.textLayers || [],
                textBackdrop: packet?.textBackdrop || 'off', playSettings: packet?.playSettings || {},
                metadata: metadata || packet?.metadata || null, status: 'active',
                shareUrl: `/play/${packetId}`, createdAt: new Date().toISOString(),
            };
            await core_1.db.collection('memberLibraryLinks').doc(libraryLinkId).set(linkData);
            await core_1.db.collection('memberPackets').doc(packetId).update({ status: 'published', libraryLinkId, updatedAt: new Date().toISOString() });
            if (channelId) {
                const itemId = `ci-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                await core_1.db.collection('channel_items').doc(itemId).set({
                    channelId, packetId, title: titleLayer?.text || 'Untitled Video',
                    description: metadata?.description || '', previewImageUrl: packet?.shareCardUrl || packet?.videoSource?.posterUrl || null,
                    price: metadata?.price || null, createdAt: new Date().toISOString(),
                });
                console.log(`[CF QR Play] Also wrote to channel_items for channel ${channelId}`);
            }
            console.log(`[CF QR Play] Published packet ${packetId} as ${libraryLinkId}`);
            res.json({ libraryLinkId, shareUrl: `/play/${packetId}`, success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=members.js.map