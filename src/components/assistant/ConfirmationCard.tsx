import { AlertTriangle, Check, X } from 'lucide-react';
import type { PendingConfirmation } from './assistantApi';

export function ConfirmationCard({ pending, onConfirm, onCancel, disabled }: { pending: PendingConfirmation; onConfirm: () => void; onCancel: () => void; disabled?: boolean }) {
  return <div className="assistant-confirmation-card">
    <div className="assistant-confirmation-icon"><AlertTriangle size={15} /></div>
    <div className="assistant-confirmation-copy"><strong>Confirmation required</strong><span>{pending.description}</span><small>This will modify the processed dataset. The original upload remains unchanged.</small></div>
    <div className="assistant-confirmation-actions"><button className="assistant-cancel-button" onClick={onCancel} disabled={disabled}><X size={13} /> Cancel</button><button className="assistant-confirm-button" onClick={onConfirm} disabled={disabled}><Check size={13} /> Confirm</button></div>
  </div>;
}
