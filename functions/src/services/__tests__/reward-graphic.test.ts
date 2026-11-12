import {describe,it,expect,vi} from 'vitest';
import * as canvas from 'canvas';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {writeFileSync} from 'node:fs';
vi.mock('../composite-image',()=>({getCanvas:()=>canvas,getQRCode:()=>QRCode}));
vi.mock('../../runtime-config',()=>({resolveRuntimeConfig:()=>({origin:'https://qrgear.test'})}));
import {rewardGraphicInput} from '../reward-graphic-input';
import {createProductGraphicRenderer} from '../../../../shared/graphics/productGraphicRenderer';
import {getGraphicLayout} from '../../../../shared/graphics/graphicLayout';
import {productGraphicOptions} from '../../../../shared/builderSnapshot';
const mark=canvas.createCanvas(240,100);const m=mark.getContext('2d');m.fillStyle='#ec2415';m.fillRect(0,0,240,100);m.fillStyle='white';m.font='bold 34px sans-serif';m.fillText('LOGO',20,65);
const logo=mark.toDataURL();
const renderer=createProductGraphicRenderer({createCanvas:canvas.createCanvas,loadImage:async url=>canvas.loadImage(url==='brand'?logo:url),loadFonts:async()=>{},qrImage:(text,size)=>QRCode.toDataURL(text,{width:size,margin:0,errorCorrectionLevel:'H'}),logoUrl:'brand'});
const url='https://mybusiness.example/';
describe('one saved renderer for shirt and cap',()=>{
 it.each([[3600,4800],[1500,600]])('decodes both full and QR-only artwork at %s x %s',async(widthPx,heightPx)=>{
  const placement={id:'front',provider:'printful',dimensions:{widthPx,heightPx,dpi:300},dpi:300};
  const recipe=rewardGraphicInput(placement,url,logo,'brand');
  for(const choice of ['graphic','qr']){
   const snapshot={graphics:{content:recipe},qrConfig:{qrProductState:'qr_plus',selectedColor:{name:'Black',hex:'#000000'}},metadata:{},layoutConfig:{selectedPlacements:['front'],providerLayouts:{front:placement},placementSizes:{front:'large'},placementConfig:{front:choice}}};
   const options=productGraphicOptions(snapshot,url,'front');
   const data=await renderer.renderProductGraphic(options as any),image=await canvas.loadImage(data);
   expect([image.width,image.height]).toEqual([widthPx,heightPx]);
   const full=canvas.createCanvas(widthPx,heightPx),ctx=full.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,widthPx,heightPx);ctx.drawImage(image,0,0);
   const pixel=ctx.getImageData(100,100,1,1).data;
   expect(pixel[1]).toBe(choice==='graphic'?36:255);
   const factor=Math.min(1,1800/Math.max(widthPx,heightPx));const scan=canvas.createCanvas(Math.round(widthPx*factor),Math.round(heightPx*factor));const q=scan.getContext('2d');q.drawImage(full,0,0,scan.width,scan.height);
   expect(jsQR(q.getImageData(0,0,scan.width,scan.height).data,scan.width,scan.height)?.data).toBe(url);
   if(widthPx===1500&&process.env.REWARD_RENDER_PROOF_DIR)writeFileSync(process.env.REWARD_RENDER_PROOF_DIR+'/cap-'+choice+'.png',full.toBuffer());
  }
 });
 it.each([['#000000','auto',255],['#FFFFFF','auto',0],['#000000','dark',0],['#FFFFFF','light',255]])('prints resolved text on %s in %s mode while preserving black-on-white QR',async(hex,mode,expected)=>{
  const widthPx=1500,heightPx=600;
  const placement={dimensions:{widthPx,heightPx,dpi:300},dpi:300};
  const recipe=rewardGraphicInput(placement,url,logo,'brand');recipe.headerStyle.colorMode=mode;
  const snapshot={graphics:{content:recipe},qrConfig:{selectedColor:{name:'Fixture',hex}},metadata:{},layoutConfig:{selectedPlacements:['front'],providerLayouts:{front:placement},perPlacementConfigs:{front:{graphicChoice:'full'}}}};
  const options={...productGraphicOptions(snapshot,url,'front'),placementSize:'large'};
  const image=await canvas.loadImage(await renderer.renderProductGraphic(options as any));
  const print=canvas.createCanvas(widthPx,heightPx),ctx=print.getContext('2d');ctx.drawImage(image,0,0);
  const pixels=ctx.getImageData(0,0,widthPx,heightPx).data;
  const layout=getGraphicLayout({canvasWidth:widthPx,canvasHeight:heightPx,headerActive:true,footerActive:true,subBottomActive:false,layoutMode:'freeform',qrSizePercent:recipe.qrSizePercent});
  // The website text sits left of the QR and below the unchanged red logo.
  let textPixels=0;
  for(let y=220;y<heightPx-75;y++)for(let x=75;x<layout.qr.background.x-10;x++){
    const i=(y*widthPx+Math.floor(x))*4;
    if(pixels[i+3]===255&&pixels[i]===pixels[i+1]&&pixels[i+1]===pixels[i+2]){expect(pixels[i]).toBe(expected);textPixels++;}
  }
  expect(textPixels).toBeGreaterThan(100);
  const qrX=Math.round(layout.qr.background.x+2),qrY=Math.round(layout.qr.square.y+layout.qr.square.height/2);
  expect(Array.from(ctx.getImageData(qrX,qrY,1,1).data)).toEqual([255,255,255,255]);
  const proof=canvas.createCanvas(widthPx,heightPx),proofCtx=proof.getContext('2d');proofCtx.fillStyle=hex;proofCtx.fillRect(0,0,widthPx,heightPx);proofCtx.drawImage(image,0,0);
  expect(jsQR(proofCtx.getImageData(0,0,widthPx,heightPx).data,widthPx,heightPx)?.data).toBe(url);
 });
 it('honors the member/partner per-placement choice and fails when selected artwork is missing',async()=>{
  const placement={dimensions:{widthPx:1500,heightPx:600,dpi:300},dpi:300};
  const content=rewardGraphicInput(placement,url,'invalid-image','brand');
  const snapshot={graphics:{content},qrConfig:{selectedColor:{name:'Black',hex:'#000000'}},metadata:{},layoutConfig:{selectedPlacements:['front'],providerLayouts:{front:placement},placementSizes:{front:'large'},perPlacementConfigs:{front:{graphicChoice:'qr-only'}}}};
  expect(productGraphicOptions(snapshot,url).areaImageUrl).toBeNull();
  snapshot.layoutConfig.perPlacementConfigs.front.graphicChoice='full';
  await expect(renderer.renderProductGraphic(productGraphicOptions(snapshot,url) as any)).rejects.toThrow('Selected artwork could not load');
 });
});
