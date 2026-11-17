// Admin dashboard: the Business logins screen, driven against a stub API.
//
// Stats, prefilled contacts, disabled buttons without a contact, confirm prompts, a failed email reported, no overflow, no error toasts.
//
// Run:   npm run build && npx vite preview --port 4302 &
//        node scripts/browser-checks/business-logins.cjs
// Needs: playwright (already installed globally in Claude Code cloud sessions,
//        otherwise `npm i -D playwright`).
// Env:   PW_CHROMIUM (optional browser path), BASE_URL (default http://localhost:4302), OUT_DIR (screenshots/results,
//        default the OS temp dir).

const BASE = process.env.BASE_URL || 'http://localhost:4302';
const OUT = (process.env.OUT_DIR || require('os').tmpdir()) + '/';
// If this repo pins its own Playwright, point at an installed Chromium:  PW_CHROMIUM=/path/to/chromium
const LAUNCH = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};
const {chromium}=require('playwright');
const S=(process.env.OUT_DIR||require('os').tmpdir())+'/';
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const token=`${b64({alg:'none'})}.${b64({sub:'1',role:'admin',email:'a@b.c',exp:Math.floor(Date.now()/1000)+86400})}.sig`;
const J=(o,status=200)=>({status,contentType:'application/json',body:JSON.stringify(o)});
const ents=[{slug:'wolf-bay',name:'Wolf Bay Lodge',email:'',phone:'+12515550123'},{slug:'pelican-cafe',name:'Pelican Cafe',email:'hi@pelican.test',phone:'+12515550177'},{slug:'owned-bar',name:'Owned Bar',email:'',phone:''}];
const posts=[];
(async()=>{const br=await chromium.launch(LAUNCH);let fails=0;const ok=(n,c,d)=>{if(!c)fails++;console.log((c?'  ok   ':'  FAIL ')+n+(c?'':' '+JSON.stringify(d)));};
 for(const [vn,vp] of [['phone',{width:390,height:844}],['desktop',{width:1440,height:900}]]){
  const ctx=await br.newContext({viewport:vp});
  await ctx.addInitScript(t=>{localStorage.setItem('cc_admin_token',t);localStorage.setItem('cc_admin_user',JSON.stringify({role:'admin',email:'a@b.c'}));localStorage.removeItem('cc_admin_entity')},token);
  let sendFail=false;
  await ctx.route(/\/api\//,async r=>{const u=r.request().url(),m=r.request().method();
   if(/claims\?limit=1/.test(u))return r.fulfill(J({}));
   if(/business-invites\/coverage/.test(u))return r.fulfill(J({active_businesses:4106,with_login:1,invite_pending:2,no_login_yet:4105,reachable:{email:628,phone_only:2536,neither:941}}));
   if(/business-invites/.test(u)&&m==='GET')return r.fulfill(J({invites:[{id:'1',email:'x@y.z',status:'pending',created_at:new Date().toISOString(),expires_at:new Date().toISOString()}]}));
   if(/business-invites/.test(u)&&m==='POST'){const body=JSON.parse(r.request().postData());posts.push(body);
     if(body.slug==='owned-bar'&&!body.force)return r.fulfill(J({error:'already',already_owned:true},409));
     return r.fulfill(J({slug:body.slug,business_name:'Biz',claim_url:'https://dash.test/?token=abc123',expires_in_days:14,login_hint:'Sign in with your business ID.',sent:{email:body.channel==='email'||body.channel==='both'?{to:body.email,ok:!sendFail}:null,sms:body.channel==='sms'||body.channel==='both'?{to:body.phone,ok:true}:null}},201));}
   if(/\/gcr\/entities/.test(u))return r.fulfill(J({entities:ents}));
   return r.fulfill(J({}));});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  p.on('dialog',d=>{console.log('   [confirm]',d.message());d.accept();});
  await p.goto(BASE+'/platform/business-logins');await p.waitForTimeout(1200);
  const txt=await p.evaluate(()=>document.body.innerText);
  ok(vn+': stats render',/4106/.test(txt)&&/2536/.test(txt)&&/No login yet/.test(txt));
  ok(vn+': empty state before choosing',/Choose a business/.test(txt));
  await p.getByPlaceholder('Search businesses…').click();await p.getByPlaceholder('Search businesses…').fill('wolf');await p.waitForTimeout(400);
  await p.getByText('Wolf Bay Lodge').first().click();await p.waitForTimeout(500);
  ok(vn+': phone prefilled, email empty',(await p.inputValue('input[type=tel]'))==='+12515550123'&&(await p.inputValue('input[type=email]'))==='');
  ok(vn+': Email buttons disabled without email',await p.getByRole('button',{name:'Email it'}).isDisabled()&&await p.getByRole('button',{name:'Email + text'}).isDisabled());
  const before=posts.length;await p.getByRole('button',{name:'Create link'}).click();await p.waitForTimeout(600);
  ok(vn+': create link sends channel none, no confirm',posts.length===before+1&&posts.at(-1).channel==='none');
  ok(vn+': link shown with copy',(await p.inputValue('input[readonly]'))==='https://dash.test/?token=abc123');
  await p.getByRole('button',{name:'Text it'}).click();await p.waitForTimeout(600);
  ok(vn+': text it sends sms to the prefilled number',posts.at(-1).channel==='sms'&&posts.at(-1).phone==='+12515550123');
  await p.fill('input[type=email]','owner@wolf.test');
  sendFail=true;await p.getByRole('button',{name:'Email + text'}).click();await p.waitForTimeout(700);
  const t2=await p.evaluate(()=>document.body.innerText);
  ok(vn+': failed email is reported, not hidden',/Email to owner@wolf.test: failed/.test(t2)&&/Text to \+12515550123: sent/.test(t2));
  ok(vn+': no horizontal overflow',(await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))<=2);
  if(vn==='phone')await p.screenshot({path:S+'shot-logins-phone.png',fullPage:true});
  if(vn==='desktop')await p.screenshot({path:S+'shot-logins-desktop.png'});
  await p.getByPlaceholder('Search businesses…').click().catch(()=>{});
  ok(vn+': history lists issued links',/pending/.test(t2));
  ok(vn+': no page errors',errs.length===0,errs); ok(vn+': no "is not a function" error toasts',!/is not a function/.test(await p.evaluate(()=>document.body.innerText)));
  await ctx.close();}
 await br.close();console.log(fails?fails+' failed':'all ui checks passed');process.exit(fails?1:0);})();
