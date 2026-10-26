const bytes=new TextEncoder();
const hex=(a            )=>Array.from(new Uint8Array(a)).map(x=>x.toString(16).padStart(2,'0')).join('');
export async function digest(v       ){return hex(await crypto.subtle.digest('SHA-256',bytes.encode(v)));}
export async function passwordHash(password       ,salt=crypto.randomUUID()){
 const key=await crypto.subtle.importKey('raw',bytes.encode(password),'PBKDF2',false,['deriveBits']);
 const result=await crypto.subtle.deriveBits({name:'PBKDF2',salt:bytes.encode(salt),iterations:100000,hash:'SHA-256'},key,256);
 return salt+':'+hex(result);
}
export async function verify(password       ,stored       ){const salt=stored.split(':')[0];return await passwordHash(password,salt)===stored;}
