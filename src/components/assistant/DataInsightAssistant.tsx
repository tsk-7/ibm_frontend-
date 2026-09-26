import { FormEvent, useState } from 'react';
import { Bot, MessageSquare, Send, Sparkles, X } from 'lucide-react';
import { sendAgentMessage, type ChatTurn, type PendingConfirmation } from './assistantApi';
import { ChatMessage } from './ChatMessage';
import { ConfirmationCard } from './ConfirmationCard';
import { ToolActivity } from './ToolActivity';

const suggestions = ['Summarize my dataset', 'Show missing values', 'How many duplicate rows?', 'Recommend charts'];

export function DataInsightAssistant({ datasetId, fullPage = false, onClose }: { datasetId: string; fullPage?: boolean; onClose?: () => void }) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const [error, setError] = useState('');

  async function submit(message: string) {
    const trimmed = message.trim();
    if (!trimmed || loading) return;
    setDraft(''); setError(''); setLoading(true); setActiveTools([]);
    const nextTurns: ChatTurn[] = [...turns, { role: 'user', content: trimmed }];
    setTurns(nextTurns);
    try {
      const result = await sendAgentMessage(datasetId, trimmed, turns);
      setActiveTools(result.tools_used || []);
      setPending(result.pending_confirmation || null);
      setTurns([...nextTurns, { role: 'assistant', content: result.message, citations: result.citations, toolsUsed: result.tools_used, pendingConfirmation: result.pending_confirmation }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The assistant could not be reached.');
      setTurns([...nextTurns, { role: 'assistant', content: 'I could not reach the DataInsight agent. Check that the FastAPI backend is running and the API URL is configured.' }]);
    } finally { setLoading(false); }
  }

  function handleSubmit(event: FormEvent) { event.preventDefault(); void submit(draft); }
  function confirm() { void submit('Yes, confirm the pending operation.'); }
  function cancel() { setPending(null); void submit('No, cancel the pending operation.'); }

  return <section className={`assistant-panel ${fullPage ? 'assistant-panel-full' : ''}`}>
    <div className="assistant-panel-header"><div className="assistant-panel-title"><div className="assistant-bot-mark"><Bot size={17} /></div><div><strong>DataInsight Assistant</strong><span>Connected to dataset {datasetId}</span></div></div><div className="assistant-panel-header-actions"><span className="assistant-live-dot" />{onClose && <button className="assistant-icon-button" onClick={onClose} aria-label="Close assistant"><X size={16} /></button>}</div></div>
    <div className="assistant-context-strip"><Sparkles size={13} /><span>Answers are calculated from your active dataset.</span></div>
    <div className="assistant-chat-scroll">
      {turns.length === 0 && <div className="assistant-empty-state"><div className="assistant-empty-icon"><MessageSquare size={20} /></div><h3>Ask about your data</h3><p>Review missing values, duplicates, quality, and chart recommendations.</p><div className="assistant-suggestion-grid">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => void submit(suggestion)}>{suggestion}</button>)}</div></div>}
      {turns.map((turn, index) => <ChatMessage key={`${turn.role}-${index}`} turn={turn} />)}
      <ToolActivity tools={activeTools} loading={loading} />
      {pending && <ConfirmationCard pending={pending} onConfirm={confirm} onCancel={cancel} disabled={loading} />}
      {error && <div className="assistant-error">{error}</div>}
    </div>
    <form className="assistant-composer" onSubmit={handleSubmit}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about your active dataset..." disabled={loading} aria-label="Ask the DataInsight Assistant" /><button type="submit" disabled={loading || !draft.trim()} aria-label="Send message"><Send size={15} /></button></form>
  </section>;
}
