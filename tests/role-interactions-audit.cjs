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
   await check(page,role,'/teams','team edit form opens',async()=>{await chooseTournament(page);await page.locator('button[aria-label^="Edit "]:visible').first().click();},()=>page.getByRole('heading',{name:/Edit Team/}).waitFor());
   await check(page,role,'/teams','roster opens',async()=>{await chooseTournament(page);await page.getByRole('button',{name:/View roster/}).first().click();},()=>page.locator('.modal.show').getByRole('heading',{name:/Roster/}).waitFor());
   await check(page,role,'/teams','player invitation is available only for approved teams',async()=>{await chooseTournament(page);const invite=page.locator('button[aria-label^="Invite player to "]:visible').first();if(await invite.count())await invite.click();else if(await page.locator('.team-selection-empty').count())return;else throw new Error('No team invite action is available.');},async()=>{if(await page.getByText('Invite a Player',{exact:true}).count())return;if(await page.locator('.team-selection-empty').count())return;const registered=await page.locator('.badge').filter({hasText:/registered/i}).count();if(registered)throw new Error('A registered team is listed but has no invite action.');});
   await check(page,role,'/officials','official tabs switch',async()=>{const tab=page.getByRole('button',{name:/Score Corrections/});await tab.waitFor({timeout:15000});await tab.click();if(!(await tab.evaluate(element=>element.classList.contains('active'))))throw new Error('Score Corrections tab did not become active.');});
   await check(page,role,'/qr-attendance','QR tabs switch',()=>page.getByRole('button',{name:role==='platform_admin'?/Check-in Log/:/Printable Team QR/}).click(),()=>page.getByText(role==='platform_admin'?/Attendance log|Check-in Log/:/Printable Team QR|Team QR/).first().waitFor());
   await check(page,role,'/venues',role==='platform_admin'?'venue oversight controls visible':'venue form opens',role==='platform_admin'?async()=>{}:()=>page.locator('button').filter({hasText:'Add Venue'}).first().click(),()=>role==='platform_admin'?page.getByRole('button',{name:'Approve'}).first().waitFor():page.getByRole('heading',{name:'Add Venue'}).waitFor());
  }else if(role==='coach'){
   await check(page,role,'/teams','team edit form opens',()=>page.locator('button[aria-label^="Edit "]:visible').first().click(),()=>page.getByRole('heading',{name:/Edit Team/}).waitFor());
   await check(page,role,'/teams','roster opens',()=>page.getByRole('button',{name:/View roster/}).first().click(),()=>page.locator('.modal.show').getByRole('heading',{name:/Roster/}).waitFor());
   await check(page,role,'/teams','player invitation is available only for approved teams',async()=>{await page.locator('.coach-team-card,.team-selection-empty').first().waitFor();const invite=page.getByRole('button',{name:/Invite player$/i}).first();if(await invite.count())await invite.click();else if(await page.locator('.coach-team-pending-note,.team-selection-empty').count())return;else throw new Error('No invite action or approval explanation is visible.');},async()=>{if(await page.getByText('Invite a Player',{exact:true}).count())return;if(await page.locator('.coach-team-pending-note,.team-selection-empty').count())return;throw new Error('The missing invite action has no approval explanation.');});
   await check(page,role,'/schedules','schedule refresh responds or stays locked until assignment',async()=>{await page.locator('.schedule-ops-toolbar').waitFor();const refresh=page.getByRole('button',{name:/Refresh schedule/i});if(await refresh.count()&&!(await refresh.isDisabled()))await refresh.click();else if(await page.getByText(/No team tournament yet/).count())return;else throw new Error(`Refresh is unavailable without a visible no-tournament state at ${page.url()}.`);await page.waitForTimeout(300);});
  }else{
   await check(page,role,'/schedules','schedule refresh responds or stays locked until assignment',async()=>{await page.locator('.schedule-ops-toolbar').waitFor();const refresh=page.getByRole('button',{name:/Refresh schedule/i});if(await refresh.count()&&!(await refresh.isDisabled()))await refresh.click();else if(await page.getByText(/No team tournament yet/).count())return;else throw new Error(`Refresh is unavailable without a visible no-tournament state at ${page.url()}.`);await page.waitForTimeout(300);});
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
