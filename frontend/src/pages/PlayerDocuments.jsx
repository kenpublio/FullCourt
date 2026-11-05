import { useEffect, useState } from 'react';
import eligibilityService from '../services/eligibilityService';
import LoadingSpinner from '../components/LoadingSpinner';

const badge = s => s === 'verified' ? 'bg-success' : s === 'rejected' ? 'bg-danger' : 'bg-warning text-dark';

export default function PlayerDocuments() {
  const [membership, setMembership] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    eligibilityService.getMyMembership()
      .then(r => {
        setMembership(r.membership);
        if (r.membership) return eligibilityService.documents(r.membership.id);
      })
      .then(docs => { if (docs) setDocuments(docs); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading your documents..." />;

  return (
    <div className="container-fluid p-0" style={{ maxWidth: 900 }}>
      <div className="mb-4">
        <h3 className="fw-bold mb-1">
          <i className="bi bi-person-vcard-fill text-evsu-primary me-2" />
          My Eligibility Documents
        </h3>
        <p className="text-muted">
          Your coach uploads the required documents (Birth Certificate/PSA and Parent Waiver) on your behalf.
          Only authorized reviewers can access these private files.
        </p>
      </div>

      {!membership ? (
        <div className="card-custom p-5 text-center">
          <i className="bi bi-people fs-1 text-muted" />
          <h5 className="mt-3">No team membership yet</h5>
          <p className="text-muted mb-0">
            You must be added to a team roster before documents can be submitted.
          </p>
        </div>
      ) : (
        <>
          {/* Eligibility status banner */}
          <div className={`alert d-flex align-items-center gap-2 mb-4 ${
            membership.eligibility_status === 'verified' ? 'alert-success' :
            membership.eligibility_status === 'rejected' ? 'alert-danger' : 'alert-warning'
          }`}>
            <i className={`bi fs-4 ${
              membership.eligibility_status === 'verified' ? 'bi-patch-check-fill' :
              membership.eligibility_status === 'rejected' ? 'bi-x-circle-fill' : 'bi-hourglass-split'
            }`} />
            <div>
              <strong>Eligibility status: </strong>
              <span className="text-capitalize">{membership.eligibility_status}</span>
              {membership.remarks && <p className="mb-0 small mt-1">{membership.remarks}</p>}
            </div>
          </div>

          {/* Required documents checklist */}
          <div className="card-custom p-4 mb-4">
            <h6 className="fw-bold mb-3">
              <i className="bi bi-list-check me-2 text-evsu-primary" />
              Required Documents
            </h6>
            {[
              { type: 'Birth Certificate / PSA', icon: 'bi-file-earmark-person-fill', note: 'Philippine Statistics Authority (PSA) birth certificate or certified true copy.' },
              { type: 'Parent Waiver', icon: 'bi-file-earmark-check-fill', note: 'Signed parental/guardian waiver allowing the student to participate.' },
            ].map(req => {
              const submitted = documents.find(d => d.document_type === req.type);
              return (
                <div key={req.type} className="d-flex align-items-start gap-3 py-3 border-bottom">
                  <i className={`bi ${req.icon} fs-4 mt-1`} style={{ color: 'var(--evsu-primary)' }} />
                  <div className="flex-grow-1">
                    <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                      <div>
                        <b>{req.type}</b>
                        <p className="text-muted small mb-0">{req.note}</p>
                      </div>
                      {submitted ? (
                        <span className={`badge ${badge(submitted.status)}`}>{submitted.status}</span>
                      ) : (
                        <span className="badge bg-secondary">Not yet submitted</span>
                      )}
                    </div>
                    {submitted?.review_notes && (
                      <div className="alert alert-danger py-1 px-2 mt-2 mb-0 small">
                        <i className="bi bi-info-circle me-1" />
                        {submitted.review_notes}
                      </div>
                    )}
                    {submitted?.declared_birth_date && (
                      <small className="text-muted d-block mt-1">
                        Declared birth date: {submitted.declared_birth_date}
                        {submitted.birthdate_match !== null && (
                          <span className={`ms-2 fw-semibold ${submitted.birthdate_match ? 'text-success' : 'text-danger'}`}>
                            {submitted.birthdate_match ? '✓ Matches roster' : '✗ Mismatch — review required'}
                          </span>
                        )}
                      </small>
                    )}
                    {submitted && (
                      <small className="text-muted d-block">
                        Submitted {new Date(submitted.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </small>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Full submission history */}
          <div className="card-custom p-4">
            <h6 className="fw-bold mb-3">
              <i className="bi bi-clock-history me-2 text-evsu-primary" />
              Full Submission History
            </h6>
            {documents.length ? documents.map(d => (
              <div className="d-flex justify-content-between align-items-start border-bottom py-3" key={d.id}>
                <div>
                  <b>{d.document_type}</b>
                  <small className="d-block text-muted">
                    Submitted {new Date(d.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </small>
                  {d.review_notes && <small className="d-block text-danger">{d.review_notes}</small>}
                </div>
                <span className={`badge ${badge(d.status)}`}>{d.status}</span>
              </div>
            )) : (
              <p className="text-muted mb-0">
                <i className="bi bi-file-earmark me-2" />
                No documents have been submitted yet. Your coach will upload them on your behalf.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
