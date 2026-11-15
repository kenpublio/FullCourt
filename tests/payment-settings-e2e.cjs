const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const apiBase = process.env.FULLCOURT_API_URL || 'http://127.0.0.1:8767/api';
const fixture = JSON.parse(execFileSync('php', [path.join(root, 'backend/cli/seed_summer_league_u16.php')], { cwd: root, encoding: 'utf8' }));

async function request(route,{method='GET',token,body,form}={}){
  const response=await fetch(apiBase+route,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{}) ,...(body?{'Content-Type':'application/json'}:{})},body:form|| (body?JSON.stringify(body):undefined)});
  const payload=await response.json().catch(()=>({}));return{response,payload,data:payload?.data};
}
async function ok(route,options){const result=await request(route,options);if(!result.response.ok)throw new Error(`${options?.method||'GET'} ${route}: ${result.response.status} ${result.payload?.message||''}`);return result.data;}
async function login(email,portal='user'){return ok('/auth/login',{method:'POST',body:{email,password:fixture.password,portal}});}

(async()=>{
  const [admin,coach]=await Promise.all([login('platform.admin@fullcourt.local','admin'),login(fixture.coach_accounts[0].email)]);
  const tournamentId=Number(fixture.tournament_id);
  const teams=(await ok('/teams',{token:coach.token})).teams;
  const team=teams.find(row=>Number(row.tournament_id)===tournamentId);
  if(!team)throw new Error('Coach test team was not created.');
  const settings={registration_fee:1500,payment_methods:['gcash','maya'],payment_account_name:'FullCourt Test Treasurer',payment_account_number:'09171234567',payment_deadline:'2026-12-31',payment_instructions:'Add the team name to the payment note, then upload the original receipt.',payment_contact:'Tournament Treasurer · 09171234567'};
  await ok(`/tournaments/${tournamentId}/payment-settings`,{method:'PUT',token:admin.token,body:settings});
  const qrForm=new FormData();
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
  qrForm.append('qr',new Blob([png],{type:'image/png'}),'payment-qr.png');
  await ok(`/tournaments/${tournamentId}/payment-qr`,{method:'POST',token:admin.token,form:qrForm});
  const coachTournament=(await ok('/tournaments',{token:coach.token})).tournaments.find(row=>Number(row.id)===tournamentId);
  if(!coachTournament||coachTournament.payment_account_name!==settings.payment_account_name||!coachTournament.payment_qr_url)throw new Error('Admin payment setup did not reach the Coach tournament data.');
  const disabledMethod=await request('/payments',{method:'POST',token:coach.token,body:{team_id:team.id,tournament_id:tournamentId,payment_method:'cash',reference_number:`CASH-${Date.now()}`,amount:100}});
  if(disabledMethod.response.status!==409)throw new Error('A disabled tournament payment method was accepted.');
  const reference=`GCASH-${Date.now()}`;
  const submission=await ok('/payments',{method:'POST',token:coach.token,body:{team_id:team.id,tournament_id:tournamentId,payment_method:'gcash',reference_number:reference,amount:1500}});
  const paymentId=Number(submission.id);
  const premature=await request(`/payments/${paymentId}/verify`,{method:'PUT',token:admin.token,body:{status:'approved',remarks:'Should require receipt'}});
  if(premature.response.status!==422)throw new Error('Digital payment was approved without a receipt.');
  const receiptForm=new FormData();receiptForm.append('receipt',new Blob([png],{type:'image/png'}),'receipt.png');
  await ok(`/payments/${paymentId}/receipt`,{method:'POST',token:coach.token,form:receiptForm});
  await ok(`/payments/${paymentId}/verify`,{method:'PUT',token:admin.token,body:{status:'approved',remarks:'Receipt matched the submitted reference.'}});
  const payments=await ok('/payments',{token:coach.token});const approved=payments.payments.find(row=>Number(row.id)===paymentId);
  if(approved?.status!=='approved'||Number(approved.approved_total)!==1500)throw new Error('Approved balance did not reach the Coach payment history.');
  const adminNotices=(await ok('/notifications',{token:admin.token})).notifications||[];
  const coachNotices=(await ok('/notifications',{token:coach.token})).notifications||[];
  if(!adminNotices.some(row=>row.notification_type==='payment_review'))throw new Error('Admin did not receive the payment review notification.');
  if(!coachNotices.some(row=>row.notification_type==='payment_status'&&/approved/i.test(row.title)))throw new Error('Coach did not receive the payment approval notification.');
  const browser=await chromium.launch({channel:'msedge',headless:true});
  for(const [name,session,expected] of [['admin',admin,/How coaches pay/i],['coach',coach,/Official payment details/i]]){
    const context=await browser.newContext({viewport:{width:name==='coach'?390:1280,height:844}});
    await context.addInitScript(value=>{localStorage.setItem('sportsync_token',value.token);localStorage.setItem('sportsync_refresh_token',value.refresh_token||'');localStorage.setItem('sportsync_user',JSON.stringify(value.user));},session);
    const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:5180/payments',{waitUntil:'networkidle',timeout:45000});
    await page.getByText(expected).first().waitFor({timeout:30000});
    if(errors.length)throw new Error(`${name} payment page errors: ${errors.join('; ')}`);
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+3))throw new Error(`${name} payment page has horizontal overflow.`);
    await context.close();
  }
  await browser.close();
  console.log(JSON.stringify({tournament_id:tournamentId,admin_setup_saved:true,payment_qr_uploaded:true,coach_instructions_visible:true,disabled_method_blocked:true,receipt_required:true,receipt_uploaded:true,admin_approved:true,balance_updated:true,admin_notified:true,coach_notified:true,admin_ui_passed:true,coach_mobile_ui_passed:true},null,2));
})().catch(error=>{console.error(error.stack||error);process.exit(1);});
