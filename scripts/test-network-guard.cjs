const net=require('net');
const connect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){
 let a=args[0]; if(Array.isArray(a)) a=a[0];
 const host=typeof a==='object'?a.host:typeof args[1]==='string'?args[1]:'localhost';
 if(typeof a==='string'||a?.path||['localhost','127.0.0.1','::1',undefined].includes(host))return connect.apply(this,args);
 throw new Error('Audit: external network disabled: '+host);
};
const fetch=globalThis.fetch;
if(fetch)globalThis.fetch=function(input,...args){const u=new URL(typeof input==='string'?input:input.url);if(!['localhost','127.0.0.1','[::1]'].includes(u.hostname))throw new Error('Audit: external fetch disabled');return fetch(input,...args);};
