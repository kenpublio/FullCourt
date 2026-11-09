import { createPortal } from 'react-dom';
import './ConfirmActionDialog.css';

const ConfirmActionDialog = ({ open, eyebrow = 'CONFIRM ACTION', title, message, confirmLabel = 'Confirm', confirmIcon = 'bi-check2-circle', danger = true, hideCancel = false, cancelLabel = 'Keep it', onConfirm, onCancel }) => {
  if (!open) return null;
  return createPortal(<div className="fc-confirm-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onCancel();}}><section className="fc-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="fc-confirm-title"><span className="fc-confirm-icon"><i className={`bi ${danger?'bi-exclamation-triangle-fill':'bi-question-circle-fill'}`}/></span><div><small>{eyebrow}</small><h2 id="fc-confirm-title">{title}</h2><p>{message}</p></div><footer>{!hideCancel&&<button type="button" className="btn btn-outline-secondary" onClick={onCancel}>{cancelLabel}</button>}<button type="button" className={`btn ${danger?'btn-danger':'btn-evsu'}`} onClick={onConfirm}><i className={`bi ${confirmIcon} me-2`}/>{confirmLabel}</button></footer></section></div>, document.body);
};

export default ConfirmActionDialog;
