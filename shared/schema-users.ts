import { z } from "zod";
// Shared Firestore/API contracts. Persistence is owned by Firebase services.
export const insertUserSchema = z.object({
    "id": z.string().optional(),
    "email": z.string().nullable().optional(),
    "passwordHash": z.string().nullable().optional(),
    "firstName": z.string().nullable().optional(),
    "lastName": z.string().nullable().optional(),
    "profileImageUrl": z.string().nullable().optional(),
    "socialFacebook": z.string().nullable().optional(),
    "socialInstagram": z.string().nullable().optional(),
    "socialTwitter": z.string().nullable().optional(),
    "socialLinkedin": z.string().nullable().optional(),
    "socialTiktok": z.string().nullable().optional(),
    "socialYoutube": z.string().nullable().optional(),
});
export const insertHostedImageSchema = z.object({
    "userId": z.string().nullable().optional(),
    "fileName": z.string(),
    "originalName": z.string(),
    "mimeType": z.string(),
    "sizeBytes": z.number().min(-2147483648).max(2147483647).int(),
    "storageUrl": z.string(),
    "publicUrl": z.string(),
    "title": z.string().nullable().optional(),
    "description": z.string().nullable().optional(),
    "businessName": z.string().nullable().optional(),
    "businessLogo": z.string().nullable().optional(),
    "isActive": z.boolean().nullable().optional(),
    "expiresAt": z.date().nullable().optional(),
});
export const insertEmailTemplateSchema = z.object({
    "trigger": z.string(),
    "name": z.string(),
    "subject": z.string(),
    "htmlContent": z.string(),
    "textContent": z.string().nullable().optional(),
    "isEnabled": z.boolean().nullable().optional(),
    "description": z.string().nullable().optional(),
    "variables": z.array(z.string()).nullable().optional(),
});
export type User = {
    id: string;
    email: string | null;
    passwordHash: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    socialFacebook: string | null;
    socialInstagram: string | null;
    socialTwitter: string | null;
    socialLinkedin: string | null;
    socialTiktok: string | null;
    socialYoutube: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
};
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = {
    id?: string | undefined;
    email?: string | null | undefined;
    passwordHash?: string | null | undefined;
    firstName?: string | null | undefined;
    lastName?: string | null | undefined;
    profileImageUrl?: string | null | undefined;
    socialFacebook?: string | null | undefined;
    socialInstagram?: string | null | undefined;
    socialTwitter?: string | null | undefined;
    socialLinkedin?: string | null | undefined;
    socialTiktok?: string | null | undefined;
    socialYoutube?: string | null | undefined;
    createdAt?: Date | null | undefined;
    updatedAt?: Date | null | undefined;
};
export type HostedImage = {
    id: string;
    createdAt: Date;
    userId: string | null;
    fileName: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    storageUrl: string;
    publicUrl: string;
    title: string | null;
    description: string | null;
    businessName: string | null;
    businessLogo: string | null;
    views: number | null;
    isActive: boolean | null;
    expiresAt: Date | null;
};
export type InsertHostedImage = z.infer<typeof insertHostedImageSchema>;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type EmailTemplate = {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    description: string | null;
    trigger: string;
    subject: string;
    htmlContent: string;
    textContent: string | null;
    isEnabled: boolean | null;
    variables: string[] | null;
};
export type EmailLog = {
    id: string;
    userId: string | null;
    trigger: string;
    subject: string;
    templateId: string | null;
    recipientEmail: string;
    status: string;
    resendId: string | null;
    orderId: string | null;
    errorMessage: string | null;
    sentAt: Date;
};
