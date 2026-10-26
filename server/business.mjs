import { getCatalog } from './catalog.mjs';
export function attendanceDate(value){
 if(value===undefined)return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Date must use YYYY-MM-DD');
 const date=new Date(value+'T00:00:00Z');
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)throw Error('Invalid date');
 return value;
}
export function summarizeAttendance(students,month){
 if(typeof month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Month must use YYYY-MM');
 return students.map(s=>{const counts={present:0,late:0,absent:0,excused:0};for(const [date,status] of Object.entries(s.attendance||{}))if(date.startsWith(month+'-')&&Object.hasOwn(counts,status))counts[status]++;return {studentId:s.id,...counts,total:Object.values(counts).reduce((sum,n)=>sum+n,0)};});
}
export function applyAction(state    ,input    ,actor       ){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid action');
 if(!Number.isSafeInteger(Number(input.studentId))||Number(input.studentId)<1)throw Error('Invalid student');
 const s=state.students.find((s    )=>s.id===Number(input.studentId)); if(!s) throw Error('ไม่พบเลขที่นักเรียน');
 const catalog=getCatalog(state); const {action,itemId,status}=input; const note=String(input.note||'').trim().slice(0,180); const amount=Number(input.amount);
 if(['merit','deposit','withdraw'].includes(action)&&(typeof input.amount!=='number'&&typeof input.amount!=='string'||String(input.amount).trim()===''))throw Error('Invalid amount');
 let detail='',eventDate,moneyMeta={};
 if(action==='attendance'){
  if(!['present','late','absent','excused'].includes(status))throw Error('สถานะไม่ถูกต้อง');
  eventDate=attendanceDate(input.date);
  const before=s.attendance[eventDate]; if(before===status)return;
  s.attendance[eventDate]=status; detail=`${eventDate} เช็กชื่อ ${status}${before?' (แก้ไขจาก '+before+')':''}`;
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
  moneyMeta={amount,moneyDeltaSatang:action==='deposit'?satang:-satang};
  s.savings+=moneyMeta.moneyDeltaSatang;detail=`${action==='deposit'?'ฝาก':'ถอน'} ${amount.toFixed(2)} บาท`;
 }else if(action==='reverseMoney'){
  if(actor!=='teacher')throw Error('Teacher account required');
  if(!note||typeof input.entryId!=='string')throw Error('Provide original entry and correction reason');
  const original=state.ledger.find(entry=>entry.id===input.entryId&&entry.studentId===s.id);
  if(!original||!['deposit','withdraw'].includes(original.action))throw Error('Original money entry not found');
  const delta=original.moneyDeltaSatang;
  if(!Number.isSafeInteger(delta)||delta===0||Math.abs(delta)>10000000||(original.action==='deposit'?delta<0:delta>0))throw Error('This historical entry cannot be reversed automatically');
  if(state.ledger.some(entry=>entry.reversesEntryId===original.id))throw Error('This entry has already been reversed');
  const corrected=s.savings-delta;
  if(!Number.isSafeInteger(corrected)||corrected<0)throw Error('Insufficient savings or balance limit exceeded');
  moneyMeta={amount:Math.abs(delta)/100,moneyDeltaSatang:-delta,reversesEntryId:original.id};
  s.savings=corrected;detail='Reverse money entry '+original.id;
 }else if(action==='buy'){

  const item=catalog.find((i    )=>i.id===itemId);if(!item||item.archived)throw Error('ไม่พบสินค้าหรือหยุดขายแล้ว');
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
 state.ledger.unshift({id:crypto.randomUUID(),studentId:s.id,action,detail,note,...moneyMeta,...(eventDate?{date:eventDate}:{}),at:new Date().toISOString(),actor});
}
