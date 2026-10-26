import {catalog as defaults} from '../assets/avatar.js';
const shapes={shirt:['shirt'],hat:['cap','crown','cat'],accessory:['star','heart','bag','flower']};
export function getCatalog(state={}){
 const overrides=Array.isArray(state.catalogOverrides)?state.catalogOverrides:[];
 return [...defaults.map(item=>({...item,...overrides.find(x=>x.id===item.id)})),...overrides.filter(item=>!defaults.some(x=>x.id===item.id)).map(item=>({...item}))];
}
export function upsertItem(state,input){
 const item=input?.item||input;
 if(!item||typeof item!=='object'||Array.isArray(item))throw Error('Invalid item');
 const id=String(item.id||'').trim(),name=String(item.name||'').trim(),slot=item.slot,price=Number(item.price),color=String(item.color||'').trim();
 if(!/^[a-z][a-z0-9-]{1,59}$/.test(id)||!name||name.length>80||!Object.hasOwn(shapes,slot)||!Number.isSafeInteger(price)||price<0||price>100000||!/^#[0-9a-fA-F]{6}$/.test(color))throw Error('Invalid product ID, name, category, price or color');
 const previous=getCatalog(state).find(x=>x.id===id);
 if(previous&&previous.slot!==slot)throw Error('Existing product category cannot change; create a new product');
 const defaultShape=previous?.id?.replace(/^(hat|accessory)-/,'');
 const shape=item.shape||previous?.shape||(shapes[slot].includes(defaultShape)?defaultShape:(slot==='shirt'?'shirt':slot==='hat'?'cap':'star'));
 if(!shapes[slot].includes(shape))throw Error('Invalid product shape');
 const imageUrl=String(item.imageUrl||'').trim(),imageData=String(item.imageData||'').trim();
 if(imageUrl&&imageData)throw Error('Choose one product image');
 if(imageUrl){let url;try{url=new URL(imageUrl)}catch{throw Error('Invalid image URL')}if(url.protocol!=='https:'||url.username||url.password||imageUrl.length>2048||!/\.(png|jpe?g|webp)$/i.test(url.pathname))throw Error('Use an HTTPS PNG, JPEG or WebP image URL');}
 if(imageData){
  if(!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(imageData))throw Error('Only PNG image data is supported');
  const bytes=Buffer.from(imageData.slice(imageData.indexOf(',')+1),'base64');
  if(bytes.length>150*1024||bytes.length<24||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.toString('ascii',12,16)!=='IHDR')throw Error('Invalid PNG or image exceeds 150 KB');
  const w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);if(!w||!h||w>2048||h>2048)throw Error('Image dimensions must be at most 2048 pixels');
 }
 if(item.archived!==undefined&&typeof item.archived!=='boolean')throw Error('Archived must be true or false');
 const validated={id,name,slot,price,color,shape,imageUrl,imageData,archived:!!item.archived};
 state.catalogOverrides=Array.isArray(state.catalogOverrides)?state.catalogOverrides:[];
 const index=state.catalogOverrides.findIndex(x=>x.id===id);if(index<0)state.catalogOverrides.push(validated);else state.catalogOverrides[index]=validated;
 return validated;
}
