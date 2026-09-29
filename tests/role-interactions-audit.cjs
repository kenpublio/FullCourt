const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:5180';
const sessions=JSON.parse(execFileSync('php',[path.join(__dirname,'BrowserAuditSession.php')],{cwd:root,encoding:'utf8'}));
const results=[];
async function open(page,route){await page.goto(base+route);await page.locator('.sidebar-menu').waitFor({timeout:15000});await page.waitForLoadState('networkidle',{timeout:1500}).catch(()=>{});await page.waitForTimeout(500);}
async function chooseTournament(page){const picker=page.locator('.team-tournament-picker select').first();await picker.selectOption({index:1},{timeout:20000});await page.getByText(/teams displayed/).waitFor({timeout:20000});}
async function check(page,role,route,label,action,assertion){
  let result;
  try{await open(page,route);await action();if(assertion)await assertion();result={role,route,label,ok:true};}
  catch(e){result={role,route,label,ok:false,error:String(e.message).split('\n')[0]};}
  results.push(result);console.log(JSON.stringify(result));
}
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const requestedRole=process.env.AUDIT_ROLE;
 for(const role of ['platform_admin','organization_admin','coach','player'].filter(value=>!requestedRole||value===requestedRole)){
  const s=sessions.find(x=>x.user.role===role),ctx=await browser.newContext({viewport:{width:1280,height:900}});
  await ctx.addInitScript(v=>{localStorage.setItem('sportsync_token',v.token);localStorage.setItem('sportsync_user',JSON.stringify(v.user));},s);
  const page=await ctx.newPage();
  page.setDefaultTimeout(8000);
  if(['platform_admin','organization_admin'].includes(role)){
   await check(page,role,'/organizations','organization form opens',()=>page.getByRole('button',{name:'Apply for Organization'}).click(),()=>page.getByRole('heading',{name:/Organization Application/}).waitFor());
   await check(page,role,'/tournaments','create tournament form opens',()=>page.getByRole('button',{name:/Create Tournament/}).first().click(),()=>page.getByRole('heading',{name:'Create New Tournament'}).waitFor());
   await check(page,role,'/tournaments','division manager opens',()=>page.getByRole('button',{name:'Divisions'}).first().click(),()=>page.getByText(/Division Management|Tournament Divisions/).first().waitFor());
   await check(page,role,'/teams','new team form opens',async()=>{await chooseTournament(page);await page.getByRole('button',{name:/New Team/}).click();},()=>page.getByRole('heading',{name:/Register New Team/}).waitFor());
   await check(page,role,'/teams','team edit form opens',async()=>{await chooseTournament(page);await page.getByRole('button',{name:/Edit Barangay Cogon/}).first().click();},()=>page.getByRole('heading',{name:/Edit Team/}).waitFor());
   await check(page,role,'/teams','roster opens',async()=>{await chooseTournament(page);await page.getByRole('button',{name:/View roster/}).first().click();},()=>page.locator('.modal.show').getByRole('heading',{name:/Roster/}).waitFor());
   await check(page,role,'/teams','player invitation opens',async()=>{await chooseTournament(page);await page.getByRole('button',{name:/Invite player to Barangay Cogon/}).first().click();},()=>page.getByText('Invite a Player').waitFor());
   await check(page,role,'/officials','official tabs switch',()=>page.getByRole('button',{name:'Score Corrections'}).click(),()=>page.getByText(/Score Correction/).first().waitFor());
   await check(page,role,'/qr-attendance','QR tabs switch',()=>page.getByRole('button',{name:role==='platform_admin'?/Check-in Log/:/Printable Team QR/}).click(),()=>page.getByText(role==='platform_admin'?/Attendance log|Check-in Log/:/Printable Team QR|Team QR/).first().waitFor());
   await check(page,role,'/venues',role==='platform_admin'?'venue oversight controls visible':'venue form opens',role==='platform_admin'?async()=>{}:()=>page.locator('button').filter({hasText:'Add Venue'}).first().click(),()=>role==='platform_admin'?page.getByRole('button',{name:'Approve'}).first().waitFor():page.getByRole('heading',{name:'Add Venue'}).waitFor());
  }else if(role==='coach'){
   await check(page,role,'/teams','team edit form opens',()=>page.getByRole('button',{name:/Edit Barangay Cogon/}).first().click(),()=>page.getByRole('heading',{name:/Edit Team/}).waitFor());
   await check(page,role,'/teams','roster opens',()=>page.getByRole('button',{name:/View roster/}).first().click(),()=>page.locator('.modal.show').getByRole('heading',{name:/Roster/}).waitFor());
   await check(page,role,'/teams','player invitation opens',()=>page.getByRole('button',{name:/Invite player to Barangay Cogon/}).first().click(),()=>page.getByText('Invite a Player').waitFor());
   await check(page,role,'/schedules','schedule refresh responds',async()=>{await page.getByRole('button',{name:/Refresh schedule/i}).click();await page.waitForTimeout(300);});
  }else{
   await check(page,role,'/schedules','schedule refresh responds',async()=>{await page.getByRole('button',{name:/Refresh schedule/i}).click();await page.waitForTimeout(300);});
  }
  await check(page,role,'/profile','profile edit enables fields',()=>page.getByRole('button',{name:/Edit Profile/}).click(),async()=>{const fullName=page.getByLabel('Full Name');await fullName.waitFor();if(await fullName.isDisabled())throw new Error('Profile input stayed disabled');});
  await check(page,role,'/settings','theme toggle works locally',async()=>{const before=await page.locator('html').getAttribute('data-fullcourt-theme');await page.getByRole('button',{name:/Dark mode/}).click();const after=await page.locator('html').getAttribute('data-fullcourt-theme');if(!after||after===before)throw new Error('Theme toggle did not change appearance');});
  if(['coach','player'].includes(role)){
   await check(page,role,'/live-scoring','scoring workspace is blocked',async()=>{},async()=>{if(new URL(page.url()).pathname==='/live-scoring')throw new Error('Restricted scoring route remained accessible');});
  }
  await ctx.close();
 }
 console.log(JSON.stringify(results,null,2));await browser.close();if(results.some(r=>!r.ok))process.exit(2);
})().catch(e=>{console.error(e);process.exit(1)});
