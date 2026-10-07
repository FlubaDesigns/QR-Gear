/** Production adapter for the shared permanent-file registrar. */
import { db, admin } from '../core';
import { createGrfRegistrar } from './grf-store';
export type { RegisterGrfAssetOptions, RegisterGrfAssetResult, PacketGrfIds, MockupGrfIds } from './grf-store';
const registrar = createGrfRegistrar({ db, now: () => admin.firestore.FieldValue.serverTimestamp(), bucket: () => admin.storage().bucket() });
export const { registerGrfAsset, registerPacketGrfAssets, registerMockupGrfAssets, registerSourceImage, registerSourceCrop } = registrar;
