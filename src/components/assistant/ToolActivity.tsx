import { CheckCircle2, Loader2, Wrench } from 'lucide-react';

export function ToolActivity({ tools, loading }: { tools: string[]; loading: boolean }) {
  if (!loading && tools.length === 0) return null;
  return <div className="assistant-tool-activity">
    <div className="assistant-activity-title"><Wrench size={13} /> Tool activity</div>
    {loading && <div className="assistant-activity-row"><Loader2 size={13} className="spin" /> Analyzing active dataset...</div>}
    {tools.map((tool) => <div className="assistant-activity-row" key={tool}><CheckCircle2 size={13} /> {tool.split('_').join(' ')}</div>)}
  </div>;
}
