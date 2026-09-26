import type { Citation as CitationData } from './assistantApi';

export function Citation({ citation }: { citation: CitationData }) {
  return <span className="assistant-citation-pill">{citation.category ? `${citation.category} → ` : ''}{citation.document.replace('.md', '')}</span>;
}
