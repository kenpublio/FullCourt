import React, { useEffect, useRef, useState } from 'react';
import paymentService from '../services/paymentService';
import LoadingSpinner from '../components/LoadingSpinner';

const PlayerPayments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const fileRef = useRef(null);
  const [receiptTarget, setReceiptTarget] = useState(null);

  const load = () => paymentService.getPayments().then(setPayments).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const uploadReceipt = async (paymentId, file) => {
    try {
      const res = await paymentService.uploadReceipt(paymentId, file);
      setMessage(res.message || 'Receipt uploaded.');
      setReceiptTarget(null);
      await load();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to upload receipt.');
    }
    setTimeout(() => setMessage(''), 3000);
  };

  if (loading) return <LoadingSpinner message="Loading your payments..." />;

  return (
    <div className="container-fluid p-0 page-enter">
      <div className="d-flex align-items-center gap-2 mb-4">
        <div className="kpi-icon kpi-icon-green" style={{ width: 42, height: 42 }}>
          <i className="bi bi-credit-card-fill" />
        </div>
        <div>
          <span className="section-eyebrow">MY PAYMENTS</span>
          <h4 className="fw-bold mb-0">Payments</h4>
          <small className="text-muted">Your team's tournament payments and official receipts</small>
        </div>
      </div>

      {message && <div className="alert alert-info py-2">{message}</div>}
      {!payments.length && <div className="public-empty"><i className="bi bi-wallet2 display-5 d-block mb-2 opacity-25" />No payment records found for your team yet.</div>}

      <div className="table-responsive">
        <table className="table table-modern align-middle mb-0">
          <thead>
            <tr><th>Tournament</th><th>Team</th><th>Method</th><th>Reference</th><th>Amount</th><th>Status</th><th>Receipt</th></tr>
          </thead>
          <tbody>
            {payments.map(p => (
              <tr key={p.id}>
                <td className="fw-semibold">{p.tournament_name}</td>
                <td>{p.team_name}</td>
                <td><span className="text-uppercase small">{p.payment_method}</span></td>
                <td className="small text-muted">{p.reference_number}</td>
                <td className="fw-bold" style={{ color: 'var(--evsu-primary)' }}>₱{Number(p.amount).toLocaleString()}</td>
                <td>
                  <span className={`badge ${p.status === 'approved' ? 'bg-success' : p.status === 'rejected' ? 'bg-danger' : 'bg-warning text-dark'}`}>{p.status}</span>
                  {p.remarks && <div className="small text-muted mt-1">{p.remarks}</div>}
                </td>
                <td>
                  {p.receipt_photo_url
                    ? <a className="btn btn-sm btn-outline-secondary" href={p.receipt_photo_url} target="_blank" rel="noreferrer"><i className="bi bi-receipt me-1" />View</a>
                    : <button className="btn btn-sm btn-evsu" onClick={() => setReceiptTarget(p)}><i className="bi bi-upload me-1" />Upload</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {receiptTarget && (
        <div className="modal show d-block" style={{ background: 'rgba(20,4,4,.6)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content card-custom border-0 p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold mb-0">Upload Official Receipt</h5>
                <button className="btn-close" onClick={() => setReceiptTarget(null)} />
              </div>
              <p className="text-muted small">Attach a clear screenshot or photo of your GCash/Maya/cash receipt for {receiptTarget.tournament_name}.</p>
              <button className="btn btn-evsu" onClick={() => fileRef.current?.click()}>Choose receipt image</button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden
                onChange={(e) => { if (e.target.files?.[0]) uploadReceipt(receiptTarget.id, e.target.files[0]); }} />
              <button className="btn btn-light mt-2" onClick={() => setReceiptTarget(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerPayments;