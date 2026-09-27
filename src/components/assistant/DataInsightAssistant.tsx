import { FormEvent, useState } from 'react';
import { Bot, MessageSquare, Send, Sparkles, X } from 'lucide-react';
import { confirmAgentAction, sendAgentMessage, type ChatTurn, type PendingConfirmation } from './assistantApi';
import { ChatMessage } from './ChatMessage';
import { ConfirmationCard } from './ConfirmationCard';
import { ToolActivity } from './ToolActivity';
import { useDataset } from '../../context/DatasetContext';

const datasetSuggestions = ['Summarize my dataset', 'Show missing values', 'How many duplicate rows?', 'Recommend charts'];
const generalSuggestions = ['What is data normalization?', 'How should I handle outliers?', 'Explain standardization', 'How do I choose a chart?'];

export function DataInsightAssistant({ datasetId, fullPage = false, onClose, onDataChanged }: { datasetId: string | null; fullPage?: boolean; onClose?: () => void; onDataChanged?: () => void }) {
  const { refreshDataset } = useDataset();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const [conversationId, setConversationId] = useState('');
  const [error, setError] = useState('');

  async function submit(message: string) {
    const trimmed = message.trim();
    if (!trimmed || loading) return;
    setDraft(''); setError(''); setLoading(true); setActiveTools([]);
    const nextTurns: ChatTurn[] = [...turns, { role: 'user', content: trimmed }];
    setTurns(nextTurns);
    try {
      const result = await sendAgentMessage(datasetId, trimmed, turns, conversationId);
      if (result.conversation_id) setConversationId(result.conversation_id);
      setActiveTools(result.tools_used || []);
      const nextPending = result.action || result.pending_confirmation || null;
      setPending(nextPending?.confirmation_id ? nextPending : null);
      setTurns([...nextTurns, { role: 'assistant', content: result.answer || result.message || 'The assistant returned an empty response.', citations: result.citations, toolsUsed: result.tools_used, pendingConfirmation: nextPending }]);
      if (nextPending && !nextPending.confirmation_id) {
        setError('The agent did not return a valid confirmation ID. Please submit the operation request again.');
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The assistant could not be reached.');
    } finally { setLoading(false); }
  }

  function handleSubmit(event: FormEvent) { event.preventDefault(); void submit(draft); }
  async function resolveConfirmation(confirm: boolean) {
    if (!pending?.confirmation_id || loading) return;
    setLoading(true);
    setError('');
    setActiveTools([]);
    try {
      const result = await confirmAgentAction(pending.confirmation_id, confirm);
      if (result.conversation_id) setConversationId(result.conversation_id);
      setPending(null);
      setActiveTools(result.tools_used || []);
      const baseMessage = result.message || result.answer || (result.success ? 'Action completed.' : 'The action could not be completed.');
      const verification = confirm && result.success && result.verified && result.before?.rows !== undefined && result.after?.rows !== undefined
        ? ` Verified: ${result.before.rows} to ${result.after.rows} rows; ${result.before.duplicate_rows ?? '—'} to ${result.after.duplicate_rows ?? '—'} duplicates.`
        : '';
      const message = `${baseMessage}${verification}`;
      setTurns([...turns, { role: 'assistant', content: message, citations: result.citations, toolsUsed: result.tools_used }]);
      if (result.success && result.verified) {
        await refreshDataset();
        onDataChanged?.();
      }
      if (!result.success) setError(message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The confirmation could not be processed.');
    } finally {
      setLoading(false);
    }
  }

  return <section className={`assistant-panel ${fullPage ? 'assistant-panel-full' : ''}`}>
    <div className="assistant-panel-header"><div className="assistant-panel-title"><div className="assistant-bot-mark"><Bot size={17} /></div><div><strong>DataInsight Assistant</strong><span>{datasetId ? `Connected to dataset ${datasetId}` : 'General knowledge mode'}</span></div></div><div className="assistant-panel-header-actions"><span className="assistant-live-dot" />{onClose && <button className="assistant-icon-button" onClick={onClose} aria-label="Close assistant"><X size={16} /></button>}</div></div>
    <div className="assistant-context-strip"><Sparkles size={13} /><span>{datasetId ? 'Answers can use your active dataset and knowledge base.' : 'Ask general questions using the DataInsight knowledge base.'}</span></div>
    <div className="assistant-chat-scroll">
      {turns.length === 0 && <div className="assistant-empty-state"><div className="assistant-empty-icon"><MessageSquare size={20} /></div><h3>{datasetId ? 'Ask about your data' : 'Ask DataInsight'}</h3><p>{datasetId ? 'Review missing values, duplicates, quality, and chart recommendations.' : 'Explore data preparation, statistics, quality, and visualization guidance.'}</p><div className="assistant-suggestion-grid">{(datasetId ? datasetSuggestions : generalSuggestions).map((suggestion) => <button key={suggestion} onClick={() => void submit(suggestion)}>{suggestion}</button>)}</div></div>}
      {turns.map((turn, index) => <ChatMessage key={`${turn.role}-${index}`} turn={turn} />)}
      <ToolActivity tools={activeTools} loading={loading} />
      {pending && <ConfirmationCard pending={pending} onConfirm={() => void resolveConfirmation(true)} onCancel={() => void resolveConfirmation(false)} disabled={loading} />}
      {error && <div className="assistant-error">{error}</div>}
    </div>
    <form className="assistant-composer" onSubmit={handleSubmit}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={pending ? 'Confirm or cancel the proposed action first...' : datasetId ? 'Ask about your active dataset...' : 'Ask a data question...'} disabled={loading || Boolean(pending)} aria-label="Ask the DataInsight Assistant" /><button type="submit" disabled={loading || Boolean(pending) || !draft.trim()} aria-label="Send message"><Send size={15} /></button></form>
  </section>;
}
