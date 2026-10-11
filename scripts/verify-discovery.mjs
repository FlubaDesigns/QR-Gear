import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const root='dist/public';
const manifest=JSON.parse(await fs.readFile(path.join(root,'discovery-manifest.json'),'utf8'));
const sitemap=await fs.readFile(path.join(root,'sitemap.xml'),'utf8');
const llms=await fs.readFile(path.join(root,'llms.txt'),'utf8');
const robots=await fs.readFile(path.join(root,'robots.txt'),'utf8');
assert(robots.includes('User-agent: OAI-SearchBot')&&robots.includes('Disallow: /admin'));
assert.equal((robots.match(/Allow: \//g)||[]).length,1,'All agents must share the same restrictions');
assert(!/QR Compose|\$35\/mo|change anytime|Printify print-on-demand network/.test(llms));
assert(manifest.pages.length>50,'Include public information, store and product pages');
for(const page of manifest.pages){
 const url=new URL(page.url), file=path.join(root,url.pathname==='/'?'index.html':url.pathname.slice(1)+'.html');
 const html=await fs.readFile(file,'utf8');
 assert.equal((html.match(/rel="canonical"/g)||[]).length,1,page.url);
 assert(html.includes('href="'+page.url+'"'),page.url+' canonical');
 assert(html.includes('<h1'),page.url+' readable content');
 assert(html.includes('application/ld+json'),page.url+' structured data');
 assert(sitemap.includes('<loc>'+page.url+'</loc>'),page.url+' sitemap');
 assert(llms.includes('('+page.url+')'),page.url+' AI guide');
 assert(!/^\/(admin|account|members|login|checkout)/.test(url.pathname));
 for(const m of html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g))assert((await fs.stat(path.join(root,m[1]))).isFile(),m[1]);
}
console.log('PASS: '+manifest.pages.length+' readable public pages; canonical URLs, metadata, structured data, asset links, sitemap and AI guide agree.');
