const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root=path.resolve(__dirname,'..');
const sessions=JSON.parse(execFileSync('php',[path.join(__dirname,'BrowserAuditSession.php')],{cwd:root,encoding:'utf8'}));
const staff=sessions.find(entry=>entry.user.role==='statistician');
if(!staff)throw new Error('Staff Admin session unavailable.');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(session=>{localStorage.setItem('sportsync_token',session.token);localStorage.setItem('sportsync_user',JSON.stringify(session.user));},staff);
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:5180/eligibility');
  await page.getByRole('heading',{name:/Player Eligibility Verification/i}).waitFor();
  const tournament=page.getByLabel(/Select tournament/i);
  await tournament.selectOption({index:1});
  const review=page.getByRole('button',{name:/Review Player/i}).first();
  if(!await review.count())throw new Error('Assigned Staff Admin cannot see players in the assigned tournament.');
  await review.click();
  const modal=page.getByRole('dialog',{name:/Review Eligibility/i});await modal.waitFor();
  const fits=await modal.locator('.modal-content').evaluate(node=>{const r=node.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+2;});
  if(!fits)throw new Error('Eligibility review modal is not centered within the mobile viewport.');
  const view=modal.getByRole('button',{name:/View file/i}).first();
  let documentPreview=false;
  if(await view.count()){await view.click();await page.getByRole('dialog',{name:/preview/i}).waitFor();documentPreview=true;await page.getByRole('button',{name:/Close document preview/i}).click();}
  if(errors.length)throw new Error(errors.join(' | '));
  console.log(JSON.stringify({staff_assigned_players:true,centered_review_modal:true,document_preview:documentPreview},null,2));
  await browser.close();
})().catch(error=>{console.error(error.stack||error.message);process.exit(1);});
