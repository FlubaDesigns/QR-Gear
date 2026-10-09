import { expect, it, vi } from 'vitest';
import { database } from './composition-fixture';
import { buildWorkingSnapshot } from '../../../../shared/builderSnapshot';
vi.mock('../../core', () => ({ db: {} }));
vi.mock('../printful', () => ({ printfulClient: {getProduct:vi.fn()}, getPrintfulApiKeyAsync: vi.fn() }));
import { printfulClient } from '../printful';
vi.mock('../printify', () => ({ printifyClient: {} }));
import { calculatePacketPricing, priceNewPacket } from '../pricing';
import { refreshQrgProviderPricing } from '../master-catalog';
const settings = { markupPercent:25, markupFixed:1, additionalPlacementCost:4, textLineUpcharge:2,
  centerGraphicUpcharge:5, memberProfitShare:0.25, builtInShippingCost:4.95, sizeUpcharges:{S:0, M:0, '2XL':3},
  hostingTiers:[{code:'1_year',name:'One year',price:5},{code:'2_year',name:'Two years',price:8}],
  brandLabelPricing:{printifyInside:0.55,printifyOutside:0.65,printfulInside:0.99,printfulOutside:2.49}, preferredLabelPosition:'outside' };
function snapshot() {
  return buildWorkingSnapshot({ content:{graphicLayoutMode:'zone', qrSizePercent:50, hostingTierCode:'2_year',
    headerStyle:{enabled:true,text:'Hello'},footerStyle:{enabled:true,mode:'image',imageUrl:'https://image/footer.png'},areaImageUrl:'https://image/center.png'},
    selectedProduct:{docId:'qrg_11001'}, selectedPlacements:['front','back','label_inside'], placementConfig:{},placementSizes:{},placementMethods:{},
    fulfillmentProvider:'printful', qrProductState:'qr_canvas' }, {selectedRole:'internal',selectedStore:null,selectedChannel:null,selectedCollection:null});
}
const master = {qrgBlankId:'11001',providerMappings:{printful:{productId:'71',minPrice:10,maxPrice:12},printify:{blueprintId:'12',printProviderId:'9',minPrice:6,maxPrice:7}}};
it('includes every applicable charge before both markups without double-charging label placement', () => {
  expect(calculatePacketPricing(master,snapshot(),settings)).toMatchObject({baseProductCost:12,placementCost:4,textUpcharge:4,centerGraphicUpcharge:5,
    hostingCost:8,shippingCost:4.95,brandLabelCost:0.99,subtotal:38.94,markupAmount:10.74,customerPrice:49.68});
});
it.each([['additionalPlacementCost','placementCost',1],['textLineUpcharge','textUpcharge',2],['centerGraphicUpcharge','centerGraphicUpcharge',1],['builtInShippingCost','shippingCost',1]] as const)(
 'changing %s changes its charge and the final price', (field,charge,count) => {
  const before=calculatePacketPricing(master,snapshot(),settings),after=calculatePacketPricing(master,snapshot(),{...settings,[field]:settings[field]+2});
  expect(after[charge]-before[charge]).toBeCloseTo(2*count);expect(after.customerPrice-before.customerPrice).toBeCloseTo(2*count*1.25);
});
it('preserves zero for every monetary setting', () => {
  const zero={...settings,markupPercent:0,markupFixed:0,additionalPlacementCost:0,textLineUpcharge:0,centerGraphicUpcharge:0,builtInShippingCost:0,memberProfitShare:0,
    hostingTiers:settings.hostingTiers.map(t=>({...t,price:0})),brandLabelPricing:{printifyInside:0,printifyOutside:0,printfulInside:0,printfulOutside:0}};
  expect(calculatePacketPricing(master,snapshot(),zero)).toMatchObject({subtotal:12,customerPrice:12,placementCost:0,textUpcharge:0,hostingCost:0,shippingCost:0,brandLabelCost:0,markupAmount:0});
});
it('uses selected supplier and actual inside/outside label costs, never combined master prices', () => {
  const build=snapshot();build.metadata.fulfillmentProvider='printify';build.layoutConfig.selectedPlacements=['front','label_inside'];
  expect(calculatePacketPricing({...master,maxPrice:999},build,settings)).toMatchObject({baseProductCost:7,brandLabelCost:0.55,placementCost:0});
  build.layoutConfig.selectedPlacements=['front','label_inside','label_outside'];expect(calculatePacketPricing(master,build,settings).brandLabelCost).toBe(1.20);
  build.metadata.fulfillmentProvider='printful';expect(calculatePacketPricing(master,build,settings).brandLabelCost).toBe(3.48);
});
it('charges enabled filled zones and actual center images, and hosting only for hosted modes', () => {
  const build=snapshot();build.graphics.content.headerStyle.enabled=false;build.graphics.content.footerStyle.imageUrl='';build.graphics.content.areaImageUrl='';
  build.layoutConfig.selectedPlacements=['front','label_inside'];build.qrConfig.qrProductState='qr_plus';
  expect(calculatePacketPricing(master,build,settings)).toMatchObject({textUpcharge:0,centerGraphicUpcharge:0,hostingCost:0,brandLabelCost:0.99});
});
it('uses the selected saved hosting price and rejects an unconfigured term', () => {
  const build=snapshot();build.qrConfig.qrProductState='qr_compose';build.graphics.content.composeHostingTerm='1-year';
  expect(calculatePacketPricing(master,build,settings).hostingCost).toBe(5);
  build.graphics.content.composeHostingTerm='5-year';expect(()=>calculatePacketPricing(master,build,settings)).toThrow('not configured');
});
it('rejects missing selected-provider costs without substituting another supplier or retail price', () => {
  expect(()=>calculatePacketPricing({...master,providerMappings:{printify:master.providerMappings.printify},maxPrice:500},snapshot(),settings)).toThrow('no valid printful');
});
it('member profit share does not discount admin retail prices', () => {
  expect(calculatePacketPricing(master,snapshot(),{...settings,memberProfitShare:0}).customerPrice).toBe(calculatePacketPricing(master,snapshot(),settings).customerPrice);
});
it('imports only the mapped supplier costs into QRG and converts Printify cents', async () => {
  const {db,store}=database({'master_catalog/qrg_11001':master,'printful_products/71':{minPrice:'11.00',maxPrice:'13.00'},
    'printifyPrintProviders/12_9':{blueprintId:12,providerId:9,minCost:800,maxCost:900},'printifyPrintProviders/wrong':{blueprintId:12,providerId:10,minCost:1,maxCost:2}});
  const before=structuredClone(store);
  const pf=await refreshQrgProviderPricing(db,'qrg_11001','printful');expect(pf.providerMappings.printful.maxPrice).toBe(13);expect(pf.providerMappings.printify).toEqual(master.providerMappings.printify);
  const py=await refreshQrgProviderPricing(db,'qrg_11001','printify');expect(py.providerMappings.printify.maxPrice).toBe(9);
  for(const [key,value] of before) if(!key.startsWith('master_catalog')) expect(store.get(key)).toEqual(value);
});
it('always retains the automatic inside label regardless of the old position preference', async () => {
  const spec={id:'label_inside',providerPlacementId:'label_inside',provider:'printful',dimensions:{widthPx:900,heightPx:900,dpi:300}};
  const {db}=database({'testSettings/pricing':settings,'master_catalog/qrg_11001':{...master,qrgPrintSpecs:{printful:{locations:[spec]}}},'printful_products/71':{minPrice:10,maxPrice:12}});
  const build=snapshot();build.layoutConfig.selectedPlacements=['front'];
  const priced=await priceNewPacket(db,build,'https://storage/brand.png');
  expect(priced.builderSnapshot.layoutConfig.selectedPlacements).toEqual(['front','label_inside']);expect(priced.placementGraphicUrls).toEqual({label_inside:'https://storage/brand.png'});expect(priced.pricing.brandLabelCost).toBe(0.99);
  expect(build.layoutConfig.selectedPlacements).toEqual(['front']);
});

it('does not generate a product by silently dropping its inside label', async () => {
  const {db}=database({'testSettings/pricing':settings,'master_catalog/qrg_11001':master,'printful_products/71':{minPrice:10,maxPrice:12}});
  await expect(priceNewPacket(db,snapshot(),'https://storage/brand.png')).rejects.toThrow('verified inside label');
});

it('imports missing QRG provider costs through a read-only catalog lookup and reuses the saved result', async () => {
  const {db,store}=database({'master_catalog/qrg_11001':{...master,providerMappings:{printful:{productId:'71'}}}});
  vi.mocked(printfulClient.getProduct).mockResolvedValue({product:{id:71},variants:[{price:'10.00'},{price:'12.00'}]} as any);
  const result=await refreshQrgProviderPricing(db,'qrg_11001','printful');
  expect(result.providerMappings.printful).toMatchObject({minPrice:10,maxPrice:12});
  expect(store.has('printful_products/71')).toBe(false);
  vi.mocked(printfulClient.getProduct).mockClear();
  await refreshQrgProviderPricing(db,'qrg_11001','printful');expect(printfulClient.getProduct).not.toHaveBeenCalled();
});
