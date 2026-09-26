export type Citation = {
  document: string;
  section?: string | null;
  category?: string | null;
  score?: number | null;
};

export type PendingConfirmation = {
  operation_id: string;
  dataset_id: string;
  operation: string;
  parameters: Record<string, unknown>;
  status: 'awaiting_confirmation';
  description: string;
};

export type AgentResponse = {
  message: string;
  dataset_id?: string | null;
  citations?: Citation[];
  tools_used?: string[];
  operations?: Record<string, unknown>[];
  pending_confirmation?: PendingConfirmation | null;
};

export type ChatTurn = {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  toolsUsed?: string[];
  pendingConfirmation?: PendingConfirmation | null;
};

const configuredApiUrl = import.meta.env.VITE_AGENT_API_URL
  || import.meta.env.VITE_API_BASE_URL
  || 'http://127.0.0.1:8000/api';
const API_URL = configuredApiUrl.replace(/\/+$/, '').replace(/\/api$/, '');

export async function sendAgentMessage(datasetId: string, message: string, history: ChatTurn[]): Promise<AgentResponse> {
  const response = await fetch(`${API_URL}/api/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset_id: datasetId, message, history: history.slice(-40).map(({ role, content }) => ({ role, content })) }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Agent request failed (${response.status})`);
  }
  return response.json() as Promise<AgentResponse>;
}
