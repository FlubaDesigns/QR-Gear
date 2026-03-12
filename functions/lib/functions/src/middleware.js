"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_USER_IDS = exports.ALLOWED_ORIGINS = void 0;
exports.corsMiddleware = corsMiddleware;
exports.apiPrefixMiddleware = apiPrefixMiddleware;
exports.verifyAuth = verifyAuth;
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;
exports.verifyMemberAuthCF = verifyMemberAuthCF;
const core_1 = require("./core");
exports.ALLOWED_ORIGINS = [
    'https://qrgear-c1ffd.web.app',
    'https://qrgear-c1ffd.firebaseapp.com',
    'https://qrgear.com',
    'https://www.qrgear.com',
    'https://kingdom-connects.web.app',
    'https://kingdom-connects.firebaseapp.com',
    ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5000', 'http://localhost:3000'] : []),
];
function corsMiddleware(req, res, next) {
    const origin = req.headers.origin;
    if (origin && exports.ALLOWED_ORIGINS.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
    }
    else if (!origin) {
        res.header('Access-Control-Allow-Origin', '*');
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    next();
}
function apiPrefixMiddleware(req, _res, next) {
    if (req.path.startsWith('/api/')) {
        req.url = req.url.replace('/api', '');
    }
    next();
}
async function verifyAuth(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    try {
        const token = authHeader.split('Bearer ')[1];
        return await core_1.admin.auth().verifyIdToken(token);
    }
    catch {
        return null;
    }
}
async function requireAuth(req, res, next) {
    const user = await verifyAuth(req);
    if (!user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    req.user = user;
    next();
}
exports.ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || 'xHUmudG0t5OkCQhqyhB4nXhCUfs1').split(',').filter(Boolean);
async function requireAdmin(req, res, next) {
    const user = await verifyAuth(req);
    if (!user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    const userDoc = await core_1.db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();
    const isAdmin = userData?.isAdmin || exports.ADMIN_USER_IDS.includes(user.uid);
    if (!isAdmin) {
        res.status(403).json({ message: 'Admin access required' });
        return;
    }
    req.user = user;
    next();
}
async function verifyMemberAuthCF(req, memberId) {
    const user = await verifyAuth(req);
    if (!user) {
        return { authorized: false, error: 'Unauthorized' };
    }
    if (user.uid !== memberId) {
        return { authorized: false, error: 'Forbidden' };
    }
    return { authorized: true, userId: user.uid };
}
//# sourceMappingURL=middleware.js.map