// Admin dashboard: open every section path with a fake admin session, API empty and API down.
//
// Flags crashes, overflow and login bounces. Section paths are read from src/modules, not a list.
//
// Run:   npm run build && npx vite preview --port 4302 &
//        node scripts/browser-checks/sections-pass.cjs
// Needs: playwright (already installed globally in Claude Code cloud sessions,
//        otherwise `npm i -D playwright`).
// Env:   PW_CHROMIUM (optional browser path), BASE_URL (default http://localhost:4302), OUT_DIR (screenshots/results,
//        default the OS temp dir).

const BASE = process.env.BASE_URL || 'http://localhost:4302';
const OUT = (process.env.OUT_DIR || require('os').tmpdir()) + '/';
// If this repo pins its own Playwright, point at an installed Chromium:  PW_CHROMIUM=/path/to/chromium
const LAUNCH = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};
const {chromium}=require('playwright');const fs=require('fs');
const paths=(function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):/\.jsx?$/.test(e.name)?[...fs.readFileSync(d+'/'+e.name,'utf8').matchAll(/^\s*path:\s*'([^']+)'/gm)].map(m=>m[1]):[])})(require('path').resolve(__dirname,'../../src/modules')).filter((p,i,a)=>a.indexOf(p)===i).map(p=>p.replace(/:[a-zA-Z]+/g,'x'));
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const token=`${b64({alg:'none'})}.${b64({sub:'1',role:'admin',email:'a@b.c',exp:Math.floor(Date.now()/1000)+86400})}.sig`;
const modes={empty:r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}),down:r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"down"}'})};
(async()=>{const br=await chromium.launch(LAUNCH);const out=[];
 for(const [mode,h] of Object.entries(modes))for(const [vn,vp] of [['phone',{width:390,height:844}],['desktop',{width:1440,height:900}]]){
  const ctx=await br.newContext({viewport:vp});
  await ctx.addInitScript(t=>{localStorage.setItem('cc_admin_token',t);localStorage.setItem('cc_admin_user',JSON.stringify({role:'admin',email:'a@b.c'}))},token);
  await ctx.route(/\/api\//,r=>{ if(/gcr\/claims\?limit=1/.test(r.request().url())) return r.fulfill({status:200,contentType:'application/json',body:'{}'}); return h(r);});
  for(const route of paths){const p=await ctx.newPage();const errs=[];
   p.on('pageerror',e=>errs.push('PAGEERR '+e.message.slice(0,120)));
   try{await p.goto(BASE+route,{waitUntil:'load',timeout:15000});await p.waitForTimeout(700);
    const m=await p.evaluate(()=>({len:(document.body.innerText||'').trim().length,text:(document.body.innerText||'').trim().replace(/\s+/g,' ').slice(0,70),ov:document.documentElement.scrollWidth-document.documentElement.clientWidth,boundary:/something went wrong|failed to render|crashed|unexpected error/i.test(document.body.innerText||''),login:!!document.querySelector('input[type=password]'),url:location.pathname}));
    out.push({mode,vn,route,...m,errs});
    if(mode==='empty'&&vn==='phone'&&['/'].includes(route)) await p.screenshot({path:'shot-admin-root.png'});
   }catch(e){out.push({mode,vn,route,fatal:e.message.slice(0,80),errs});}
   await p.close();}
  await ctx.close();}
 await br.close();fs.writeFileSync(OUT+'admin-results.json',JSON.stringify(out,null,1));
 const bad=out.filter(o=>o.fatal||o.errs.length||o.ov>2||o.boundary||o.login||o.len<20);
 console.log('loads',out.length,'flagged',bad.length);
 const by={};for(const o of bad){const k=(o.fatal?'FATAL ':'')+(o.errs[0]||'')+(o.ov>2?' OVERFLOW':'')+(o.boundary?' BOUNDARY':'')+(o.login?' LOGIN':'')+(o.len<20?' BLANK':'');(by[k]??=[]).push(o.mode+'/'+o.vn+' '+o.route);}
 for(const [k,v] of Object.entries(by))console.log('\n['+v.length+'] '+k+'\n   '+v.slice(0,6).join('\n   '));
})();
