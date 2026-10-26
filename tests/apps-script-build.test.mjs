import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const build=()=>execFileSync(process.execPath,['scripts/build-apps-script.mjs'],{cwd:root});
build();

test('Apps Script build is deterministic, standalone and contains no Node browser dependencies',()=>{
 const first=[read('apps-script/Index.html'),read('apps-script/Core.gs')];build();
 assert.deepEqual([read('apps-script/Index.html'),read('apps-script/Core.gs')],first);
 const [html,core]=first;
 assert.ok(html.includes('<base target="_top">'));
 assert.equal((html.match(/<script>/g)||[]).length,1);
 assert.ok(!/\bfetch\s*\(/.test(html));assert.ok(!/\bBuffer\b|crypto\.randomUUID/.test(core));
 assert.ok(!html.includes('065837228'));assert.ok(!core.includes('065837228'));
 assert.ok(core.includes('const ClassroomCore_=(function()'));
 new vm.Script(core);new vm.Script(html.match(/<script>([\s\S]*)<\/script>/)[1].replace('<?!= configJson ?>','{}'));
});

test('Apps Script iframe boots NFC student, uses RPC authentication and exports deployed NFC URLs',async()=>{
 let html='',signedIn=false,copied='';const calls=[];
 const publicUrl='https://script.google.com/macros/s/example-deployment/exec';
 const config={apiBase:'apps-script',publicUrl,initialStudent:4};
 const rows=()=>Array.from({length:37},(_,i)=>({id:i+1,name:signedIn&&i===3?'Private Owner':'Student '+(i+1),merit:10,coins:10,savings:signedIn&&i===3?12345:null,owned:[],equipped:{},attendance:signedIn&&i===3?{'2026-10-01':'present'}:{},duty:{}}));
 let success,failure;
 const runner={withSuccessHandler(fn){success=fn;return this},withFailureHandler(fn){failure=fn;return this},dispatchClient(request){calls.push(request);try{if(request.path==='/api/login'){signedIn=true;success({ok:true,token:'owner-token',teacher:false,studentId:4});return}success({students:rows(),teacher:false,studentId:signedIn?4:null,ledger:[]})}catch(error){failure(error)}}};
 const context={console,window:{},google:{script:{run:runner}},document:{querySelector(selector){if(selector==='#app')return {set innerHTML(value){html=value}};return {value:selector==='#username'?'10004':selector==='#password'?'10004':''}}},location:{href:'https://iframe.example.test/userCodeAppPanel',search:''},history:{replaceState(){}},navigator:{clipboard:{async writeText(value){copied=value}}},URL,URLSearchParams,Blob,crypto:webcrypto,confirm:()=>true,prompt:()=>null,localStorage:{getItem(){throw Error('Production cannot read demo data')},setItem(){throw Error('Production cannot write demo data')}}};
 vm.createContext(context);
 const script=read('apps-script/Index.html').match(/<script>([\s\S]*)<\/script>/)[1].replace('<?!= configJson ?>',JSON.stringify(config));vm.runInContext(script,context);
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.ok(html.includes('Student 4'));assert.ok(!html.includes('Private Owner'));
 assert.equal(calls[0].path,'/api/state');assert.equal(calls[0].token,'');assert.equal(calls[0].body,null);
 await context.window.submitLogin({preventDefault(){}});
 assert.equal(calls.at(-1).token,'owner-token');assert.ok(html.includes('Private Owner'));assert.ok(html.includes('123.45'));
 await context.window.copyProfile();assert.equal(copied,publicUrl+'?student=4');
 context.window.setTab('history');assert.ok(html.includes('2026-10-01'));assert.ok(!html.includes('CSV / NFC'),'Students do not receive teacher exports');
 context.window.openStudent(5);assert.ok(!html.includes('123.45'),'Other profiles cannot show owner savings');
 // CSV URLs are generated from deployment config rather than the iframe address.
 assert.ok(read('apps-script/Index.html').includes('const url=new URL(config.publicUrl||location.href)'));
});
