import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const files=['index.html','app.js','styles.css','config.js','assets/avatar.js'];
for(const file of files){await mkdir(dirname(resolve(root,'_site',file)),{recursive:true});await copyFile(resolve(root,file),resolve(root,'_site',file));}
const backend=process.env.API_BASE_URL?.trim();
if(backend){const url=new URL(backend);if(url.protocol!=='https:')throw Error('API_BASE_URL must use HTTPS');await writeFile(resolve(root,'_site/config.js'),'export const config = '+JSON.stringify({apiBase:url.origin})+';\n');}
await writeFile(resolve(root,'_site/.nojekyll'),'');
const html=await readFile(resolve(root,'_site/index.html'),'utf8');
if(/(?:src|href)=["']\/(?!\/)/.test(html))throw Error('Pages assets must use relative URLs');
console.log('Built _site using an explicit public-file allowlist.');
