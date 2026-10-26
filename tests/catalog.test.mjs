import test from 'node:test';
import assert from 'node:assert/strict';
import {getCatalog,upsertItem} from '../server/catalog.mjs';
import {avatarSvg} from '../assets/avatar.js';
const item={id:'hat-gold',name:'Golden hat',slot:'hat',shape:'crown',price:25,color:'#ffd055'};
test('catalog edits retain default products and archived products remain available to owners',()=>{
 const state={students:[{owned:['hat-gold'],equipped:{hat:'hat-gold'}}]};
 upsertItem(state,item);assert.equal(getCatalog(state).length,13);
 upsertItem(state,{...item,price:30,archived:true});
 assert.equal(getCatalog(state).filter(x=>x.id===item.id).length,1);
 assert.equal(getCatalog(state).find(x=>x.id===item.id).price,30);
 assert.equal(getCatalog(state).find(x=>x.id===item.id).archived,true);
 assert.match(avatarSvg({hat:item.id},0,getCatalog(state)),/#ffd055/);
 assert.deepEqual(state.students[0].owned,['hat-gold']);
 assert.throws(()=>upsertItem(state,{...item,slot:'shirt',shape:'shirt'}));
 const defaultItem=getCatalog(state).find(x=>x.id==='hat-crown');upsertItem(state,{...defaultItem,price:10});
 assert.equal(getCatalog(state).find(x=>x.id==='hat-crown').shape,'crown');
});
test('catalog rejects executable markup, unsupported images, and invalid product fields',()=>{
 for(const patch of [{id:'x" onclick="x'},{color:'red" onload="x'},{price:-1},{price:0.5},{slot:'__proto__'},{shape:'unknown'},{imageUrl:'javascript:alert(1)'},{imageUrl:'https://example.test/hat.svg'},{imageUrl:'https://user:pass@example.test/hat.png'},{imageData:'data:image/svg+xml;base64,PHN2Zy8+'},{imageData:'data:image/png;base64,QUJD'}]) assert.throws(()=>upsertItem({}, {...item,...patch}));
 const state={};upsertItem(state,{...item,imageUrl:'https://example.test/hat.png?q=" onclick="bad'});
 const svg=avatarSvg({hat:item.id},0,getCatalog(state));
 assert.ok(!svg.includes('q=" onclick="'));
 assert.match(svg,/&quot;/);
});
test('raster layers are rendered while unsafe image references never enter the SVG',()=>{
 const state={};upsertItem(state,{...item,imageUrl:'https://example.test/hat.png'});
 assert.match(avatarSvg({hat:item.id},0,getCatalog(state)),/<image href="https:\/\/example.test\/hat.png"/);
 const svg=avatarSvg({hat:'bad'},0,[{...item,id:'bad',color:'" onload="alert(1)',imageUrl:'data:image/svg+xml,<svg onload="alert(1)"/>'}]);
 assert.ok(!svg.includes('<image'));
 assert.ok(!svg.includes('fill="" onload='));
});
