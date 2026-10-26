import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8').replace(/^import .*;$/gm, '');
const avatar = readFileSync(new URL('../assets/avatar.js', import.meta.url), 'utf8').replace(/export /g, '').replace('const catalog =', 'const defaultCatalog =');
function harness({apiBase='', fetch}={}) {
  let html='';
  const storage=new Map();
  const context={
    config:{apiBase},window:{},
    document:{querySelector(selector){
      if(selector==='#app')return {set innerHTML(value){html=value}};
      return {value:selector==='#amount'?'100':selector==='#username'?'test-user':selector==='#password'?'test-password':'test note'};
    }},
    localStorage:{getItem(key){assert.equal(apiBase,'','Production must not read device demo records');return storage.get(key)||null},setItem(key,value){assert.equal(apiBase,'','Production must not persist records or tokens');storage.set(key,value)}},
    history:{replaceState(){}},location:{search:'?student=2',href:'https://example.test/sl6269/'},
    console,Blob,URL,URLSearchParams,crypto:webcrypto,confirm:()=>true,fetch,
  };
  vm.createContext(context);
  vm.runInContext(avatar+'\n'+app,context);
  return {run:source=>vm.runInContext(source,context),get html(){return html},storage};
}

test('demo preview spends nothing; purchases affect coins only and save ownership',()=>{
  const h=harness();
  h.run("teacher=true;act('merit')");
  assert.equal(h.run('current().merit'),100);
  assert.equal(h.run('current().coins'),100);
  h.run("tryItem('hat-cat')");
  assert.equal(h.run('current().coins'),100);
  assert.equal(h.run('current().owned.length'),0);
  h.run("buy('hat-cat')");
  assert.equal(h.run('current().coins'),45);
  assert.equal(h.run('current().merit'),100);
  assert.equal(h.run('current().savings'),0);
  assert.equal(h.run("current().owned.includes('hat-cat')"),true);
  assert.equal(h.run("current().equipped.hat"),'hat-cat');
  h.run("buy('hat-cat')");
  assert.equal(h.run('current().coins'),45,'Equipping an owned item cannot charge again');
  h.run("act('deposit');act('withdraw')");
  assert.equal(h.run('current().savings'),0);
  assert.equal(h.run('current().coins'),45);
  assert.ok(h.storage.has('sriloha-demo-v1'));
});

test('all five demo tabs render and generated event handlers parse',()=>{
  const h=harness();
  for(const tab of ['overview','students','shop','history','duty']){
    h.run(`teacher=true;tab='${tab}';render()`);
    assert.ok(h.html.includes('DEMO'));
    for(const [,handler] of h.html.matchAll(/(?:onclick|onsubmit|onchange)="([^"]+)"/g))assert.doesNotThrow(()=>new Function(handler));
  }
  h.run("openLogin()");
  assert.ok(h.html.includes('บัญชีทดลองไม่มีข้อมูลส่วนบุคคล'));
  assert.ok(!h.html.includes('id="password"'),'Demo must not ask for real credentials');
  assert.ok(!h.html.includes('roster-file'),'Private roster import must not appear in demo');
});

test('production uses memory bearer token, satang conversion, and no local storage',async()=>{
  let logged=false;const requests=[];
  const students=Array.from({length:37},(_,i)=>({id:i+1,name:'Student '+(i+1),merit:10,coins:10,savings:12345,owned:[],equipped:{},attendance:{}}));
  const h=harness({apiBase:'https://api.example.test',fetch:async(url,options)=>{
    requests.push({url,options});
    if(url.endsWith('/api/login')){
      const body=JSON.parse(options.body);
      logged=body.action!=='logout';
      return {ok:true,json:async()=>logged?{ok:true,token:'memory-test-token'}:{ok:true}};
    }
    return {ok:true,json:async()=>({students,ledger:[],teacher:logged,studentId:null})};
  }});
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(h.run('selected'),2);
  assert.equal(h.run('current().savings'),123.45);
  assert.ok(!requests[0].options.headers.Authorization,'Anonymous state must not invent a token');
  await h.run('submitLogin({preventDefault(){}})');
  assert.equal(requests.at(-1).options.headers.Authorization,'Bearer memory-test-token');
  assert.equal(requests.at(-1).options.credentials,'omit');
  assert.ok(h.html.includes('roster-file'));
  assert.equal(h.storage.size,0);
  await h.run('logout()');
  assert.equal(requests.at(-2).options.headers.Authorization,'Bearer memory-test-token');
  assert.equal(JSON.parse(requests.at(-2).options.body).action,'logout');
  assert.ok(!requests.at(-1).options.headers.Authorization,'Logout must clear the in-memory token');
  assert.equal(h.storage.size,0);
});

test('demo merit penalties preserve coins and reject negative merit',()=>{
  const h=harness();h.run("teacher=true;change(30);change(-20)");
  assert.equal(h.run('current().merit'),10);
  assert.equal(h.run('current().coins'),30);
  h.run('change(-11)');
  assert.equal(h.run('current().merit'),10);
  assert.equal(h.run('current().coins'),30);
});

test('demo duty repeats are idempotent and corrections reverse the prior contribution',()=>{
  const h=harness();h.run('teacher=true;dutyAward(2,5);dutyAward(2,5)');
  assert.equal(h.run('current().merit'),5);
  assert.equal(h.run('current().coins'),5);
  h.run('change(10);dutyAward(2,-5);dutyAward(2,-5)');
  assert.equal(h.run('current().merit'),5);
  assert.equal(h.run('current().coins'),10);
  h.run('dutyAward(2,5)');
  assert.equal(h.run('current().merit'),15);
  assert.equal(h.run('current().coins'),15);
  h.run('selected=3;dutyAward(3,-5)');
  assert.equal(h.run('current().merit'),0,'Reject a negative balance');
  assert.equal(h.run('current().coins'),0);
});

test('wardrobe removal preserves owned items and balances; CSV protects formulas and contains NFC links',()=>{
 const h=harness();h.run("teacher=true;change(100);buy('hat-cat');unequip('hat')");
 assert.equal(h.run('current().equipped.hat'),undefined);
 assert.equal(h.run("current().owned.includes('hat-cat')"),true);
 assert.equal(h.run('current().coins'),45);
 h.run("current().name='=HYPERLINK(\"unsafe\")'");
 const csv=h.run('csvContent()');assert.ok(csv.includes("'=HYPERLINK"));assert.ok(csv.includes('?student=2'));assert.ok(csv.includes('45'));
 h.run("current().attendance={'2026-10-01':'present','2026-10-02':'late','2026-09-01':'absent'};attendanceMonth='2026-10';tab='students';render()");
 assert.ok(h.html.includes('id="attendance-date"'));assert.ok(h.html.includes('มาเรียน 1 · มาสาย 1 · ลา 0 · ขาด 0'));
 h.run("teacher=false;studentSession=2;tab='history';render()");assert.ok(h.html.includes('2026-10-01'));assert.ok(h.html.includes('ประวัติของฉัน'));
 h.run("studentSession=3;selected=2;tab='students';render()");assert.ok(!h.html.includes('สรุปการมาเรียนรายเดือน'));
});

test('teacher catalog controls validate HTTPS, retain archived ownership, and gate money reversals',async()=>{
 const h=harness();h.run("teacher=true;tab='shop';catalog=[...catalog,{id:'hat-retired',name:'Retired Item',slot:'hat',price:12,color:'#abc123',shape:'crown',archived:true}];current().owned.push('hat-retired');render()");
 assert.ok(h.html.includes('id="item-image"'));
 assert.ok(h.html.includes('data-item="hat-retired"'),'Archived owned items remain wearable');
 assert.ok(!h.html.includes("tryItem('hat-retired')"),'Archived items are not on sale');
 assert.equal(h.run("validCatalogItem({id:'hat-new',name:'Hat',slot:'hat',price:0,color:'#abc123',shape:'crown',imageUrl:'https://example.test/hat.png'})"),true);
 assert.equal(h.run("validCatalogItem({id:'hat-new',name:'Hat',slot:'hat',price:0,color:'#abc123',shape:'crown',imageUrl:'javascript:alert(1)'})"),false);
 const p=harness({apiBase:'https://api.example.test',fetch:async()=>({ok:true,json:async()=>({students:[{id:1,name:'One',merit:0,coins:0,savings:0,equipped:{},owned:[],attendance:{}}],ledger:[],teacher:true})})});
 await new Promise(resolve=>setTimeout(resolve,0));
 p.run("ledger=[{id:'cash-1',action:'deposit',moneyDeltaSatang:10000,student:1}]");
 assert.equal(p.run('reversibleMoneyEntry(ledger[0])'),true);
 p.run("ledger.push({id:'undo-1',action:'reverseMoney',reversesEntryId:'cash-1'})");
 assert.equal(p.run('reversibleMoneyEntry(ledger[0])'),false);
 p.run('teacher=false');assert.equal(p.run('reversibleMoneyEntry(ledger[0])'),false);
});
