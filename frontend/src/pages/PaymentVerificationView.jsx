import React, { useState, useEffect } from 'react';
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
  const canSubmitPayment = ['admin', 'coach_manager', 'player'].includes(user?.role);
  const canVerifyPayment = ['admin', 'finance_officer'].includes(user?.role);
  const [payments, setPayments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [formData, setFormData] = useState({ team_id: '', tournament_id: '', payment_method: 'gcash', reference_number: '', amount: 500 });
  const [receiptFile, setReceiptFile] = useState(null);

  const loadData = async () => {
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
      if (tData.length > 0) setFormData(prev => ({ ...prev, team_id: tData[0].id }));
      if (tourRes.tournaments?.length > 0) setFormData(prev => ({ ...prev, tournament_id: tourRes.tournaments[0].id }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    try {
      const res = await paymentService.submitPayment(formData);
      if (res?.data?.id && receiptFile) {
        try {
          await paymentService.uploadReceipt(res.data.id, receiptFile);
        } catch (err) {
          alert('Payment submitted but receipt upload failed: ' + (err.response?.data?.message || 'Unknown error'));
        }
      }
      setShowSubmitModal(false);
      setReceiptFile(null);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Payment submission failed');
    }
  };

  const handleVerify = async (paymentId, status) => {
    const remarks = prompt(`Enter remarks for marking as ${status}:`, 'Verified by Finance Officer');
    if (remarks === null) return;
    try {
      await paymentService.verifyPayment(paymentId, status, remarks);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Verification failed');
    }
  };

  const paymentSummary = payments.reduce((summary, payment) => {
    summary[payment.status] = (summary[payment.status] || 0) + 1;
    if (payment.status === 'approved') summary.approvedAmount += Number(payment.amount || 0);
    return summary;
  }, { pending: 0, approved: 0, rejected: 0, approvedAmount: 0 });

  const downloadReport = () => {
    const escapeCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows = [
      ['Date', 'Team', 'Tournament', 'Method', 'Reference Number', 'Amount', 'Status', 'Verified By'],
      ...payments.map(p => [p.created_at, p.team_name, p.tournament_name, p.payment_method, p.reference_number, p.amount, p.status, p.verifier_name || '']),
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
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold text-dark mb-1">
            <i className="bi bi-credit-card-fill text-evsu-primary me-2"></i>
            Digital Payment Verification (GCash / Maya)
          </h3>
          <p className="text-muted small mb-0">Finance Officer verification portal for team registration receipts</p>
        </div>
        <div className="d-flex gap-2">
          {user?.role === 'finance_officer' && <button className="btn btn-outline-danger" onClick={downloadReport}><i className="bi bi-file-earmark-arrow-down-fill me-1" />Download Report</button>}
          {canSubmitPayment && <button className="btn btn-evsu" onClick={() => setShowSubmitModal(true)}><i className="bi bi-plus-lg me-1"></i> Submit Payment Receipt</button>}
        </div>
      </div>

      {!loading && user?.role === 'finance_officer' && <div className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3"><div className="finance-report-card pending"><i className="bi bi-hourglass-split" /><div><small>Pending Review</small><strong>{paymentSummary.pending}</strong></div></div></div>
        <div className="col-sm-6 col-xl-3"><div className="finance-report-card approved"><i className="bi bi-check-circle-fill" /><div><small>Approved</small><strong>{paymentSummary.approved}</strong></div></div></div>
        <div className="col-sm-6 col-xl-3"><div className="finance-report-card rejected"><i className="bi bi-x-circle-fill" /><div><small>Rejected</small><strong>{paymentSummary.rejected}</strong></div></div></div>
        <div className="col-sm-6 col-xl-3"><div className="finance-report-card revenue"><i className="bi bi-cash-stack" /><div><small>Verified Revenue</small><strong>₱{paymentSummary.approvedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></div></div></div>
      </div>}

      {loading ? (
        <LoadingSpinner message="Loading payment transactions..." />
      ) : (
        <div className="card-custom p-4">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Date</th>
                  <th>Team</th>
                  <th>Tournament</th>
                  <th>Method &amp; Ref No.</th>
                  <th>Amount</th>
                  <th>Receipt</th>
                  <th>Status</th>
                  {canVerifyPayment && <th className="text-end">Finance Action</th>}
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan={canVerifyPayment ? 8 : 7} className="text-center py-4 text-muted">No payment transactions recorded.</td></tr>
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
                      <td>
                        {p.receipt_photo_url
                          ? <a href={receiptUrl(p.receipt_photo_url)} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-secondary"><i className="bi bi-image me-1" />View</a>
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
          </div>
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
                    <select className="form-select" value={formData.team_id} onChange={e => setFormData({...formData, team_id: e.target.value})}>
                      {teams.map(tm => <option key={tm.id} value={tm.id}>{tm.team_name}</option>)}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Select Tournament</label>
                    <select className="form-select" value={formData.tournament_id} onChange={e => setFormData({...formData, tournament_id: e.target.value})}>
                      {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Method</label>
                      <select className="form-select" value={formData.payment_method} onChange={e => setFormData({...formData, payment_method: e.target.value})}>
                        <option value="gcash">GCash</option>
                        <option value="maya">Maya</option>
                        <option value="cash">Cash Over-Counter</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Amount (₱)</label>
                      <input type="number" step="0.01" className="form-control" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Reference Number</label>
                    <input type="text" className="form-control" required value={formData.reference_number} onChange={e => setFormData({...formData, reference_number: e.target.value})} placeholder="e.g. GCASH-1002394812" />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Receipt Photo (proof of payment)</label>
                    <input
                      type="file"
                      className="form-control"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                    />
                    <small className="text-muted d-block mt-1">JPG, PNG, or WEBP up to 5MB. Attached to the submitted payment for verification.</small>
                    {receiptFile && <small className="text-success d-block mt-1"><i className="bi bi-check-circle-fill me-1" />{receiptFile.name}</small>}
                  </div>
                </div>
                <div className="modal-footer border-top">
                  <button type="button" className="btn btn-light btn-sm" onClick={() => setShowSubmitModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-evsu btn-sm">Submit for Verification</button>
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
