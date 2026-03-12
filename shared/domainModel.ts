export interface StoreRecord {
  storeId: string;
  name: string;
  slug: string;
  ownerType?: string;
  ownerId?: string;
  logoUrl?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChannelRecord {
  channelId: string;
  storeId: string;
  name: string;
  slug: string;
  description?: string;
  coverImageUrl?: string | null;
  isActive: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CollectionRecord {
  collectionId: string;
  channelId: string;
  storeId: string;
  name: string;
  slug: string;
  description?: string;
  coverImageUrl?: string | null;
  isActive: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ArtifactRecord {
  artifactId: string;
  collectionId?: string;
  channelId: string;
  storeId: string;
  title: string;
  description?: string;
  previewImageUrl?: string | null;
  contentType: 'image' | 'video' | 'document' | 'qr-product';
  contentUrl?: string | null;
  packetId?: string;
  shareUrl?: string;
  isActive: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface MosaicRecord {
  mosaicId: string;
  collectionId?: string;
  channelId: string;
  storeId: string;
  title: string;
  description?: string;
  coverImageUrl?: string | null;
  artifactIds: string[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MosaicTemplateRecord {
  templateId: string;
  storeId: string;
  name: string;
  description?: string;
  layout?: string;
  artifactSlots: number;
  createdAt?: string;
  updatedAt?: string;
}
