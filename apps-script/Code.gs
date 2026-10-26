/** Free Apps Script/Sheets backend. Browser may call only doGet and dispatchClient. */
function doGet(e) {
 var template=HtmlService.createTemplateFromFile('Index'),id=Number(e&&e.parameter&&e.parameter.student);
 template.configJson=JSON.stringify({apiBase:'apps-script',publicUrl:ScriptApp.getService().getUrl(),initialStudent:Number.isSafeInteger(id)&&id>0?id:1}).replace(/</g,'\\u003c');
 return template.evaluate().setTitle('ห้องของเรา ป.6/2').addMetaTag('viewport','width=device-width, initial-scale=1');
}
/** Run only from editor after adding private ADMIN_PASSWORD in Script Properties. */
function setupClassroom_() {
 var lock=LockService.getScriptLock();lock.waitLock(30000);
 try {
  var props=PropertiesService.getScriptProperties();
  if(props.getProperty('DB_ID')||props.getProperty('ACTIVE_SNAPSHOT'))throw Error('Already configured; setup never overwrites existing data.');
  var password=props.getProperty('ADMIN_PASSWORD');
  if(!password||password.length<8||password.length>200)throw Error('Set ADMIN_PASSWORD (8 to 200 characters) in Script Properties, then run setupClassroom_.');
  props.setProperty('PEPPER',Utilities.getUuid()+Utilities.getUuid());
  props.setProperty('ADMIN_PASSWORD_HASH',hashPassword_(password));
  props.setProperty('ADMIN_USERNAME',props.getProperty('ADMIN_USERNAME')||'krutoey');
  var db=SpreadsheetApp.create('SL6269 Classroom — private data');
  db.insertSheet('state_a');db.insertSheet('state_b');props.setProperty('DB_ID',db.getId());
  writeState_({students:Array.from({length:37},function(_,i){return blankStudent_(i+1);}),sessions:[],loginAttempts:{},ledger:[],requests:[],catalogOverrides:[]});
  props.deleteProperty('ADMIN_PASSWORD');return {ok:true,spreadsheetId:db.getId()};
 } finally {lock.releaseLock();}
}
function blankStudent_(id){return {id:id,name:'นักเรียนเลขที่ '+id,schoolId:'',merit:0,coins:0,savings:0,equipped:{},owned:[],attendance:{},duty:{}};}

function dispatchClient(request) {
 var lock=LockService.getScriptLock(),acquired=false;
 try {
  if(!request||typeof request!=='object'||Array.isArray(request))throw Error('Invalid request');
  if(Utilities.newBlob(JSON.stringify(request)).getBytes().length>256000)throw Error('Request too large');
  if(!['/api/state','/api/login','/api/password','/api/action'].includes(request.path))throw Error('Not found');
  lock.waitLock(30000);acquired=true;
  var state=readState_(),now=Date.now();state.sessions=state.sessions.filter(function(s){return s.expires>now;});
  var token=typeof request.token==='string'?request.token:'',tokenHash=/^[A-Za-z0-9-]{20,200}$/.test(token)?digest_(token):'';
  var principal=state.sessions.find(function(s){return s.hash===tokenHash;})||null;
  if(request.path==='/api/state')return serializeState_(state,principal);
  var input=request.body;
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid request body');
  if(request.path==='/api/login')return login_(state,principal,input,now);
  if(!principal)throw Error('Sign in required');
  if(request.path==='/api/password') {
   if(principal.role!=='student')throw Error('Student account required');
   var student=state.students.find(function(s){return s.id===principal.studentId;});
   if(typeof input.currentPassword!=='string'||typeof input.newPassword!=='string'||input.newPassword.length<6||input.newPassword.length>200)throw Error('New password must contain 6 to 200 characters');
   if(!studentPasswordMatches_(student,input.currentPassword))throw Error('Current password is incorrect');
   student.passwordHash=hashPassword_(input.newPassword);
   state.sessions=state.sessions.filter(function(s){return s.studentId!==student.id||s.hash===principal.hash;});
   writeState_(state);return {ok:true};
  }
  return action_(state,principal,input);
 } catch(error){return {error:String(error&&error.message||'Request failed')};}
 finally {if(acquired)lock.releaseLock();}
}
function login_(state,principal,input,now) {
 if(input.action==='logout'){if(principal)state.sessions=state.sessions.filter(function(s){return s.hash!==principal.hash;});writeState_(state);return {ok:true};}
 var username=input.username,password=input.password;
 if(typeof username!=='string'||typeof password!=='string'||username.length>100||password.length>200)throw Error('Invalid credentials');
 var props=PropertiesService.getScriptProperties(),teacher=username===props.getProperty('ADMIN_USERNAME');
 var student=state.students.find(function(s){return s.schoolId&&s.schoolId===username;});
 if(!teacher&&!student)throw Error('Invalid credentials');
 var key=teacher?'teacher':'student:'+student.id,attempts=state.loginAttempts[key]||{count:0,since:now};
 if(attempts.lockedUntil>now)throw Error('Account locked. Try again in 15 minutes.');
 var valid=teacher?verifyPassword_(password,props.getProperty('ADMIN_PASSWORD_HASH')):studentPasswordMatches_(student,password);
 if(!valid){
  if(now-attempts.since>=900000){attempts.count=0;attempts.since=now;}
  attempts.count++;if(attempts.count>=5)attempts.lockedUntil=now+900000;
  state.loginAttempts[key]=attempts;writeState_(state);throw Error('Invalid credentials');
 }
 delete state.loginAttempts[key];
 var token=Utilities.getUuid()+Utilities.getUuid(),studentId=teacher?null:student.id,role=teacher?'teacher':'student';
 state.sessions=state.sessions.filter(function(s){return !(s.role===role&&s.studentId===studentId);});
 state.sessions.push({hash:digest_(token),role:role,studentId:studentId,expires:now+86400000});
 writeState_(state);return {ok:true,token:token,teacher:teacher,studentId:studentId};
}
function studentPasswordMatches_(student,password){return !!student&&!!student.schoolId&&(student.passwordHash?verifyPassword_(password,student.passwordHash):constantEqual_(digest_(password),digest_(student.schoolId)));}

function action_(state,principal,input) {
 if(principal.role!=='teacher'&&!(Number(input.studentId)===principal.studentId&&['buy','equip'].includes(input.action)))throw Error('Not authorized');
 if(typeof input.requestId!=='string'||input.requestId.length<8||input.requestId.length>100)throw Error('Request ID required');
 var key=(principal.role==='teacher'?'teacher':'student:'+principal.studentId)+':'+input.requestId;
 if(state.requests.includes(key))return {ok:true};
 if(input.action==='upsertItem'){
  var item=ClassroomCore_.upsertItem(state,input.item);
  state.ledger.unshift({id:Utilities.getUuid(),action:'upsertItem',detail:'Updated product '+item.id,at:new Date().toISOString(),actor:'teacher'});
 } else if(input.action==='importRoster'){
  importRoster_(state,input.students);
  state.ledger.unshift({id:Utilities.getUuid(),action:'importRoster',detail:'Imported roster',at:new Date().toISOString(),actor:'teacher'});
 } else if(input.action==='duty'){
  var student=state.students.find(function(s){return s.id===Number(input.studentId);});
  var date=input.date===undefined?Utilities.formatDate(new Date(),'Asia/Bangkok','yyyy-MM-dd'):input.date;
  if(!student||typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(new Date(date+'T00:00:00Z').getTime())||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date||![5,-5].includes(input.amount))throw Error('Duty requires a valid date and amount +5 or -5');
  student.duty=student.duty||{};
  var desired=input.amount,raw=student.duty[date],previous=typeof raw==='number'?raw:raw===true?5:0;
  if(desired!==previous){
   var delta=desired-previous,coinDelta=(desired===5?5:0)-(previous===5?5:0);
   if(student.merit+delta<0||student.coins+coinDelta<0||!Number.isSafeInteger(student.merit+delta)||!Number.isSafeInteger(student.coins+coinDelta))throw Error('Insufficient merit or coins to correct duty');
   student.merit+=delta;student.coins+=coinDelta;student.duty[date]=desired;
   state.ledger.unshift({id:Utilities.getUuid(),studentId:student.id,action:'duty',detail:'Duty '+date+' '+desired+' (change '+delta+')',note:String(input.note||'').slice(0,180),at:new Date().toISOString(),actor:'teacher'});
  }
 } else {
  ClassroomCore_.applyAction(state,input,principal.role==='teacher'?'teacher':'student:'+principal.studentId);
  if(['resetStudentPassword','setSchoolId'].includes(input.action))delete state.loginAttempts['student:'+Number(input.studentId)];
 }
 state.requests.push(key);state.requests=state.requests.slice(-10000);
 writeState_(state);return {ok:true};
}
function importRoster_(state,students){
 if(!Array.isArray(students)||!students.length||students.length>100)throw Error('Provide 1 to 100 students');
 var ids=new Set(),schoolIds=new Set();
 var rows=students.map(function(x){
  var id=Number(x.id),name=String(x.name||'').trim(),schoolId=String(x.schoolId||'').trim();
  if(!Number.isSafeInteger(id)||id<1||id>100||ids.has(id)||!name||name.length>100||(schoolId&&!/^\d{3,20}$/.test(schoolId))||(schoolId&&schoolIds.has(schoolId)))throw Error('Invalid or duplicate roster entry');
  ids.add(id);if(schoolId)schoolIds.add(schoolId);return {id:id,name:name,schoolId:schoolId};
 });
 rows.forEach(function(x){if(state.students.some(function(s){return !ids.has(s.id)&&x.schoolId&&s.schoolId===x.schoolId;}))throw Error('School ID already in use');});
 rows.forEach(function(x){
  var s=state.students.find(function(s){return s.id===x.id;});if(!s){s=blankStudent_(x.id);state.students.push(s);}
  if(s.schoolId!==x.schoolId){delete s.passwordHash;state.sessions=state.sessions.filter(function(a){return a.studentId!==s.id;});delete state.loginAttempts['student:'+s.id];}
  Object.assign(s,x);
 });state.students.sort(function(a,b){return a.id-b.id;});
}
function serializeState_(state,principal){
 var teacher=!!principal&&principal.role==='teacher',studentId=principal&&principal.studentId||null;
 return {teacher:teacher,studentId:studentId,catalog:ClassroomCore_.getCatalog(state),students:state.students.map(function(s){
  var own=teacher||studentId===s.id,row={id:s.id,name:own?s.name:'นักเรียนเลขที่ '+s.id,merit:s.merit,coins:s.coins,savings:own?s.savings:null,equipped:s.equipped,owned:s.owned,attendance:own?s.attendance:{},duty:own?s.duty||{}:{}};
  if(teacher)row.schoolId=s.schoolId;return row;
 }),ledger:teacher?state.ledger:studentId?state.ledger.filter(function(e){return e.studentId===studentId;}):[]};
}

/** Complete new slot and verify before committing the single active-pointer property. */
function writeState_(state){
 var props=PropertiesService.getScriptProperties(),dbId=props.getProperty('DB_ID');
 if(!dbId)throw Error('Classroom is not configured. Run setupClassroom_ from the editor.');
 var previous=props.getProperty('ACTIVE_SNAPSHOT'),active=previous?parseManifest_(previous):null;
 var slot=active&&active.slot==='state_a'?'state_b':'state_a',revision=(active?active.revision:0)+1;
 var json=JSON.stringify(state),chunks=[];
 for(var i=0;i<json.length;){var end=Math.min(i+30000,json.length);if(end<json.length&&json.charCodeAt(end-1)>=55296&&json.charCodeAt(end-1)<=56319)end--;chunks.push(['json:'+json.slice(i,end)]);i=end;}
 var sheet=SpreadsheetApp.openById(dbId).getSheetByName(slot);
 if(!sheet)throw Error('Missing snapshot sheet; refusing to reset data.');
 if(sheet.getMaxRows()<chunks.length)sheet.insertRowsAfter(sheet.getMaxRows(),chunks.length-sheet.getMaxRows());
 sheet.clearContents();
 var range=sheet.getRange(1,1,chunks.length,1);range.setNumberFormat('@');range.setValues(chunks);SpreadsheetApp.flush();
 var written=readChunks_(sheet,chunks.length);
 if(written!==json)throw Error('Snapshot write did not verify; previous data remains active.');
 props.setProperty('ACTIVE_SNAPSHOT',JSON.stringify({slot:slot,revision:revision,count:chunks.length,hash:digest_(json)}));
}
function readChunks_(sheet,count){return sheet.getRange(1,1,count,1).getValues().map(function(row){var value=String(row[0]);if(value.slice(0,5)!=='json:')throw Error('Invalid snapshot chunk; refusing to reset data.');return value.slice(5);}).join('');}
function parseManifest_(text){
 var m;try{m=JSON.parse(text);}catch(e){throw Error('Invalid data pointer; refusing to reset data.');}
 if(!m||!['state_a','state_b'].includes(m.slot)||!Number.isSafeInteger(m.count)||m.count<1||m.count>10000||!Number.isSafeInteger(m.revision)||m.revision<1||!/^[0-9a-f]{64}$/.test(m.hash))throw Error('Invalid data pointer; refusing to reset data.');
 return m;
}
function readState_(){
 var props=PropertiesService.getScriptProperties(),dbId=props.getProperty('DB_ID'),text=props.getProperty('ACTIVE_SNAPSHOT');
 if(!dbId||!text)throw Error('Classroom is not configured. Run setupClassroom_ from the editor.');
 var m=parseManifest_(text),sheet=SpreadsheetApp.openById(dbId).getSheetByName(m.slot);
 if(!sheet)throw Error('Missing snapshot sheet; refusing to reset data.');
 var json=readChunks_(sheet,m.count);
 if(digest_(json)!==m.hash)throw Error('Stored data checksum failed. Stop using the app and restore a verified copy.');
 var state;try{state=JSON.parse(json);}catch(e){throw Error('Stored data is damaged; refusing to reset data.');}
 if(!state||!Array.isArray(state.students)||!Array.isArray(state.sessions)||!Array.isArray(state.requests)||!Array.isArray(state.ledger)||!state.loginAttempts)throw Error('Stored data schema is invalid; refusing to reset data.');
 return state;
}
function hex_(bytes){return bytes.map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('');}
function utf8_(text){var encoded=unescape(encodeURIComponent(text));return Array.from(encoded,function(c){return c.charCodeAt(0);});}
function digest_(text){return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(text),Utilities.Charset.UTF_8));}
function constantEqual_(a,b){a=String(a||'');b=String(b||'');var diff=a.length^b.length;for(var i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;}

/** PBKDF2-SHA256 20,000 rounds with random salt and separately stored server pepper. */
function hashPassword_(password,salt){
 salt=salt||Utilities.getUuid();
 var pepper=PropertiesService.getScriptProperties().getProperty('PEPPER');if(!pepper)throw Error('Password pepper missing');
 var key=Utilities.computeHmacSha256Signature(password,pepper,Utilities.Charset.UTF_8).map(function(b){return b&255;});
 return 'p2$20000$'+salt+'$'+hex_(pbkdf2_(key,utf8_(salt),20000));
}
function verifyPassword_(password,stored){var parts=String(stored||'').split('$');return parts.length===4&&parts[0]==='p2'&&parts[1]==='20000'&&/^[0-9a-f]{64}$/.test(parts[3])&&constantEqual_(hashPassword_(password,parts[2]),stored);}
function pbkdf2_(key,salt,rounds){
 if(!Number.isSafeInteger(rounds)||rounds<1)throw Error('Invalid KDF rounds');
 if(key.length>64)key=sha256Bytes_(key);
 var ipad=[],opad=[];for(var i=0;i<64;i++){ipad[i]=(key[i]||0)^54;opad[i]=(key[i]||0)^92;}
 var hmac=function(msg){return sha256Bytes_(opad.concat(sha256Bytes_(ipad.concat(msg))));};
 var u=hmac(salt.concat([0,0,0,1])),out=u.slice();
 for(var j=1;j<rounds;j++){u=hmac(u);for(i=0;i<32;i++)out[i]^=u[i];}return out;
}
function sha256Bytes_(input){
 var k=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298];
 var h=[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225],bytes=input.slice(),bits=bytes.length*8;
 bytes.push(128);while(bytes.length%64!==56)bytes.push(0);
 var hi=Math.floor(bits/4294967296),lo=bits>>>0;bytes.push((hi>>>24)&255,(hi>>>16)&255,(hi>>>8)&255,hi&255,(lo>>>24)&255,(lo>>>16)&255,(lo>>>8)&255,lo&255);
 var r=function(x,n){return (x>>>n)|(x<<(32-n));};
 for(var offset=0;offset<bytes.length;offset+=64){
  var w=[];for(var i=0;i<16;i++)w[i]=(bytes[offset+4*i]<<24)|(bytes[offset+4*i+1]<<16)|(bytes[offset+4*i+2]<<8)|bytes[offset+4*i+3];
  for(i=16;i<64;i++){var x=w[i-15],y=w[i-2];w[i]=(w[i-16]+(r(x,7)^r(x,18)^(x>>>3))+w[i-7]+(r(y,17)^r(y,19)^(y>>>10)))|0;}
  var a=h[0],b=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],hh=h[7];
  for(i=0;i<64;i++){var t1=(hh+(r(e,6)^r(e,11)^r(e,25))+((e&f)^(~e&g))+k[i]+w[i])|0,t2=((r(a,2)^r(a,13)^r(a,22))+((a&b)^(a&c)^(b&c)))|0;hh=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;}
  h[0]=(h[0]+a)|0;h[1]=(h[1]+b)|0;h[2]=(h[2]+c)|0;h[3]=(h[3]+d)|0;h[4]=(h[4]+e)|0;h[5]=(h[5]+f)|0;h[6]=(h[6]+g)|0;h[7]=(h[7]+hh)|0;
 }
 var output=[];h.forEach(function(x){output.push((x>>>24)&255,(x>>>16)&255,(x>>>8)&255,x&255);});return output;
}
