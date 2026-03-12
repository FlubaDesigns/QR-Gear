import { describe, it, expect } from 'vitest';
import {
  channelItemToArtifact,
  firestoreDocToStore,
  firestoreDocToChannel,
  firestoreDocToCollection,
  legacyProgramToMosaic,
} from '../../server/lib/domain-mappers';

describe('domain-mappers', () => {
  describe('channelItemToArtifact', () => {
    it('maps a channel item to ArtifactRecord', () => {
      const item = {
        itemId: 'item-1',
        storeId: 'store-1',
        channelId: 'channel-1',
        packetId: 'packet-1',
        title: 'Test Item',
        description: 'A test',
        previewImageUrl: 'https://example.com/img.png',
        shareUrl: '/p/packet-1',
        price: 29.99,
        isActive: true,
        sortOrder: 0,
        collectionId: 'col-1',
        collectionTag: 'col-1',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-06-01'),
      };
      const artifact = channelItemToArtifact(item);
      expect(artifact.artifactId).toBe('item-1');
      expect(artifact.storeId).toBe('store-1');
      expect(artifact.channelId).toBe('channel-1');
      expect(artifact.title).toBe('Test Item');
      expect(artifact.contentType).toBe('qr-product');
      expect(artifact.packetId).toBe('packet-1');
      expect(artifact.collectionId).toBe('col-1');
    });

    it('prefers collectionId over collectionTag', () => {
      const item = {
        itemId: 'i2', storeId: 's', channelId: 'c', packetId: 'p',
        title: 'T', shareUrl: '/p/p', isActive: true, sortOrder: 0,
        collectionId: 'new-id', collectionTag: 'old-tag',
        createdAt: new Date(), updatedAt: new Date(),
      };
      const artifact = channelItemToArtifact(item);
      expect(artifact.collectionId).toBe('new-id');
    });

    it('falls back to collectionTag when collectionId is undefined', () => {
      const item = {
        itemId: 'i3', storeId: 's', channelId: 'c', packetId: 'p',
        title: 'T', shareUrl: '/p/p', isActive: true, sortOrder: 0,
        collectionTag: 'old-tag',
        createdAt: new Date(), updatedAt: new Date(),
      };
      const artifact = channelItemToArtifact(item);
      expect(artifact.collectionId).toBe('old-tag');
    });
  });

  describe('firestoreDocToStore', () => {
    it('maps a Firestore doc to StoreRecord', () => {
      const store = firestoreDocToStore('store-abc', {
        name: 'My Store',
        slug: 'my-store',
        ownerType: 'business',
        ownerId: 'biz-1',
        logoUrl: 'https://example.com/logo.png',
        isActive: true,
      });
      expect(store.storeId).toBe('store-abc');
      expect(store.name).toBe('My Store');
      expect(store.slug).toBe('my-store');
      expect(store.ownerType).toBe('business');
      expect(store.isActive).toBe(true);
    });

    it('defaults isActive to true when not set', () => {
      const store = firestoreDocToStore('s1', { name: 'S' });
      expect(store.isActive).toBe(true);
    });

    it('falls back to storeName then id for name', () => {
      expect(firestoreDocToStore('s1', { storeName: 'Alt' }).name).toBe('Alt');
      expect(firestoreDocToStore('s1', {}).name).toBe('s1');
    });
  });

  describe('firestoreDocToChannel', () => {
    it('maps a Firestore doc to ChannelRecord', () => {
      const ch = firestoreDocToChannel('ch-1', {
        storeId: 'store-1',
        name: 'USA 250',
        description: 'Channel desc',
        coverImageUrl: 'https://example.com/cover.png',
      });
      expect(ch.channelId).toBe('ch-1');
      expect(ch.storeId).toBe('store-1');
      expect(ch.name).toBe('USA 250');
    });

    it('falls back to imageUrl for cover', () => {
      const ch = firestoreDocToChannel('ch-1', { imageUrl: 'https://example.com/old.png' });
      expect(ch.coverImageUrl).toBe('https://example.com/old.png');
    });
  });

  describe('firestoreDocToCollection', () => {
    it('maps a Firestore doc to CollectionRecord', () => {
      const col = firestoreDocToCollection('col-1', {
        channelId: 'ch-1',
        storeId: 'store-1',
        name: 'Signature Series',
      });
      expect(col.collectionId).toBe('col-1');
      expect(col.channelId).toBe('ch-1');
      expect(col.name).toBe('Signature Series');
    });
  });

  describe('legacyProgramToMosaic', () => {
    it('maps legacy program data to MosaicRecord', () => {
      const mosaic = legacyProgramToMosaic('prog-1', {
        storeId: 'store-1',
        channelId: 'ch-1',
        collectionId: 'col-new',
        collectionTag: 'col-old',
        title: 'My Mosaic',
        description: 'A mosaic',
        coverImageUrl: 'https://example.com/mosaic.png',
        artifactIds: ['a1', 'a2'],
        isActive: true,
      });
      expect(mosaic.mosaicId).toBe('prog-1');
      expect(mosaic.title).toBe('My Mosaic');
      expect(mosaic.collectionId).toBe('col-new');
      expect(mosaic.artifactIds).toEqual(['a1', 'a2']);
    });

    it('prefers collectionId over collectionTag', () => {
      const m = legacyProgramToMosaic('p1', {
        collectionId: 'new', collectionTag: 'old',
      });
      expect(m.collectionId).toBe('new');
    });

    it('falls back to collectionTag', () => {
      const m = legacyProgramToMosaic('p1', { collectionTag: 'old' });
      expect(m.collectionId).toBe('old');
    });

    it('falls back to itemIds for artifactIds', () => {
      const m = legacyProgramToMosaic('p1', { itemIds: ['x', 'y'] });
      expect(m.artifactIds).toEqual(['x', 'y']);
    });

    it('falls back to name for title', () => {
      const m = legacyProgramToMosaic('p1', { name: 'From Name' });
      expect(m.title).toBe('From Name');
    });
  });
});
