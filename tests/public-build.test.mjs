import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
test('Pages build publishes only frontend assets and uses project-relative links',async()=>{
 const r=spawnSync(process.execPath,['scripts/build-pages.mjs'],{cwd:resolve(import.meta.dirname,'..'),encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 const root=resolve(import.meta.dirname,'../_site');let files=[];async function walk(path,prefix=''){for(const e of await readdir(path,{withFileTypes:true})){if(e.isDirectory())await walk(resolve(path,e.name),prefix+e.name+'/');else files.push(prefix+e.name);}}await walk(root);
 assert.deepEqual(files.sort(),['.nojekyll','app.js','assets/avatar.js','config.js','index.html','styles.css']);
 const html=await readFile(resolve(root,'index.html'),'utf8');assert.doesNotMatch(html,/(?:src|href)=["']\/(?!\/)/);
 const source=(await Promise.all(files.map(f=>readFile(resolve(root,f),'utf8')))).join('');assert.doesNotMatch(source,/passwordHash|schoolId"\s*:\s*"\d+|ADMIN_PASSWORD\s*[:=]\s*["'][^"']+["']/);
});

