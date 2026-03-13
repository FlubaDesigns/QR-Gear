import { verifyFirebaseToken } from "../lib/firebase-admin";

export async function verifyMemberAuth(req: any, memberId: string): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return { authorized: false, error: "Authorization required" };
  }
  
  const idToken = authHeader.slice(7);
  try {
    const decodedToken = await verifyFirebaseToken(idToken);
    if (!decodedToken) {
      return { authorized: false, error: "Invalid token" };
    }
    const isOwnData = decodedToken.uid === memberId;
    const adminIds = (process.env.ADMIN_USER_IDS || "").split(",").map(id => id.trim()).filter(Boolean);
    const isAdmin = adminIds.includes(decodedToken.uid);
    
    if (!isOwnData && !isAdmin) {
      return { authorized: false, error: "Access denied" };
    }
    
    return { authorized: true, userId: decodedToken.uid };
  } catch (error: any) {
    return { authorized: false, error: "Invalid token" };
  }
}
