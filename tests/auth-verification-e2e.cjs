const apiBase = 'http://127.0.0.1:8767/api';

async function call(route, body, expected = 200) {
  const response = await fetch(apiBase + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (response.status !== expected) throw new Error(`${route}: expected ${expected}, received ${response.status} (${payload.message || 'no message'})`);
  return payload;
}

(async () => {
  const stamp = Date.now();
  const email = `fullcourt.verification.${stamp}@example.com`;
  const oldPassword = 'FullCourt2026!';
  const newPassword = 'FullCourt2027!';

  const registrationCodeResponse = await call('/auth/email-code', { email, purpose: 'registration' });
  const registrationCode = registrationCodeResponse.data?.development_code;
  if (!/^\d{6}$/.test(registrationCode || '')) throw new Error('Development registration code was not returned.');
  await call('/auth/verify-email-code', { email, code: '000000' }, 400);
  await call('/auth/verify-email-code', { email, code: registrationCode });
  await call('/auth/register', {
    role: 'coach', full_name: 'Verification Test Coach', birth_date: '1994-05-27', age: 32,
    address: 'Barangay Linao, Ormoc City', email, phone_number: '', coaching_experience: 5,
    verification_code: registrationCode, password: oldPassword,
  }, 201);
  await call('/auth/login', { email, password: oldPassword, portal: 'user' });

  const resetResponse = await call('/auth/forgot-password', { email });
  const resetCode = resetResponse.data?.development_code;
  if (!/^\d{6}$/.test(resetCode || '')) throw new Error('Development password-reset code was not returned.');
  await call('/auth/verify-reset-code', { email, code: '000000' }, 400);
  await call('/auth/verify-reset-code', { email, code: resetCode });
  await call('/auth/reset-password', { email, code: resetCode, password: newPassword });
  await call('/auth/login', { email, password: oldPassword, portal: 'user' }, 401);
  await call('/auth/login', { email, password: newPassword, portal: 'user' });

  console.log(JSON.stringify({
    registration_code_sent: true,
    invalid_registration_code_rejected: true,
    registration_code_verified: true,
    account_created: true,
    initial_login_passed: true,
    forgot_password_code_sent: true,
    invalid_reset_code_rejected: true,
    reset_code_verified: true,
    password_changed: true,
    old_password_rejected: true,
    new_password_login_passed: true,
  }, null, 2));
})().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
