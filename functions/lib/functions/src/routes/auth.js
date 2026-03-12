"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
function register(app) {
    // ============ AUTH ENDPOINTS ============
    app.post('/auth/register', async (req, res) => {
        try {
            const { email, password, displayName } = req.body;
            if (!email || !password) {
                res.status(400).json({ error: 'Email and password are required' });
                return;
            }
            const userRecord = await core_1.admin.auth().createUser({
                email,
                password,
                displayName: displayName || email.split('@')[0],
            });
            await core_1.db.collection('users').doc(userRecord.uid).set({
                email,
                displayName: displayName || email.split('@')[0],
                isAdmin: false,
                createdAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
            });
            res.json({
                success: true,
                uid: userRecord.uid,
                email: userRecord.email,
            });
        }
        catch (error) {
            console.error('Registration error:', error);
            res.status(400).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=auth.js.map