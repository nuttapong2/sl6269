import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {catalog} from '../assets/avatar.js';
import {applyAction} from './business.mjs';
import {digest,passwordHash,verify} from './crypto.mjs';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const blank=id=>({id,name:'Student '+id,schoolId:'',merit:0,coins:0,savings:0,equipped:{},owned:[],attendance:{},duty:{}});
export function importRoster(state,students){
 if(!Array.isArray(students)||!students.length||students.length>100)throw fail('Provide 1 to 100 students');
 const ids=new Set(),schoolIds=new Set();
 const validated=students.map(x=>{const id=Number(x.id),name=String(x.name||'').trim(),schoolId=String(x.schoolId||'').trim();
 if(!Number.isSafeInteger(id)||id<1||id>100||ids.has(id)||!name||name.length>100||(schoolId&&!/^\d{3,20}$/.test(schoolId))||(schoolId&&schoolIds.has(schoolId)))throw fail('Invalid or duplicate roster entry');ids.add(id);if(schoolId)schoolIds.add(schoolId);return {id,name,schoolId};});
 for(const x of validated)if(state.students.some(s=>!ids.has(s.id)&&x.schoolId&&s.schoolId===x.schoolId))throw fail('School ID already in use');
 for(const x of validated){let s=state.students.find(s=>s.id===x.id);if(!s){s=blank(x.id);state.students.push(s);}if(s.schoolId!==x.schoolId){delete s.passwordHash;state.sessions=state.sessions.filter(a=>a.studentId!==s.id);}Object.assign(s,x);}state.students.sort((a,b)=>a.id-b.id);
}
export function serialize(state,p){const teacher=p?.role==='teacher',studentId=p?.studentId||null;return {teacher,studentId,catalog,students:state.students.map(s=>({id:s.id,name:teacher||studentId===s.id?s.name:'Student '+s.id,schoolId:teacher?s.schoolId:undefined,merit:s.merit,coins:s.coins,savings:teacher||studentId===s.id?s.savings:null,equipped:s.equipped,owned:s.owned,attendance:teacher||studentId===s.id?s.attendance:{},duty:teacher||studentId===s.id?s.duty||{}:{}})),ledger:teacher?state.ledger:[]};}
export function createApp(options={}){
 const adminUsername=options.adminUsername||process.env.ADMIN_USERNAME||'krutoey',adminPassword=options.adminPassword||process.env.ADMIN_PASSWORD;
 if(!adminPassword||adminPassword.length<8)throw Error('ADMIN_PASSWORD required (at least 8 characters)');
 const frontendOrigin=options.frontendOrigin||process.env.FRONTEND_ORIGIN;if(!frontendOrigin||new URL(frontendOrigin).origin!==frontendOrigin)throw Error('FRONTEND_ORIGIN must be an exact origin without trailing slash');
 const dataDir=options.dataDir||process.env.DATA_DIR||path.join(process.cwd(),'private-data');mkdirSync(dataDir,{recursive:true});
 const db=new DatabaseSync(path.join(dataDir,'classroom.sqlite'));db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS classroom (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL)');
 const initial={students:Array.from({length:37},(_,i)=>blank(i+1)),sessions:[],loginAttempts:{},ledger:[],requests:[]};const rosterFile=options.rosterFile||process.env.ROSTER_FILE;if(rosterFile)importRoster(initial,JSON.parse(readFileSync(rosterFile,'utf8')));
 db.prepare('INSERT OR IGNORE INTO classroom(id,data) VALUES(1,?)').run(JSON.stringify(initial));let queue=Promise.resolve();const adminHash=passwordHash(adminPassword);
 const exclusive=fn=>{const task=queue.then(fn);queue=task.catch(()=>{});return task;};const read=()=>JSON.parse(db.prepare('SELECT data FROM classroom WHERE id=1').get().data);const save=state=>db.prepare('UPDATE classroom SET data=?,revision=revision+1 WHERE id=1').run(JSON.stringify(state));
 const principal=async(req,state)=>{const token=req.headers.authorization?.match(/^Bearer ([A-Za-z0-9-]{20,200})$/)?.[1];if(!token)return null;const hash=await digest(token);return state.sessions.find(s=>s.hash===hash&&s.expires>Date.now())||null;};
 const selfOrigin=options.backendOrigin||process.env.PUBLIC_ORIGIN||process.env.RENDER_EXTERNAL_URL;
 const publicRoot=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
 const staticFiles={'/':['index.html','text/html; charset=utf-8'],'/index.html':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/styles.css':['styles.css','text/css; charset=utf-8'],'/assets/avatar.js':['assets/avatar.js','text/javascript; charset=utf-8']};
 const server=http.createServer(async(req,res)=>{
 const origin=req.headers.origin,headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
 if(origin&&(origin===frontendOrigin||origin===selfOrigin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization'});
 const send=(status,value)=>{res.writeHead(status,headers);res.end(JSON.stringify(value));};if(origin&&origin!==frontendOrigin&&origin!==selfOrigin)return send(403,{error:'Origin not allowed'});if(req.method==='OPTIONS'){res.writeHead(204,headers);return res.end();}
 try{const url=new URL(req.url,'http://localhost');
 if(req.method==='GET'&&url.pathname==='/config.js'){res.writeHead(200,{...headers,'Content-Type':'text/javascript; charset=utf-8'});return res.end('export const config = {apiBase: globalThis.location.origin};');}
 if(req.method==='GET'&&staticFiles[url.pathname]){const [file,mime]=staticFiles[url.pathname];res.writeHead(200,{...headers,'Content-Type':mime});return res.end(readFileSync(path.join(publicRoot,file)));}
if(url.pathname==='/health'&&req.method==='GET')return send(200,{ok:true});let input={};if(req.method==='POST'){req.setEncoding('utf8');let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>128000)throw fail('Request too large',413);}try{input=JSON.parse(body);}catch{throw fail('Invalid JSON');}if(!input||typeof input!=='object'||Array.isArray(input))throw fail('Invalid request');}
 const result=await exclusive(async()=>{const state=read(),now=Date.now();state.sessions=state.sessions.filter(s=>s.expires>now);const p=await principal(req,state);
 if(url.pathname==='/api/state'&&req.method==='GET')return serialize(state,p);
 if(url.pathname==='/api/login'&&req.method==='POST'){
 if(input.action==='logout'){if(p)state.sessions=state.sessions.filter(s=>s.hash!==p.hash);save(state);return {ok:true};}
 const {username,password}=input;if(typeof username!=='string'||typeof password!=='string'||username.length>100||password.length>200)throw fail('Invalid credentials',401);const student=state.students.find(s=>s.schoolId&&s.schoolId===username),teacher=username===adminUsername;if(!teacher&&!student)throw fail('Invalid credentials',401);
 const key=teacher?'teacher':'student:'+student.id,attempts=state.loginAttempts[key]||{count:0,since:now};if(attempts.lockedUntil>now)throw fail('Account locked. Try again in 15 minutes.',429);
 const valid=teacher?await verify(password,await adminHash):student.passwordHash?await verify(password,student.passwordHash):(await digest(password))===(await digest(student.schoolId));
 if(!valid){if(now-attempts.since>=900000){attempts.count=0;attempts.since=now;}attempts.count++;if(attempts.count>=5)attempts.lockedUntil=now+900000;state.loginAttempts[key]=attempts;save(state);throw fail('Invalid credentials',401);}delete state.loginAttempts[key];const token=crypto.randomUUID()+crypto.randomUUID();state.sessions=state.sessions.filter(s=>!(s.role===(teacher?'teacher':'student')&&s.studentId===(teacher?null:student.id)));state.sessions.push({hash:await digest(token),role:teacher?'teacher':'student',studentId:teacher?null:student.id,expires:now+86400000});save(state);return {ok:true,token,teacher,studentId:teacher?null:student.id};}
 if(!p)throw fail('Sign in required',401);
 if(url.pathname==='/api/password'&&req.method==='POST'){if(p.role!=='student')throw fail('Student account required',403);const s=state.students.find(x=>x.id===p.studentId);if(typeof input.currentPassword!=='string'||typeof input.newPassword!=='string'||input.newPassword.length<6||input.newPassword.length>200)throw fail('New password must contain 6 to 200 characters');const correct=s.passwordHash?await verify(input.currentPassword,s.passwordHash):input.currentPassword===s.schoolId;if(!correct)throw fail('Current password is incorrect',403);s.passwordHash=await passwordHash(input.newPassword);state.sessions=state.sessions.filter(x=>x.studentId!==s.id||x.hash===p.hash);save(state);return {ok:true};}
 if(url.pathname==='/api/action'&&req.method==='POST'){
 if(p.role!=='teacher'&&!(Number(input.studentId)===p.studentId&&['buy','equip'].includes(input.action)))throw fail('Not authorized',403);if(typeof input.requestId!=='string'||input.requestId.length<8||input.requestId.length>100)throw fail('Request ID required');const key=(p.role==='teacher'?'teacher':'student:'+p.studentId)+':'+input.requestId;if(state.requests.includes(key))return {ok:true};
 if(input.action==='importRoster'){importRoster(state,input.students);state.ledger.unshift({id:crypto.randomUUID(),action:'importRoster',detail:'Imported roster',at:new Date().toISOString(),actor:'teacher'});}
 else if(input.action==='duty'){const s=state.students.find(x=>x.id===Number(input.studentId)),date=input.date||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok'}).format(new Date());if(!s||!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date||![5,-5].includes(input.amount))throw fail('Duty requires date and amount +5 or -5');s.duty||={};const desired=input.amount,raw=s.duty[date],previous=typeof raw==='number'?raw:raw===true?5:0;if(desired!==previous){const delta=desired-previous,coinDelta=(desired===5?5:0)-(previous===5?5:0);if(s.merit+delta<0||s.coins+coinDelta<0)throw fail('Insufficient merit or coins to correct duty');if(!Number.isSafeInteger(s.merit+delta)||!Number.isSafeInteger(s.coins+coinDelta))throw fail('Balance limit exceeded');s.merit+=delta;s.coins+=coinDelta;s.duty[date]=desired;state.ledger.unshift({id:crypto.randomUUID(),studentId:s.id,action:'duty',detail:'Duty '+date+' '+(desired>0?'+':'')+desired+' (change '+delta+')',note:String(input.note||'').slice(0,180),at:new Date().toISOString(),actor:'teacher'});}}
 else{applyAction(state,input,p.role==='teacher'?'teacher':'student:'+p.studentId);if(['resetStudentPassword','setSchoolId'].includes(input.action))delete state.loginAttempts['student:'+Number(input.studentId)];}
 state.requests.push(key);state.requests=state.requests.slice(-10000);save(state);return {ok:true};}throw fail('Not found',404);});send(200,result);
 }catch(e){send(e.status||400,{error:e.message});}});
 return {server,db,close:async()=>{await new Promise(resolve=>server.close(resolve));await queue;db.close();}};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){const app=createApp();app.server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Classroom API listening'));process.on('SIGTERM',()=>app.close().then(()=>process.exit(0)));}
