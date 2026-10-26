export const catalog = [
  {id:'shirt-mint',name:'เสื้อมินต์สดใส',price:15,slot:'shirt',color:'#56cdb0'},
  {id:'shirt-sky',name:'เสื้อท้องฟ้า',price:15,slot:'shirt',color:'#64b5ef'},
  {id:'shirt-peach',name:'เสื้อพีชละมุน',price:20,slot:'shirt',color:'#ffad91'},
  {id:'shirt-lavender',name:'เสื้อลาเวนเดอร์',price:20,slot:'shirt',color:'#ad91e8'},
  {id:'hat-cap',name:'หมวกนักผจญภัย',price:30,slot:'hat',color:'#49b998'},
  {id:'hat-pink',name:'หมวกสายไหม',price:30,slot:'hat',color:'#f18bb0'},
  {id:'hat-crown',name:'มงกุฎดาวเด่น',price:70,slot:'hat',color:'#f8c849'},
  {id:'hat-cat',name:'หมวกหูแมว',price:55,slot:'hat',color:'#ad91e8'},
  {id:'accessory-star',name:'ดาวคู่ใจ',price:25,slot:'accessory',color:'#f8c849'},
  {id:'accessory-heart',name:'หัวใจแสนดี',price:25,slot:'accessory',color:'#f18bb0'},
  {id:'accessory-bag',name:'กระเป๋านักสำรวจ',price:40,slot:'accessory',color:'#cc9561'},
  {id:'accessory-flower',name:'ดอกไม้ยิ้มแฉ่ง',price:40,slot:'accessory',color:'#ffd668'}
];

export function avatarSvg(equipped = {}, variant = 0, items = catalog) {
  const find = (slot) => { const value = equipped[slot]; return items.find(x => x.id === (typeof value === 'object' ? value?.id : value) && x.slot === slot); };
  const shirt = find('shirt'), hat = find('hat'), accessory = find('accessory');
  const colors = ['#543c39','#342d3e','#805338','#453f48'];
  const hair = colors[Math.abs(Number(variant)||0)%colors.length];
  const skin = ['#f6c49d','#dca67c','#f3d0b2'][Math.abs(Number(variant)||0)%3];
  const attr = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const r = (x,y,w,h,c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${attr(c)}"/>`;
  let s = '';
  // Rounded silhouette built exclusively from crisp pixel rectangles.
  s += r(8,5,16,2,hair)+r(5,7,22,4,hair)+r(4,11,24,11,hair)+r(6,22,20,2,hair);
  s += r(7,12,18,9,skin)+r(9,21,14,3,skin)+r(5,15,2,5,skin)+r(25,15,2,5,skin);
  s += r(7,10,6,4,hair)+r(12,10,4,2,hair)+r(22,10,3,5,hair);
  s += r(10,16,3,3,'#302b38')+r(20,16,3,3,'#302b38');
  s += r(11,16,1,1,'#fff')+r(21,16,1,1,'#fff');
  s += r(8,20,4,1,'#ed9b99')+r(21,20,3,1,'#ed9b99')+r(15,21,3,1,'#b55f63');
  s += r(13,24,6,2,skin);
  const sc = shirt?.color || '#75c6b3';
  s += r(9,26,14,8,sc)+r(6,27,3,5,sc)+r(23,27,3,5,sc);
  s += r(6,32,3,3,skin)+r(23,32,3,3,skin)+r(14,26,4,2,'#f7f5ed');
  s += r(10,34,5,3,'#566880')+r(17,34,5,3,'#566880');
  s += r(9,37,6,2,'#35344a')+r(17,37,6,2,'#35344a');
  if (hat) {
    if ((hat.shape === 'crown' || (!hat.shape && hat.id === 'hat-crown'))) s += r(7,3,3,5,hat.color)+r(14,1,4,7,hat.color)+r(22,3,3,5,hat.color)+r(7,7,18,3,hat.color)+r(15,5,2,2,'#f18bb0');
    else if ((hat.shape === 'cat' || (!hat.shape && hat.id === 'hat-cat'))) s += r(5,2,5,8,hat.color)+r(22,2,5,8,hat.color)+r(8,6,16,5,hat.color)+r(6,4,2,4,'#f3b5d6')+r(24,4,2,4,'#f3b5d6');
    else s += r(8,4,16,3,hat.color)+r(5,7,22,4,hat.color)+r(19,10,10,2,hat.color)+r(11,6,5,2,'#ffffff88');
  }
  if (accessory) {
    const c = accessory.color;
    if ((accessory.shape === 'heart' || (!accessory.shape && accessory.id === 'accessory-heart'))) s += r(25,23,2,2,c)+r(29,23,2,2,c)+r(25,25,6,2,c)+r(26,27,4,1,c)+r(27,28,2,1,c);
    if ((accessory.shape === 'star' || (!accessory.shape && accessory.id === 'accessory-star'))) s += r(27,22,2,7,c)+r(25,24,6,3,c)+r(26,27,1,2,c)+r(29,27,1,2,c);
    if ((accessory.shape === 'bag' || (!accessory.shape && accessory.id === 'accessory-bag'))) s += r(10,26,2,7,c)+r(9,30,8,6,c)+r(11,31,4,1,'#f3cc98')+r(12,33,2,1,'#755843');
    if ((accessory.shape === 'flower' || (!accessory.shape && accessory.id === 'accessory-flower'))) s += r(28,27,1,7,'#63ad7c')+r(26,32,2,1,'#63ad7c')+r(27,23,3,7,c)+r(25,25,7,3,c)+r(27,25,3,3,'#ef9c7f');
  }
  // Uploaded pixel layers use raster images only; never accept SVG markup.
  for (const item of [shirt,hat,accessory]) {
    const source = item?.imageData || item?.imageUrl;
    if (!source) continue;
    const safePng = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(source) && source.length <= 205000;
    let safeUrl = false;
    try { const u = new URL(source); safeUrl = u.protocol === 'https:' && !u.username && !u.password && /\.(png|jpe?g|webp)$/i.test(u.pathname); } catch {}
    if (!safePng && !safeUrl) continue;
    const box = item.slot === 'shirt' ? [5,24,22,12] : item.slot === 'hat' ? [3,0,26,13] : [23,20,9,16];
    s += `<image href="${attr(source)}" x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40" role="img" aria-label="อวตารพิกเซล" shape-rendering="crispEdges">${s}</svg>`;
}
