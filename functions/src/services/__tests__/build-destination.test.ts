import {vi} from 'vitest';
vi.mock('../../core',()=>({db:{},admin:{}}));
import { describe, it, expect } from 'vitest';
import { database } from './composition-fixture';
import { resolveBuildDestination } from '../build-destination';
import { updateCatalogInstance } from '../catalog-instance-update';
function fixture() { return database({
  'stores/store': { name: 'Canonical Store' }, 'stores/other': { name: 'Other' },
  'storeChannels/channel': { storeId: 'store', name: 'Canonical Channel' },
  'dynamicsCollections/collection': { storeId: 'store', channelId: 'channel', name: 'Training' },
  'admin_catalog_instances/item': { baseSnapshot: { title: 'Shirt' }, currentPacketId: 'packet', sourceSessionId: 'session' },
  'productPackets/packet': { ownerInstanceId: 'item', builderSnapshot: { metadata: {}, graphics: { content: { headerText: 'Printed words' } } }, qrContent: 'https://example.com/printed' },
  'admin_build_sessions/session': { committedInstanceId: 'item', working: { metadata: {} } },
  'storeProductLinks/link': { packetId: 'packet' },
}); }
describe('canonical product destinations', () => {
  it('derives labels and collection identity from the stored parents', async () => {
    const f = fixture();
    const d = await resolveBuildDestination(f.db, { storeId: 'store', storeName: 'Forged', channelId: 'channel', channelName: 'Wrong', collectionName: 'Training' });
    expect(d).toMatchObject({ storeName: 'Canonical Store', channelName: 'Canonical Channel', collectionId: 'collection', folderPath: 'Canonical Store / Canonical Channel / Training' });
  });
  it('moves the item, packet, snapshot, saved build and storefront link together', async () => {
    const f = fixture();
    await updateCatalogInstance(f.db, 'item', { folderUpdate: { storeId: 'store', channelId: 'channel', collectionName: 'Training' } }, 'now', 'admin');
    for (const path of ['admin_catalog_instances/item','productPackets/packet','storeProductLinks/link']) expect(f.store.get(path)).toMatchObject({ storeId: 'store', channelId: 'channel', collectionId: 'collection' });
    expect(f.store.get('admin_build_sessions/session').working.metadata.selectedCollection).toMatchObject({ id: 'collection', name: 'Training' });
    expect(f.store.get('productPackets/packet')).toMatchObject({ qrContent: 'https://example.com/printed', builderSnapshot: { graphics: { content: { headerText: 'Printed words' } }, metadata: { selectedStore: { id: 'store' } } } });
  });
  it('rejects crossed stores/channels without changing any record', async () => {
    const f = fixture(); const before = JSON.stringify(Array.from(f.store));
    await expect(updateCatalogInstance(f.db, 'item', { folderUpdate: { storeId: 'other', channelId: 'channel' } }, 'now', 'admin')).rejects.toThrow('does not belong');
    expect(JSON.stringify(Array.from(f.store))).toBe(before);
  });
  it('rejects a crossed collection and a mismatched packet owner', async () => {
    const f = fixture();
    await expect(resolveBuildDestination(f.db, { storeId: 'other', collectionId: 'collection' })).rejects.toThrow('collection does not belong');
    f.store.get('productPackets/packet').ownerInstanceId = 'someone-else';
    await expect(updateCatalogInstance(f.db, 'item', { folderUpdate: { storeId: 'store', channelId: 'channel' } }, 'now', 'admin')).rejects.toThrow('ownership disagree');
  });
});

it('rejects archived collection IDs without changing the saved destination', async () => {
 const f=fixture();f.store.get('dynamicsCollections/collection').status='deleted';const before=JSON.stringify(Array.from(f.store));
 await expect(updateCatalogInstance(f.db,'item',{folderUpdate:{storeId:'store',channelId:'channel',collectionId:'collection'}},'now','admin')).rejects.toThrow('collection does not belong');
 expect(JSON.stringify(Array.from(f.store))).toBe(before);
});
it('does not reattach an archived collection definition when its name is reused', async () => {
 const f=fixture();f.store.get('dynamicsCollections/collection').isActive=false;
 const result=await resolveBuildDestination(f.db,{storeId:'store',channelId:'channel',collectionName:'Training'});
 expect(result.collectionId).toBeNull();expect(result.collectionName).toBe('Training');expect(f.store.get('dynamicsCollections/collection').isActive).toBe(false);
});
