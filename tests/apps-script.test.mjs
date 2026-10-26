import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash,createHmac,randomUUID,pbkdf2Sync} from 'node:crypto';

function gasHarness(){
 const props=new Map(),books=new Map();let locked=false,failNextFlush=false,flushes=0;
 class Range {
  constructor(sheet,row,col,rows=1,cols=1){Object.assign(this,{sheet,row,col,rows,cols});}
  getValues(){return Array.from({length:this.rows},(_,r)=>Array.from({length:this.cols},(_,c)=>this.sheet.cells[this.row+r-1]?.[this.col+c-1]??''));}
  setValues(values){assert.equal(values.length,this.rows);for(let r=0;r<this.rows;r++){assert.equal(values[r].length,this.cols);this.sheet.cells[this.row+r-1]||=[];for(let c=0;c<this.cols;c++)this.sheet.cells[this.row+r-1][this.col+c-1]=values[r][c];}return this;}
  setNumberFormat(){return this;}
  getValue(){return this.getValues()[0][0];}
  setValue(value){return this.setValues([[value]]);}
  clearContent(){return this.setValues(Array.from({length:this.rows},()=>Array(this.cols).fill('')));}
 }
 class Sheet {
  constructor(name){this.name=name;this.cells=[];this.maxRows=1000;}
  getName(){return this.name;}
  getRange(row,col,rows=1,cols=1){return new Range(this,row,col,rows,cols);}
  clearContents(){this.cells=[];return this;}
  clear(){return this.clearContents();}
  getLastRow(){return this.cells.reduce((last,row,i)=>row.some(v=>v!=='')?i+1:last,0);}
  getMaxRows(){return this.maxRows;}
  insertRowsAfter(after,count){this.maxRows+=count;return this;}
 }
 class Book {
  constructor(name){this.name=name;this.id=randomUUID();this.sheets=[new Sheet('Sheet1')];}
  getId(){return this.id;}
  getUrl(){return 'https://docs.google.com/spreadsheets/d/'+this.id;}
  insertSheet(name){const sheet=new Sheet(name);this.sheets.push(sheet);return sheet;}
  getSheetByName(name){return this.sheets.find(s=>s.name===name)||null;}
  getSheets(){return this.sheets;}
 }
 const store={getProperty:k=>props.get(k)??null,setProperty(k,v){props.set(k,String(v));return this;},setProperties(values,deleteAll=false){if(deleteAll)props.clear();for(const [k,v] of Object.entries(values))props.set(k,String(v));return this;},getProperties:()=>Object.fromEntries(props),deleteProperty(k){props.delete(k);return this;},deleteAllProperties(){props.clear();return this;}};
 const asBuffer=v=>typeof v==='string'?Buffer.from(v):Buffer.from(Array.from(v,x=>x&255));const signed=b=>Array.from(b,x=>x>127?x-256:x);
 const context=vm.createContext({console,Date,JSON,Math,Uint8Array,ArrayBuffer,
  PropertiesService:{getScriptProperties:()=>store},
  SpreadsheetApp:{create(name){const b=new Book(name);books.set(b.id,b);return b;},openById(id){const b=books.get(id);if(!b)throw Error('Missing spreadsheet');return b;},flush(){flushes++;if(failNextFlush){failNextFlush=false;throw Error('Simulated flush failure');}}},
  LockService:{getScriptLock:()=>({waitLock(){if(locked)throw Error('Lock timeout');locked=true;},tryLock(){if(locked)return false;locked=true;return true;},releaseLock(){locked=false;},hasLock:()=>locked})},
  Utilities:{DigestAlgorithm:{SHA_256:'SHA_256'},Charset:{UTF_8:'UTF_8'},getUuid:randomUUID,computeDigest:(algorithm,value)=>signed(createHash('sha256').update(asBuffer(value)).digest()),computeHmacSha256Signature:(value,key)=>signed(createHmac('sha256',asBuffer(key)).update(asBuffer(value)).digest()),base64Encode:v=>asBuffer(v).toString('base64'),base64EncodeWebSafe:v=>asBuffer(v).toString('base64url'),base64Decode:v=>signed(Buffer.from(v,'base64')),newBlob:value=>({getBytes:()=>signed(asBuffer(value)),getDataAsString:()=>asBuffer(value).toString()}),formatDate(date,zone,format){const f=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);return format==='yyyy-MM'?f.slice(0,7):f;},sleep(){}},
  ContentService:{MimeType:{JSON:'application/json'},createTextOutput:text=>({setMimeType(){return this;},getContent:()=>text})}
 });
 vm.runInContext(readFileSync(new URL('../apps-script/Core.gs',import.meta.url),'utf8'),context);
 vm.runInContext(readFileSync(new URL('../apps-script/Code.gs',import.meta.url),'utf8'),context);
 return {context,props,books,store,run:source=>vm.runInContext(source,context),get locked(){return locked;},get flushes(){return flushes;},failFlush(){failNextFlush=true;},setLocked(value){locked=value;},dispatch(input){return JSON.parse(JSON.stringify(context.dispatchClient(input)));}};
}

// Tests below execute the actual Apps Script source against private in-memory Google service mocks.

const setup=()=>{const h=gasHarness();h.store.setProperty('ADMIN_PASSWORD','test-only-password');h.run('setupClassroom_()');return h;};
const call=(h,path,body,token)=>h.dispatch({path,body,token});
const signIn=(h,username='krutoey',password='test-only-password')=>{const result=call(h,'/api/login',{username,password});assert.ok(result.token,JSON.stringify(result));return result.token;};
let sequence=0;const action=(h,token,body)=>call(h,'/api/action',{studentId:1,requestId:'gas-test-'+(++sequence),...body},token);

test('Apps Script actual dispatcher preserves private data, balances, ownership and request retries',()=>{
 const h=setup(),teacher=signIn(h);
 assert.equal(h.props.has('ADMIN_PASSWORD'),false,'Plaintext bootstrap password must be deleted');
 assert.ok(h.props.get('ADMIN_PASSWORD_HASH'));
 assert.equal(action(h,teacher,{action:'importRoster',students:[{id:1,name:'Private Student',schoolId:'10001'},{id:2,name:'Another Private',schoolId:'10002'}]}).error,undefined);
 const student=signIn(h,'10001','10001');
 assert.ok(action(h,student,{action:'deposit',amount:100,note:'cash'}).error);
 assert.ok(action(h,student,{action:'buy',studentId:2,itemId:'shirt-mint'}).error);
 assert.equal(action(h,teacher,{action:'merit',amount:100,note:'help'}).error,undefined);
 assert.equal(action(h,teacher,{action:'deposit',amount:100.25,note:'cash'}).error,undefined);
 assert.equal(action(h,teacher,{action:'withdraw',amount:25.1,note:'cash'}).error,undefined);
 const purchase={action:'buy',studentId:1,itemId:'hat-cap',requestId:'repeated-purchase'};
 assert.equal(call(h,'/api/action',purchase,student).error,undefined);assert.equal(call(h,'/api/action',purchase,student).error,undefined);
 assert.ok(action(h,student,{action:'buy',itemId:'hat-cap'}).error,'Duplicate ownership must not charge');
 assert.equal(action(h,teacher,{action:'attendance',date:'2026-09-15',status:'late'}).error,undefined);
 let state=call(h,'/api/state',undefined,student);
 assert.equal(state.students[0].merit,100);assert.equal(state.students[0].coins,70);assert.equal(state.students[0].savings,7515);assert.equal(state.students[1].savings,null);assert.equal(state.students[0].attendance['2026-09-15'],'late');assert.deepEqual(state.students[1].attendance,{});
 const publicState=call(h,'/api/state');for(const text of ['Private Student','10001','passwordHash','sessions','loginAttempts'])assert.ok(!JSON.stringify(publicState).includes(text));assert.deepEqual(publicState.students[0].attendance,{});assert.deepEqual(publicState.ledger,[]);
 assert.equal(call(h,'/api/password',{currentPassword:'10001',newPassword:'new-test-password'},student).error,undefined);
 assert.ok(call(h,'/api/login',{username:'10001',password:'10001'}).error);signIn(h,'10001','new-test-password');
 assert.equal(h.locked,false);
});

test('Apps Script snapshot commit survives failed flush and releases lock after errors',()=>{
 const h=setup(),teacher=signIn(h);assert.equal(action(h,teacher,{action:'deposit',amount:50,note:'cash'}).error,undefined);
 const pointer=h.props.get('ACTIVE_SNAPSHOT'),before=call(h,'/api/state',undefined,teacher).students[0].savings;
 h.failFlush();assert.ok(action(h,teacher,{action:'deposit',amount:25,note:'fail before commit'}).error);assert.equal(h.locked,false);assert.equal(h.props.get('ACTIVE_SNAPSHOT'),pointer);
 assert.equal(call(h,'/api/state',undefined,teacher).students[0].savings,before,'Uncommitted inactive snapshot must not change read balance');
 assert.equal(action(h,teacher,{action:'deposit',amount:10,note:'valid after failure'}).error,undefined);assert.equal(call(h,'/api/state',undefined,teacher).students[0].savings,6000);
 assert.ok(action(h,teacher,{action:'withdraw',amount:1000,note:'too much'}).error);assert.equal(h.locked,false);assert.equal(call(h,'/api/state',undefined,teacher).students[0].savings,6000);
 h.setLocked(true);const failed=action(h,teacher,{action:'deposit',amount:20,note:'locked'});assert.ok(failed.error);h.setLocked(false);assert.equal(call(h,'/api/state',undefined,teacher).students[0].savings,6000);
});

test('Apps Script refuses corrupt active snapshot instead of silently restoring stale financial data',()=>{
 const h=setup(),teacher=signIn(h);action(h,teacher,{action:'deposit',amount:100,note:'cash'});
 const pointer=JSON.parse(h.props.get('ACTIVE_SNAPSHOT'));const book=h.books.get(h.props.get('DB_ID'));const sheet=book.getSheetByName(pointer.slot);assert.ok(sheet,'Active snapshot names a sheet');sheet.cells[0][0]+='tampered';
 assert.ok(call(h,'/api/state',undefined,teacher).error);assert.equal(h.locked,false);
});

test('Apps Script password derivation agrees with standard PBKDF2 SHA256 test vectors',()=>{
 const h=gasHarness();
 for(const [password,salt,iterations] of [['password','salt',1],['password','salt',2],['password','salt',4096],['a'.repeat(100),'salt',2],['รหัสผ่าน','เกลือ',2]]){
  const p=Array.from(Buffer.from(password)),s=Array.from(Buffer.from(salt));
  const actual=h.run('pbkdf2_('+JSON.stringify(p)+','+JSON.stringify(s)+','+iterations+')');
  assert.equal(Buffer.from(actual).toString('hex'),pbkdf2Sync(password,salt,iterations,32,'sha256').toString('hex'));
 }
});

test('Apps Script audit reverses money once, rejects cross-account and retains persistence',()=>{
 const h=setup(),teacher=signIn(h);const pointerBefore=h.props.get('ACTIVE_SNAPSHOT');assert.throws(()=>h.run('setupClassroom_()'));assert.equal(h.props.get('ACTIVE_SNAPSHOT'),pointerBefore);assert.equal(h.locked,false);
 action(h,teacher,{action:'deposit',amount:100,note:'mistaken cash'});let state=call(h,'/api/state',undefined,teacher);const entry=state.ledger.find(e=>e.action==='deposit');assert.equal(entry.moneyDeltaSatang,10000);
 assert.ok(action(h,teacher,{action:'reverseMoney',studentId:2,entryId:entry.id,note:'wrong account'}).error);
 assert.equal(action(h,teacher,{action:'reverseMoney',entryId:entry.id,note:'corrected cash'}).error,undefined);
 assert.ok(action(h,teacher,{action:'reverseMoney',entryId:entry.id,note:'retry with new ID'}).error);
 state=call(h,'/api/state',undefined,teacher);assert.equal(state.students[0].savings,0);assert.equal(state.ledger.filter(e=>e.reversesEntryId===entry.id).length,1);assert.ok(state.ledger.some(e=>e.id===entry.id&&e.action==='deposit'));
});
