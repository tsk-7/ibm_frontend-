import { Bot, UserRound } from 'lucide-react';
import type { ChatTurn } from './assistantApi';
import { Citation } from './Citation';

export function ChatMessage({ turn }: { turn: ChatTurn }) {
  const isUser = turn.role === 'user';
  return <div className={`assistant-message ${isUser ? 'assistant-message-user' : 'assistant-message-agent'}`}>
    <div className="assistant-message-avatar">{isUser ? <UserRound size={13} /> : <Bot size={14} />}</div>
    <div className="assistant-message-body">
      <div className="assistant-message-label">{isUser ? 'You' : 'DataInsight Assistant'}</div>
      <div className="assistant-message-content">{turn.content}</div>
      {turn.toolsUsed && turn.toolsUsed.length > 0 && <div className="assistant-tool-tags">{turn.toolsUsed.map((tool) => <span key={tool}>{tool.split('_').join(' ')}</span>)}</div>}
      {turn.citations && turn.citations.length > 0 && <div className="assistant-citations"><strong>Knowledge source</strong>{turn.citations.slice(0, 3).map((citation) => <Citation key={`${citation.source}-${citation.chunk_id || citation.title}`} citation={citation} />)}</div>}
    </div>
  </div>;
}
