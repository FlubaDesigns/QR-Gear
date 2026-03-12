import type {
  StoreRecord,
  ChannelRecord,
  CollectionRecord,
  ArtifactRecord,
  MosaicRecord,
} from '../../shared/domainModel';
import type { ChannelItem } from './channelItemsService';

export function channelItemToArtifact(item: ChannelItem): ArtifactRecord {
  return {
    artifactId: item.itemId,
    collectionId: item.collectionId,
    channelId: item.channelId,
    storeId: item.storeId,
    title: item.title,
    description: item.description,
    previewImageUrl: item.previewImageUrl || null,
    contentType: 'qr-product',
    packetId: item.packetId,
    shareUrl: item.shareUrl,
    isActive: item.isActive,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt?.toISOString?.() || new Date().toISOString(),
    updatedAt: item.updatedAt?.toISOString?.() || new Date().toISOString(),
  };
}

export function firestoreDocToStore(id: string, data: Record<string, any>): StoreRecord {
  return {
    storeId: id,
    name: data.name || data.storeName || id,
    slug: data.slug || id,
    ownerType: data.ownerType,
    ownerId: data.ownerId,
    logoUrl: data.logoUrl || null,
    isActive: data.isActive !== false,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.(),
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.(),
  };
}

export function firestoreDocToChannel(id: string, data: Record<string, any>): ChannelRecord {
  return {
    channelId: id,
    storeId: data.storeId || '',
    name: data.name || data.channelName || id,
    slug: data.slug || id,
    description: data.description,
    coverImageUrl: data.coverImageUrl || data.imageUrl || null,
    isActive: data.isActive !== false,
    sortOrder: data.sortOrder,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.(),
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.(),
  };
}

export function firestoreDocToCollection(id: string, data: Record<string, any>): CollectionRecord {
  return {
    collectionId: id,
    channelId: data.channelId || '',
    storeId: data.storeId || '',
    name: data.name || data.collectionName || id,
    slug: data.slug || id,
    description: data.description,
    coverImageUrl: data.coverImageUrl || null,
    isActive: data.isActive !== false,
    sortOrder: data.sortOrder,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.(),
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.(),
  };
}

export function firestoreProgramToMosaic(id: string, data: Record<string, any>): MosaicRecord {
  return {
    mosaicId: id,
    collectionId: data.collectionId,
    channelId: data.channelId || '',
    storeId: data.storeId || '',
    title: data.title || data.name || '',
    description: data.description,
    coverImageUrl: data.coverImageUrl || data.imageUrl || null,
    artifactIds: data.artifactIds || data.itemIds || [],
    isActive: data.isActive !== false,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.(),
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.(),
  };
}
