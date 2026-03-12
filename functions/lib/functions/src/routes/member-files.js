"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
function register(app) {
    // ============ BATCH: MEMBER FILES PROXY ============
    app.get('/member-files/:memberId/:filename', async (req, res) => {
        try {
            const { memberId, filename } = req.params;
            const decodedFilename = decodeURIComponent(filename);
            const bucket = core_1.storage.bucket();
            const snapshot = await core_1.db.collection('memberLibrary')
                .where('memberId', '==', memberId)
                .where('fileName', '==', decodedFilename)
                .limit(1).get();
            if (!snapshot.empty) {
                const data = snapshot.docs[0].data();
                if (data.storageUrl) {
                    let storagePath = data.storageUrl;
                    if (storagePath.startsWith('gs://'))
                        storagePath = storagePath.replace(/^gs:\/\/[^\/]+\//, '');
                    const file = bucket.file(storagePath);
                    const [exists] = await file.exists();
                    if (exists) {
                        const [metadata] = await file.getMetadata();
                        res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
                        res.setHeader('Cache-Control', 'public, max-age=86400');
                        const stream = file.createReadStream();
                        stream.pipe(res);
                        return;
                    }
                }
            }
            const possiblePaths = [
                `members/${memberId}/library/backgrounds/${decodedFilename}`,
                `members/${memberId}/library/cropped/${decodedFilename}`,
                `members/${memberId}/library/videos/${decodedFilename}`,
                `members/${memberId}/backgrounds/${decodedFilename}`,
                `members/${memberId}/videos/${decodedFilename}`,
                `members/${memberId}/cropped/${decodedFilename}`,
            ];
            for (const path of possiblePaths) {
                const file = bucket.file(path);
                const [exists] = await file.exists();
                if (exists) {
                    const [metadata] = await file.getMetadata();
                    res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
                    res.setHeader('Cache-Control', 'public, max-age=86400');
                    const stream = file.createReadStream();
                    stream.pipe(res);
                    return;
                }
            }
            console.log(`[CF Member Files] File not found: ${memberId}/${decodedFilename}`);
            res.status(404).json({ error: "File not found" });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // ============ BATCH: MEMBER MEDIA UPLOAD ============
    app.post('/members/:memberId/media', async (req, res) => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader?.startsWith('Bearer ')) {
                res.status(401).json({ error: "Authentication required" });
                return;
            }
            const idToken = authHeader.substring(7);
            let decodedToken;
            try {
                decodedToken = await core_1.admin.auth().verifyIdToken(idToken);
            }
            catch {
                res.status(401).json({ error: "Invalid authentication token" });
                return;
            }
            const userId = decodedToken.uid;
            console.log(`[CF MemberMedia] Starting media upload for member: ${userId}`);
            const contentType = req.headers["content-type"] || "";
            const boundaryMatch = contentType.match(/boundary=(.+)/);
            if (!boundaryMatch) {
                res.status(400).json({ error: "Invalid content type - expected multipart/form-data" });
                return;
            }
            const boundary = boundaryMatch[1];
            const rawBody = req.rawBody || Buffer.from(req.body || '');
            if (!rawBody || rawBody.length === 0) {
                res.status(400).json({ error: "No request body received" });
                return;
            }
            console.log(`[CF MemberMedia] Received ${rawBody.length} bytes`);
            const boundaryBuffer = Buffer.from(`--${boundary}`);
            const parts = [];
            let start = 0;
            while (true) {
                const boundaryIndex = rawBody.indexOf(boundaryBuffer, start);
                if (boundaryIndex === -1)
                    break;
                if (start > 0)
                    parts.push(rawBody.slice(start, boundaryIndex - 2));
                start = boundaryIndex + boundaryBuffer.length + 2;
            }
            let fileBuffer = null;
            let fileName = `media-${Date.now()}`;
            let fileMimeType = "video/mp4";
            for (const part of parts) {
                const headerEnd = part.indexOf("\r\n\r\n");
                if (headerEnd === -1)
                    continue;
                const headers = part.slice(0, headerEnd).toString();
                const body = part.slice(headerEnd + 4);
                const filenameMatch = headers.match(/filename="([^"]+)"/);
                const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
                if (filenameMatch) {
                    fileName = filenameMatch[1];
                    if (contentTypeMatch)
                        fileMimeType = contentTypeMatch[1].trim();
                    fileBuffer = body;
                }
            }
            if (!fileBuffer || fileBuffer.length === 0) {
                res.status(400).json({ error: "No file uploaded" });
                return;
            }
            const allowedTypes = ["video/mp4", "video/webm", "video/quicktime", "video/3gpp", "video/3gpp2", "video/x-m4v", "video/x-matroska", "image/gif", "image/webp", "image/png", "image/jpeg"];
            if (!allowedTypes.includes(fileMimeType) && !fileMimeType.startsWith("video/")) {
                res.status(400).json({ error: `Invalid file type: ${fileMimeType}` });
                return;
            }
            const mediaType = fileMimeType.startsWith("video/") ? "video" : "image";
            const uniqueFilename = `${Date.now()}-${fileName}`;
            const storagePath = `library/member/${userId}/${mediaType}/${uniqueFilename}`;
            const mediaUrl = `/api/library-files/member/${userId}/${mediaType}/${uniqueFilename}`;
            console.log(`[CF MemberMedia] Uploading ${fileName} (${fileMimeType}, ${fileBuffer.length} bytes) to ${storagePath}`);
            const bucket = core_1.storage.bucket();
            const file = bucket.file(storagePath);
            await file.save(fileBuffer, { metadata: { contentType: fileMimeType } });
            console.log(`[CF MemberMedia] Upload complete: ${mediaUrl}`);
            res.json({ url: mediaUrl, mimeType: fileMimeType, fileName, size: fileBuffer.length, storagePath });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=member-files.js.map