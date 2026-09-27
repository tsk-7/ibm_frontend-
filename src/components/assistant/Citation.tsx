import type { Citation as CitationData } from './assistantApi';

export function Citation({ citation }: { citation: CitationData }) {
  return <span className="assistant-citation-pill" title={citation.source}>{citation.category ? `${citation.category} → ` : ''}{citation.title}</span>;
}
