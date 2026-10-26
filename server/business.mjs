import { catalog } from '../assets/avatar.js';
export function applyAction(state    ,input    ,actor       ){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid action');
 if(!Number.isSafeInteger(Number(input.studentId))||Number(input.studentId)<1)throw Error('Invalid student');
 const s=state.students.find((s    )=>s.id===Number(input.studentId)); if(!s) throw Error('ไม่พบเลขที่นักเรียน');
 const {action,itemId,status}=input; const note=String(input.note||'').trim().slice(0,180); const amount=Number(input.amount);
 if(['merit','deposit','withdraw'].includes(action)&&(typeof input.amount!=='number'&&typeof input.amount!=='string'||String(input.amount).trim()===''))throw Error('Invalid amount');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); let detail='';
 if(action==='attendance'){
  if(!['present','late','absent','excused'].includes(status))throw Error('สถานะไม่ถูกต้อง');
  const before=s.attendance[today]; if(before===status)return;
  s.attendance[today]=status; detail=`เช็กชื่อ ${status}${before?' (แก้ไขจาก '+before+')':''}`;
 }else if(action==='merit'){
  if(!Number.isSafeInteger(amount)||amount===0||Math.abs(amount)>1000||!note)throw Error('ระบุคะแนนจำนวนเต็ม 1–1,000 และเหตุผล');
  if(s.merit+amount<0)throw Error('คะแนนความดีไม่เพียงพอ');
  if(!Number.isSafeInteger(s.merit+amount)||(amount>0&&!Number.isSafeInteger(s.coins+amount)))throw Error('Balance limit exceeded');
  s.merit+=amount;if(amount>0)s.coins+=amount;detail=`คะแนนความดี ${amount>0?'+':''}${amount}${amount>0?' และเหรียญ +'+amount:''}`;
 }else if(action==='deposit'||action==='withdraw'){
  const satang=Math.round(amount*100);
  if(!Number.isFinite(amount)||satang<=0||satang>10000000||Math.abs(amount*100-satang)>0.00001||!note)throw Error('ระบุจำนวนเงินไม่เกิน 100,000 บาท และหมายเหตุ');
  if(action==='withdraw'&&s.savings<satang)throw Error('เงินฝากไม่เพียงพอ');
  if(!Number.isSafeInteger(s.savings+(action==='deposit'?satang:-satang)))throw Error('Balance limit exceeded');
  s.savings+=action==='deposit'?satang:-satang;detail=`${action==='deposit'?'ฝาก':'ถอน'} ${amount.toFixed(2)} บาท`;
 }else if(action==='buy'){
  const item=catalog.find((i    )=>i.id===itemId);if(!item)throw Error('ไม่พบสินค้า');
  if(s.owned.includes(itemId))throw Error('มีสินค้านี้แล้ว');if(s.coins<item.price)throw Error('เหรียญไม่เพียงพอ');
  s.coins-=item.price;s.owned.push(itemId);s.equipped[item.slot]=itemId;detail=`แลก ${item.name} −${item.price} เหรียญ`;
 }else if(action==='equip'){
  if(itemId===''){if(!['shirt','hat','accessory'].includes(input.slot))throw Error('ช่องแต่งตัวไม่ถูกต้อง');delete s.equipped[input.slot];}
  else{const item=catalog.find((i    )=>i.id===itemId);if(!item||!s.owned.includes(itemId))throw Error('ยังไม่มีสินค้านี้');s.equipped[item.slot]=itemId;}detail='เปลี่ยนชุด';
 }else if(action==='setSchoolId'){
  const schoolId=String(input.schoolId||'').trim();if(!/^\d{3,20}$/.test(schoolId))throw Error('School ID must contain 3 to 20 digits');
  if(state.students.some((x    )=>x.id!==s.id&&String(x.schoolId)===schoolId))throw Error('School ID is already in use');
  if(s.schoolId&&state.loginAttempts)delete state.loginAttempts[s.schoolId];s.schoolId=schoolId;delete s.passwordHash;state.sessions=(state.sessions||[]).filter((x    )=>x.studentId!==s.id);detail='Updated student login ID';
 }else if(action==='resetStudentPassword'){
  if(s.schoolId&&state.loginAttempts)delete state.loginAttempts[s.schoolId];delete s.passwordHash;state.sessions=(state.sessions||[]).filter((x    )=>x.studentId!==s.id);detail='Student password reset';
 }else if(action==='rename'){
  const name=String(input.name||'').trim().slice(0,60);if(!name)throw Error('กรุณาระบุชื่อ');s.name=name;detail='แก้ไขชื่อ';
 }else throw Error('คำสั่งไม่ถูกต้อง');
 state.ledger.unshift({id:crypto.randomUUID(),studentId:s.id,action,detail,note,at:new Date().toISOString(),actor});
}
