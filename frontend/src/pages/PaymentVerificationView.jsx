import React, { useState, useEffect, useCallback, useMemo } from 'react';
import paymentService from '../services/paymentService';
import teamService from '../services/teamService';
import tournamentService from '../services/tournamentService';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8767/api';
const receiptUrl = (path) => {
  if (!path) return null;
  try { return new URL(path, API_BASE_URL).toString(); }
  catch { return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`; }
};

const PaymentVerificationView = () => {
  const { user } = useAuth();
  const canSubmitPayment = ['coach','coach_manager'].includes(user?.role);
  const canVerifyPayment = ['platform_admin','admin','finance_officer','organization_admin','tournament_organizer'].includes(user?.role);
  const canConfigurePayment = ['platform_admin','admin'].includes(user?.role);
  const isCoach = ['coach','coach_manager'].includes(user?.role);
  const [payments, setPayments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [formData, setFormData] = useState({ team_id: '', tournament_id: '', payment_method: 'gcash', reference_number: '', amount: '' });
  const [receiptFile, setReceiptFile] = useState(null);
  const [uploadingReceiptId, setUploadingReceiptId] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [settingsTournamentId,setSettingsTournamentId]=useState('');
  const [paymentSetup,setPaymentSetup]=useState({registration_fee:'0',payment_methods:['gcash','maya','cash'],payment_account_name:'',payment_account_number:'',payment_deadline:'',payment_instructions:'',payment_contact:''});
  const [paymentQrFile,setPaymentQrFile]=useState(null);
  const [savingSetup,setSavingSetup]=useState(false);
  const [setupNotice,setSetupNotice]=useState('');

  const loadData = useCallback(async () => {
    setLoadError('');
    try {
      setLoading(true);
      const [pData, tData, tourRes] = await Promise.all([
        paymentService.getPayments(),
        teamService.getTeams(),
        tournamentService.getTournaments(),
      ]);
      setPayments(pData);
      setTeams(tData);
      setTournaments(tourRes.tournaments || []);
      if(!settingsTournamentId&&(tourRes.tournaments||[]).length)setSettingsTournamentId(String(tourRes.tournaments[0].id));
      if (tData.length > 0) {
        const firstTeam=tData[0];
        const teamTournament=(tourRes.tournaments||[]).find(tournament=>String(tournament.id)===String(firstTeam.tournament_id));
        setFormData(prev => ({ ...prev, team_id: firstTeam.id, tournament_id: firstTeam.tournament_id || '', amount: teamTournament?.registration_fee ?? '' }));
      }
    } catch (err) {
      console.error(err);
      setLoadError(err.response?.data?.message || 'We could not load payment records. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [settingsTournamentId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    try {
      const amount=formData.amount;
      if(!(Number(amount)>0)){
        alert('This tournament has no registration fee to submit.');
        return;
      }
      const res = await paymentService.submitPayment({ ...formData, amount });
      if (res?.data?.id && receiptFile) {
        try {
          await paymentService.uploadReceipt(res.data.id, receiptFile);
        } catch (err) {
          alert('Payment submitted but receipt upload failed: ' + (err.response?.data?.message || 'Unknown error'));
        }
      }
      setShowSubmitModal(false);
      setReceiptFile(null);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Payment submission failed');
    }
  };

  const handleVerify = async (paymentId, status) => {
    const remarks = prompt(status === 'approved' ? 'Optional approval note:' : 'Reason for rejecting this payment:', status === 'approved' ? 'Reviewed and approved' : '');
    if (remarks === null) return;
    if (status === 'rejected' && !remarks.trim()) {
      alert('Add a short reason so the team knows what to correct.');
      return;
    }
    try {
      await paymentService.verifyPayment(paymentId, status, remarks);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Verification failed');
    }
  };

  const handleReceiptUpload = async (paymentId, file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Receipt image must be 5MB or smaller.');
      return;
    }
    setUploadingReceiptId(paymentId);
    try {
      await paymentService.uploadReceipt(paymentId, file);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Receipt upload failed. Please try again.');
    } finally {
      setUploadingReceiptId(null);
    }
  };

  const paymentSummary = payments.reduce((summary, payment) => {
    summary[payment.status] = (summary[payment.status] || 0) + 1;
    if (payment.status === 'approved') summary.approvedAmount += Number(payment.amount || 0);
    return summary;
  }, { pending: 0, approved: 0, rejected: 0, approvedAmount: 0 });
  const selectedTeam = teams.find(team => String(team.id) === String(formData.team_id));
  const allowedTournaments = selectedTeam?.tournament_id
    ? tournaments.filter(tournament => String(tournament.id) === String(selectedTeam.tournament_id))
    : [];
  const selectedTournament = allowedTournaments.find(tournament => String(tournament.id) === String(formData.tournament_id));
  const selectedPaid = payments.filter(payment => String(payment.team_id)===String(formData.team_id) && String(payment.tournament_id)===String(formData.tournament_id) && payment.status==='approved').reduce((sum,payment)=>sum+Number(payment.amount||0),0);
  const selectedFee = Number(selectedTournament?.registration_fee||0);
  const selectedBalance = Math.max(0,selectedFee-selectedPaid);
  const selectedMethods=useMemo(()=>String(selectedTournament?.payment_methods||'gcash,maya,cash').split(',').filter(Boolean),[selectedTournament?.payment_methods]);
  const settingsTournament=tournaments.find(tournament=>String(tournament.id)===String(settingsTournamentId));

  useEffect(()=>{
    if(!settingsTournament)return;
    setPaymentSetup({
      registration_fee:String(settingsTournament.registration_fee??0),
      payment_methods:String(settingsTournament.payment_methods||'gcash,maya,cash').split(',').filter(Boolean),
      payment_account_name:settingsTournament.payment_account_name||'',payment_account_number:settingsTournament.payment_account_number||'',
      payment_deadline:settingsTournament.payment_deadline||'',payment_instructions:settingsTournament.payment_instructions||'',payment_contact:settingsTournament.payment_contact||'',
    });
    setPaymentQrFile(null);setSetupNotice('');
  },[settingsTournament]);

  const togglePaymentMethod=method=>setPaymentSetup(current=>({...current,payment_methods:current.payment_methods.includes(method)?current.payment_methods.filter(item=>item!==method):[...current.payment_methods,method]}));
  const savePaymentSetup=async event=>{event.preventDefault();setSavingSetup(true);setSetupNotice('');try{await paymentService.updateTournamentSettings(settingsTournamentId,paymentSetup);if(paymentQrFile)await paymentService.uploadTournamentQr(settingsTournamentId,paymentQrFile);setSetupNotice('Payment instructions saved and are now visible to the tournament coaches.');await loadData();}catch(error){setSetupNotice(error.response?.data?.message||'Payment setup could not be saved.');}finally{setSavingSetup(false);}};

  useEffect(() => {
    if (!showSubmitModal) return;
    setFormData(previous => {
      if (selectedBalance <= 0) return previous.amount === '' ? previous : { ...previous, amount: '' };
      const current = Number(previous.amount || 0);
      if (current > 0 && current <= selectedBalance) return previous;
      return { ...previous, amount: String(selectedBalance) };
    });
  }, [showSubmitModal, selectedBalance]);

  useEffect(()=>{if(selectedTournament&&!selectedMethods.includes(formData.payment_method))setFormData(previous=>({...previous,payment_method:selectedMethods[0]||'cash'}));},[selectedTournament,selectedMethods,formData.payment_method]);

  const downloadReport = () => {
    const escapeCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows = [
      ['Date', 'Team', 'Tournament', 'Method', 'Reference Number', 'Installment', 'Registration Fee', 'Approved Total', 'Remaining Balance', 'Payment State', 'Status', 'Verified By'],
      ...payments.map(p => {
        const fee=Number(p.registration_fee||0), paid=Number(p.approved_total||0), balance=Math.max(0,fee-paid);
        return [p.created_at, p.team_name, p.tournament_name, p.payment_method, p.reference_number, p.amount, fee, paid, balance, balance<=0?'Fully paid':paid>0?'Partial':'Unpaid', p.status, p.verifier_name || ''];
      }),
    ];
    const csv = rows.map(row => row.map(escapeCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `sportsync-payment-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container-fluid p-0">
      {isCoach ? <section className="coach-payment-heading mb-4">
        <div><span className="coach-payment-kicker"><i className="bi bi-wallet2"/> TEAM FINANCE</span><h1>Team Payments</h1><p>Submit your team’s registration payment and follow its verification status.</p></div>
        <div className="coach-payment-heading-actions"><button type="button" className="btn btn-outline-secondary" onClick={loadData} disabled={loading}><i className="bi bi-arrow-clockwise me-2"/>Refresh</button><button type="button" className="btn btn-evsu" onClick={() => setShowSubmitModal(true)} disabled={!teams.length||selectedBalance<=0}><i className="bi bi-plus-lg me-2"/>{selectedBalance<=0?'Fully paid':'Submit payment'}</button></div>
      </section> : <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 fw-bold text-dark mb-1">
            <i className="bi bi-credit-card-fill text-evsu-primary me-2"></i>
            Team Payment Review (GCash / Maya)
          </h1>
          <p className="text-muted small mb-0">Review receipts submitted by coaches, then approve or return them with a reason.</p>
        </div>
        <div className="d-flex gap-2">
          {user?.role === 'finance_officer' && <button className="btn btn-outline-danger" onClick={downloadReport}><i className="bi bi-file-earmark-arrow-down-fill me-1" />Download Report</button>}
          {canSubmitPayment && <button className="btn btn-evsu" onClick={() => setShowSubmitModal(true)}><i className="bi bi-plus-lg me-1"></i> Submit Payment Receipt</button>}
        </div>
      </div>}

      {isCoach&&!loading&&!loadError&&<section className="coach-payment-stats mb-4" aria-label="Team payment summary">
        <article><i className="bi bi-hourglass-split pending"/><span><small>Awaiting review</small><strong>{paymentSummary.pending}</strong></span></article>
        <article><i className="bi bi-check-circle-fill approved"/><span><small>Approved</small><strong>{paymentSummary.approved}</strong></span></article>
        <article><i className="bi bi-arrow-counterclockwise rejected"/><span><small>Needs attention</small><strong>{paymentSummary.rejected}</strong></span></article>
        <article><i className="bi bi-cash-stack amount"/><span><small>Verified total</small><strong>₱{paymentSummary.approvedAmount.toLocaleString(undefined,{maximumFractionDigits:2})}</strong></span></article>
      </section>}

      {canConfigurePayment&&!loading&&!loadError&&<section className="card-custom p-3 p-md-4 mb-4 payment-setup-panel"><div className="d-flex flex-wrap justify-content-between gap-3 align-items-start mb-3"><div><span className="coach-payment-kicker"><i className="bi bi-wallet-fill"/> PAYMENT SETUP</span><h2 className="h4 fw-bold mb-1">How coaches pay</h2><p className="text-muted small mb-0">Set the fee, receiving account, deadline, QR, and exact instructions for one tournament.</p></div><label className="form-label small fw-bold mb-0">Tournament<select className="form-select mt-1" value={settingsTournamentId} onChange={event=>setSettingsTournamentId(event.target.value)}>{tournaments.map(tournament=><option value={tournament.id} key={tournament.id}>{tournament.name}</option>)}</select></label></div>{settingsTournament&&<form onSubmit={savePaymentSetup}><div className="row g-3"><label className="col-md-4 form-label small fw-bold">Registration fee (₱)<input type="number" min="0" step="0.01" className="form-control mt-1" value={paymentSetup.registration_fee} onChange={event=>setPaymentSetup(current=>({...current,registration_fee:event.target.value}))} required/></label><label className="col-md-4 form-label small fw-bold">Payment deadline<input type="date" className="form-control mt-1" value={paymentSetup.payment_deadline} onChange={event=>setPaymentSetup(current=>({...current,payment_deadline:event.target.value}))}/></label><label className="col-md-4 form-label small fw-bold">Contact person<input className="form-control mt-1" maxLength="150" value={paymentSetup.payment_contact} onChange={event=>setPaymentSetup(current=>({...current,payment_contact:event.target.value}))} placeholder="Name or mobile number"/></label><fieldset className="col-12"><legend className="form-label small fw-bold">Accepted methods</legend><div className="d-flex flex-wrap gap-2">{[['gcash','GCash'],['maya','Maya'],['cash','Cash over-counter']].map(([value,label])=><label className={`payment-method-chip ${paymentSetup.payment_methods.includes(value)?'is-selected':''}`} key={value}><input type="checkbox" checked={paymentSetup.payment_methods.includes(value)} onChange={()=>togglePaymentMethod(value)}/><i className={`bi ${paymentSetup.payment_methods.includes(value)?'bi-check-circle-fill':'bi-circle'}`}/>{label}</label>)}</div></fieldset><label className="col-md-6 form-label small fw-bold">Receiving account name<input className="form-control mt-1" maxLength="150" value={paymentSetup.payment_account_name} onChange={event=>setPaymentSetup(current=>({...current,payment_account_name:event.target.value}))} placeholder="Account holder name"/></label><label className="col-md-6 form-label small fw-bold">GCash / Maya number<input inputMode="numeric" className="form-control mt-1" maxLength="16" value={paymentSetup.payment_account_number} onChange={event=>setPaymentSetup(current=>({...current,payment_account_number:event.target.value}))} placeholder="09XXXXXXXXX"/></label><label className="col-md-7 form-label small fw-bold">Payment instructions<textarea className="form-control mt-1" rows="3" maxLength="2000" value={paymentSetup.payment_instructions} onChange={event=>setPaymentSetup(current=>({...current,payment_instructions:event.target.value}))} placeholder="Example: Add the team name to the payment note, then upload the receipt."/></label><label className="col-md-5 form-label small fw-bold">Payment QR image<input type="file" className="form-control mt-1" accept="image/jpeg,image/png,image/webp" onChange={event=>setPaymentQrFile(event.target.files?.[0]||null)}/>{settingsTournament.payment_qr_url&&<a className="small d-inline-block mt-2" href={receiptUrl(settingsTournament.payment_qr_url)} target="_blank" rel="noreferrer"><i className="bi bi-qr-code me-1"/>View current QR</a>}</label></div><div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">{setupNotice?<span className="small fw-semibold" role="status">{setupNotice}</span>:<span className="text-muted small">Never enter a wallet PIN, password, or OTP.</span>}<button className="btn btn-evsu" disabled={savingSetup}>{savingSetup?'Saving…':'Save payment setup'}</button></div></form>}</section>}

      {isCoach&&selectedTournament&&Number(selectedTournament.registration_fee||0)>0&&<section className="card-custom p-3 p-md-4 mb-4 coach-payment-guide"><div><span className="coach-payment-kicker"><i className="bi bi-shield-check"/> OFFICIAL PAYMENT DETAILS</span><h2 className="h4 fw-bold mb-1">Pay {selectedTournament.name}</h2><p className="text-muted small mb-0">Use only the receiving details posted by the tournament Admin.</p></div><div className="coach-payment-guide-grid"><article><small>Amount due</small><strong>₱{selectedBalance.toFixed(2)}</strong><span>of ₱{selectedFee.toFixed(2)}</span></article><article><small>Send payment to</small><strong>{selectedTournament.payment_account_name||'Waiting for Admin setup'}</strong><span>{selectedTournament.payment_account_number||'No number posted'}</span></article><article><small>Deadline</small><strong>{selectedTournament.payment_deadline||'Not set'}</strong><span>{selectedTournament.payment_contact?`Contact: ${selectedTournament.payment_contact}`:'Contact the Admin for questions'}</span></article>{selectedTournament.payment_qr_url&&<article className="payment-qr-card"><img src={receiptUrl(selectedTournament.payment_qr_url)} alt={`${selectedTournament.name} payment QR`}/><a href={receiptUrl(selectedTournament.payment_qr_url)} target="_blank" rel="noreferrer">Open payment QR</a></article>}</div>{selectedTournament.payment_instructions&&<div className="payment-instruction-note"><i className="bi bi-info-circle-fill"/><span>{selectedTournament.payment_instructions}</span></div>}</section>}

      {!loading && user?.role === 'finance_officer' && <div className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3"><div className="finance-report-card pending"><i className="bi bi-hourglass-split" /><div><small>Pending Review</small><strong>{paymentSummary.pending}</strong></div></div></div>
        <div className="col-sm-6 col-xl-3"><div className="finance-report-card approved"><i className="bi bi-check-circle-fill" /><div><small>Approved</small><strong>{paymentSummary.approved}</strong></div></div></div>
        <div className="col-sm-6 col-xl-3"><div className="finance-report-card rejected"><i className="bi bi-x-circle-fill" /><div><small>Rejected</small><strong>{paymentSummary.rejected}</strong></div></div></div>
        <div className="col-sm-6 col-xl-3"><div className="finance-report-card revenue"><i className="bi bi-cash-stack" /><div><small>Verified Revenue</small><strong>₱{paymentSummary.approvedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></div></div></div>
      </div>}

      {loadError&&!loading ? <div className="coach-payment-empty" role="alert"><i className="bi bi-wifi-off"/><h3>Payments unavailable</h3><p>{loadError}</p><button type="button" className="btn btn-evsu" onClick={loadData}>Try again</button></div> : loading ? (
        <LoadingSpinner message="Loading payment transactions..." />
      ) : (
        <div className="card-custom p-3 p-md-4 coach-payment-table-card">
          {isCoach&&<div className="coach-payment-table-head"><div><h2>Payment history</h2><p>{selectedTeam?.team_name ? `Transactions for ${selectedTeam.team_name}` : 'Your assigned team transactions'}</p></div><span>{payments.length} {payments.length===1?'record':'records'}</span></div>}
          {isCoach&&payments.length===0?<div className="coach-payment-history-empty"><i className="bi bi-receipt"/><strong>No payment submitted yet</strong><span>Open Submit payment when your team is ready to send its receipt.</span></div>:<div className="table-responsive" role="region" aria-label="Tournament payment records table" tabIndex={0}>
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Date</th>
                  <th>Team</th>
                  <th>Tournament</th>
                  <th>Method &amp; Ref No.</th>
                  <th>Installment</th>
                  <th>Balance</th>
                  <th>Receipt</th>
                  <th>Status</th>
                  {canVerifyPayment && <th className="text-end">Finance Action</th>}
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                <tr><td colSpan={canVerifyPayment ? 9 : 8} className="text-center py-5 text-muted"><i className="bi bi-receipt-cutoff d-block mb-2 fs-3 opacity-50"/>{isCoach?'No payments for your team yet. Submit a payment when ready.':'No payment transactions recorded.'}</td></tr>
                ) : (
                  payments.map(p => (
                    <tr key={p.id}>
                      <td className="small text-muted">{p.created_at}</td>
                      <td className="fw-bold text-dark">{p.team_name}</td>
                      <td className="small">{p.tournament_name}</td>
                      <td>
                        <span className="badge bg-primary text-uppercase me-1">{p.payment_method}</span>
                        <span className="font-monospace small">{p.reference_number}</span>
                      </td>
                      <td className="fw-bold text-success">₱{parseFloat(p.amount).toFixed(2)}</td>
                      <td><strong>₱{Math.max(0,Number(p.registration_fee||0)-Number(p.approved_total||0)).toFixed(2)}</strong><small className="d-block text-muted">{Number(p.approved_total||0)>=Number(p.registration_fee||0)?'Fully paid':Number(p.approved_total||0)>0?'Partial':'Unpaid'}</small></td>
                      <td>
                        {p.receipt_photo_url
                          ? <a href={receiptUrl(p.receipt_photo_url)} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-secondary"><i className="bi bi-image me-1" />View</a>
                          : canSubmitPayment && p.status === 'pending'
                            ? <label className="btn btn-sm btn-outline-secondary mb-0">
                                <i className={`bi ${uploadingReceiptId===p.id?'bi-hourglass-split':'bi-upload'} me-1`}/>{uploadingReceiptId===p.id?'Uploading…':'Add receipt'}
                                <input type="file" className="visually-hidden" accept="image/jpeg,image/png,image/webp" disabled={uploadingReceiptId===p.id} onChange={e=>{handleReceiptUpload(p.id,e.target.files?.[0]);e.target.value='';}} />
                              </label>
                            : <span className="text-muted small">No receipt</span>}
                      </td>
                      <td>
                        <span className={`badge ${p.status === 'approved' ? 'bg-success' : p.status === 'rejected' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                          {p.status}
                        </span>
                      </td>
                      {canVerifyPayment && <td className="text-end">
                        {p.status === 'pending' && (
                          <div className="btn-group btn-group-sm">
                            <button className="btn btn-outline-success" onClick={() => handleVerify(p.id, 'approved')}>
                              <i className="bi bi-check-lg"></i> Approve
                            </button>
                            <button className="btn btn-outline-danger" onClick={() => handleVerify(p.id, 'rejected')}>
                              <i className="bi bi-x-lg"></i> Reject
                            </button>
                          </div>
                        )}
                      </td>}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>}
        </div>
      )}

      {canSubmitPayment && showSubmitModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content card-custom border-0">
              <div className="modal-header border-bottom">
                <h5 className="fw-bold text-dark mb-0">Submit Payment Proof</h5>
                <button type="button" className="btn-close" onClick={() => setShowSubmitModal(false)}></button>
              </div>
              <form onSubmit={handleSubmitPayment}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Select Team</label>
                    <select className="form-select" required value={formData.team_id} disabled={!teams.length} onChange={e => {const team=teams.find(item=>String(item.id)===String(e.target.value));const tournament=tournaments.find(item=>String(item.id)===String(team?.tournament_id));setFormData({...formData,team_id:e.target.value,tournament_id:team?.tournament_id||'',amount:tournament?.registration_fee??''});}}>
                      {teams.map(tm => <option key={tm.id} value={tm.id}>{tm.team_name}</option>)}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Select Tournament</label>
                    <select className="form-select" required value={formData.tournament_id} disabled={!selectedTeam?.tournament_id} onChange={e => setFormData({...formData, tournament_id: e.target.value})}>
                      {allowedTournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Method</label>
                      <select className="form-select" value={formData.payment_method} onChange={e => setFormData({...formData, payment_method: e.target.value})}>
                        {selectedMethods.includes('gcash')&&<option value="gcash">GCash</option>}
                        {selectedMethods.includes('maya')&&<option value="maya">Maya</option>}
                        {selectedMethods.includes('cash')&&<option value="cash">Cash Over-Counter</option>}
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Amount (₱)</label>
                      <input type="number" step="0.01" min="0.01" max={selectedBalance||undefined} className="form-control" required value={formData.amount} onChange={e=>setFormData({...formData,amount:e.target.value})} aria-describedby="payment-fee-note" />
                    </div>
                  </div>
                  <small id="payment-fee-note" className="text-muted d-block mb-3">Registration fee: ₱{selectedFee.toFixed(2)} · Verified paid: ₱{selectedPaid.toFixed(2)} · Remaining: ₱{selectedBalance.toFixed(2)}. You may pay the full balance or submit a partial installment.</small>
                  {selectedTournament&&<div className="payment-modal-destination mb-3"><i className="bi bi-wallet2"/><span><small>Send to</small><b>{selectedTournament.payment_account_name||'Admin has not posted an account yet'}</b><strong>{selectedTournament.payment_account_number||'Contact the Admin before paying'}</strong></span>{selectedTournament.payment_qr_url&&<a href={receiptUrl(selectedTournament.payment_qr_url)} target="_blank" rel="noreferrer">View QR</a>}</div>}
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Reference Number</label>
                    <input type="text" className="form-control" required value={formData.reference_number} onChange={e => setFormData({...formData, reference_number: e.target.value})} placeholder="e.g. GCASH-1002394812" />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Receipt Photo (proof of payment)</label>
                    <input
                      type="file"
                      className="form-control"
                      required={formData.payment_method!=='cash'}
                      accept="image/jpeg,image/png,image/webp"
                      onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                    />
                    <small className="text-muted d-block mt-1">JPG, PNG, or WEBP up to 5MB. Attached to the submitted payment for verification.</small>
                    {receiptFile && <small className="text-success d-block mt-1"><i className="bi bi-check-circle-fill me-1" />{receiptFile.name}</small>}
                  </div>
                </div>
                <div className="modal-footer border-top">
                  <button type="button" className="btn btn-light btn-sm" onClick={() => setShowSubmitModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-evsu btn-sm" disabled={!selectedTeam || !selectedTournament || !(Number(formData.amount)>0) || Number(formData.amount)>selectedBalance || (formData.payment_method!=='cash'&&!receiptFile)}>Submit for Verification</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentVerificationView;
