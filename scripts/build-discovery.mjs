/** Build crawler-readable HTML from the same React pages, route map and public catalog. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import ts from 'typescript';
const root=process.cwd(), output=path.join(root,'dist/public'), temp=path.join(root,'node_modules/.qrgear-discovery');
await fs.mkdir(temp,{recursive:true});
const source=await fs.readFile('client/src/App.tsx','utf8');
const ast=ts.createSourceFile('App.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const imports=new Map(), routes=[];
for(const node of ast.statements)if(ts.isImportDeclaration(node)&&node.importClause?.name)imports.set(node.importClause.name.text,node.moduleSpecifier.text);
function visit(node){if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(ast)==='Route'){
 const attrs=Object.fromEntries(node.attributes.properties.filter(ts.isJsxAttribute).map(a=>[a.name.getText(ast),a.initializer]));
 if(attrs.path&&ts.isStringLiteral(attrs.path)&&attrs.component&&ts.isJsxExpression(attrs.component))routes.push({path:attrs.path.text,component:attrs.component.expression.getText(ast)});
}ts.forEachChild(node,visit)}visit(ast);
const images=await fs.readFile('client/src/data/pageImages.ts','utf8');
const publicPaths=[...images.matchAll(/"(\/[^"\n]+)":/g)].map(m=>m[1]).filter(p=>p!='/login');
publicPaths.push('/','/gallery','/build');
const selected=routes.filter(r=>publicPaths.includes(r.path)||r.path.startsWith('/shop/'));
const components=[...new Set(selected.map(r=>r.component))];
const moduleImports=components.map(name=>`import ${name} from ${JSON.stringify(path.resolve(root,'client/src',imports.get(name).replace(/^\.\//,'').replace(/^@\//,'')))};`).join('\n');
await fs.writeFile(path.join(temp,'entry.tsx'),`
import React from 'react'; import {renderToString} from 'react-dom/server';
import {Router,Route} from 'wouter'; import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {CartProvider} from '${root}/client/src/contexts/CartContext';
import {TooltipProvider} from '${root}/client/src/components/ui/tooltip';
import {PageSkeleton} from '${root}/client/src/components/PageSkeleton';
import {SEOCollector} from '${root}/client/src/components/SEO';
import {QR_GEAR} from '${root}/client/src/data/shopHierarchy';
import {actionCards} from '${root}/client/src/components/ActionCards';
${moduleImports}
export {QR_GEAR,actionCards};
const routes=[${selected.map(r=>`{path:${JSON.stringify(r.path)},component:${r.component}}`).join(',')}];
export function render(url,cache=[]){const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});for(const [key,data] of cache)client.setQueryData(key,data);let metadata={};
const html=renderToString(<Router ssrPath={url}><QueryClientProvider client={client}><CartProvider><TooltipProvider><SEOCollector.Provider value={m=>{metadata=m}}><PageSkeleton>{routes.map(r=><Route key={r.path} path={r.path} component={r.component}/>)}</PageSkeleton></SEOCollector.Provider></TooltipProvider></CartProvider></QueryClientProvider></Router>);client.clear();return {html,metadata};}
`);
await build({build:{ssr:path.join(temp,'entry.tsx'),outDir:temp,emptyOutDir:false,rollupOptions:{output:{entryFileNames:'render.mjs'}}},logLevel:'warn'});
console.log('Discovery renderer built');
const {render,QR_GEAR,actionCards}=await import(pathToFileURL(path.join(temp,'render.mjs')).href);
console.log('Discovery renderer imported');
const origin='https://qrgear.com';
async function get(url){console.log('Read public catalog:',url);const r=await fetch(origin+url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`Public catalog ${url}: ${r.status}`);return r.json();}
const storePath='/shop/'+QR_GEAR.storeType+'/'+QR_GEAR.storeName;
const pages=new Map(publicPaths.map(p=>[p,{cache:[]}]));
pages.set(storePath,{cache:[],title:QR_GEAR.label+' Store',description:QR_GEAR.description});
for(const channel of QR_GEAR.channels){
 const catalog=await get('/api/store/'+QR_GEAR.storeType+'/'+QR_GEAR.storeName+'?channel='+encodeURIComponent(channel.slug));
 if(!Array.isArray(catalog.products))throw new Error('Invalid public catalog');
 const channelKey=['/api/store',QR_GEAR.storeType,QR_GEAR.storeName,channel.slug,null,channel.slug];
 pages.set(storePath+'/'+channel.slug,{cache:[[channelKey,catalog]],title:channel.label+' | QR Gear',description:channel.description});
 pages.get('/').cache.push([channelKey,catalog]);
 for(const c of channel.collections){const data={...catalog,products:catalog.products.filter(p=>p.segment===c.segmentValue)};
 pages.set(storePath+'/'+channel.slug+'/'+c.slug,{cache:[[['/api/store',QR_GEAR.storeType,QR_GEAR.storeName,channel.slug,c.slug,null],data]],title:c.label+' | '+channel.label+' | QR Gear',description:c.description});}
 // Resolve the exact public product response consumed by the existing product page.
 for(let i=0;i<catalog.products.length;i+=4)await Promise.all(catalog.products.slice(i,i+4).map(async p=>{const data=await get('/api/store/product/'+encodeURIComponent(p.id));pages.set('/shop/product/'+p.id,{cache:[[['/api/store/product',p.id],data]],product:data});}));
}
for(const [url,key] of [['/gifts','/api/gifts/packages'],['/gallery','/api/gallery']])pages.get(url).cache.push([[key],await get(key)]);
// No duplicated copy: metadata is collected from SEO and body text from the real components.
const template=await fs.readFile(path.join(output,'index.html'),'utf8');
const rootStart=template.indexOf('<div id="root">'), rootEnd=template.lastIndexOf('</div>');
const cleanTemplate=rootStart>=0&&rootEnd>=rootStart?template.slice(0,rootStart)+'<div id="root"></div>'+template.slice(rootEnd+6):template;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const records=[];
for(const [url,data] of pages){
 const {html,metadata}=render(url,data.cache);if(!html.includes('<h1'))throw new Error('No readable page heading: '+url);
 const title=metadata.title||data.title||({'/gifts':'Personalized Gift Shop | QR Gear','/gallery':'QR Gear Gallery','/build':'Create Your QR Gear'})[url];
 const description=metadata.description||data.description||'Explore personalized QR Gear, custom designs and scannable stories.';
 if(!title)throw new Error('Missing metadata: '+url);
 const canonical=origin+url, image=metadata.ogImage||origin+'/og-image.png';
 let doc=cleanTemplate.replace(/<title>[\s\S]*?<\/title>/,'').replace(/<meta\s+(?:name="(?:description|keywords|robots|twitter:[^"]+)"|property="og:[^"]+")[^>]*>/g,'').replace(/<link rel="canonical"[^>]*>/g,'').replace(/<script(?: id="page-structured-data")? type="application\/ld\+json">[\s\S]*?<\/script>/g,'');
 const schema={'@context':'https://schema.org','@type':'WebPage',name:title,description,url:canonical,isPartOf:{'@type':'WebSite',name:'QR Gear',url:origin+'/'},primaryImageOfPage:{'@type':'ImageObject',url:image}};
 const tags='<title>'+escape(title)+'</title>\n<meta name="description" content="'+escape(description)+'">\n<link rel="canonical" href="'+canonical+'">\n<meta name="robots" content="index, follow, max-image-preview:large">\n'+Object.entries({'og:type':'website','og:site_name':'QR Gear','og:title':title,'og:description':description,'og:url':canonical,'og:image':image}).map(([k,v])=>'<meta property="'+k+'" content="'+escape(v)+'">').join('\n')+'\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="'+escape(title)+'">\n<meta name="twitter:description" content="'+escape(description)+'">\n<meta name="twitter:image" content="'+escape(image)+'">\n<script id="page-structured-data" type="application/ld+json">'+JSON.stringify(schema).replace(/</g,'\\u003c')+'</script>\n';
 doc=doc.replace('</head>',tags+'</head>').replace('<div id="root"></div>','<div id="root">'+html+'</div>');
 const dest=path.join(output,url==='/'?'index.html':url.slice(1)+'.html');await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,doc);
 records.push({url:canonical,title,description,image,images:[...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map(m=>new URL(m[1].replace(/&amp;/g,'&'),origin).href)});
}
const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'+records.map(r=>'  <url><loc>'+escape(r.url)+'</loc>'+[...new Set(r.images)].filter(s=>s.startsWith('https://')).map(s=>'<image:image><image:loc>'+escape(s)+'</image:loc></image:image>').join('')+'</url>').join('\n')+'\n</urlset>\n';
await fs.writeFile(path.join(output,'sitemap.xml'),xml);
const intro='# QR Gear\n\n> Physical gear. Digital world. Custom merchandise with QR codes connecting to a link, image, video or changing digital experience.\n\nCurrent prices, options and availability come from the live product pages and checkout. Production and shipping estimates vary by item and destination.\n\n## QR types\n\n'+actionCards.map(a=>'- ['+a.title+']('+origin+a.href+'): '+a.description+' '+a.tagline).join('\n')+'\n\n## Public pages and store catalog\n\n';
const guide=intro+records.map(r=>'- ['+r.title+']('+r.url+'): '+r.description.replace(/\s+/g,' ')).join('\n')+'\n\n## Contact and policies\n\nContact: info@qrgear.com\nSitemap: https://qrgear.com/sitemap.xml\n\nThis guide is generated from the public pages and catalog on each production build. It does not guarantee crawler inclusion or ranking.\n';
await fs.writeFile(path.join(output,'llms.txt'),guide);await fs.writeFile(path.join(output,'ai.txt'),guide);
await fs.writeFile(path.join(output,'discovery-manifest.json'),JSON.stringify({pages:records.map(({url,title})=>({url,title}))},null,2));
console.log('Discovery: rendered '+records.length+' public/store/product pages with unique metadata, sitemap and AI guide.');
