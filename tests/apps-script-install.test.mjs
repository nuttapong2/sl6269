import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('one-file installer serves the complete template with the deployed NFC URL',()=>{
 const source=readFileSync(new URL('../apps-script/Install.gs',import.meta.url),'utf8');
 let actual;
 const context={HtmlService:{createTemplate(html){const template={evaluate(){actual={html,config:JSON.parse(this.configJson)};return {setTitle(){return this},addMetaTag(){return this}}}};return template}},ScriptApp:{getService:()=>({getUrl:()=> 'https://script.google.com/macros/s/deployment/exec'})}};
 vm.createContext(context);vm.runInContext(source,context);context.doGet({parameter:{student:'37'}});
 assert.equal(actual.config.initialStudent,37);assert.equal(actual.config.publicUrl,'https://script.google.com/macros/s/deployment/exec');
 assert.ok(actual.html.includes('google.script.run'));assert.ok(actual.html.includes('<style>'));assert.ok(!actual.html.includes('src="./app.js"'));
 const script=actual.html.match(/<script>([\s\S]*?)<\/script>/)[1].replace('<?!= configJson ?>',JSON.stringify(actual.config));assert.doesNotThrow(()=>new vm.Script(script));
 assert.deepEqual(Object.keys(context).filter(key=>typeof context[key]==='function'&&!key.endsWith('_')).sort(),['dispatchClient','doGet']);
});