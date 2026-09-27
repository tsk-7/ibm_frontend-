export type Citation = {
  title: string;
  source: string;
  category?: string | null;
  chunk_id?: string | null;
  score?: number | null;
};

export type PendingConfirmation = {
  confirmation_id: string;
  type: string;
  dataset_id: string;
  parameters: Record<string, unknown>;
};

export type AgentResponse = {
  answer?: string;
  message?: string;
  dataset_id?: string | null;
  citations?: Citation[];
  tools_used?: string[];
  tool_calls?: { tool: string; status: string; duration_ms?: number }[];
  requires_confirmation?: boolean;
  action?: PendingConfirmation | null;
  pending_confirmation?: PendingConfirmation | null;
  conversation_id?: string;
  success?: boolean;
  verified?: boolean;
  before?: { rows?: number; duplicate_rows?: number };
  after?: { rows?: number; duplicate_rows?: number };
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
const REQUEST_TIMEOUT_MS = 210_000;

async function postAgentRequest<T>(path: string, payload: unknown, action: 'chat' | 'confirm'): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_URL}/api/agent/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text();
      const normalizedDetail = detail.toLowerCase();
      if (/expired|invalid confirmation|confirmation.*invalid/.test(normalizedDetail) || response.status === 409 || response.status === 410) {
        throw new Error('This confirmation is invalid or has expired. Send the request again to get a new confirmation.');
      }
      if (/invalid.*dataset|dataset.*(not found|unavailable)/.test(normalizedDetail) || (action === 'chat' && response.status === 404)) {
        throw new Error('The active dataset is unavailable. Select or upload a dataset and try again.');
      }
      if (/llm|model|openrouter|provider/.test(normalizedDetail)) {
        throw new Error('The AI service is temporarily unavailable. Please try again shortly.');
      }
      if (response.status >= 500) {
        throw new Error('The DataInsight service is temporarily unavailable. Please try again shortly.');
      }
      throw new Error(action === 'confirm'
        ? 'The confirmation could not be processed. Review the request and try again.'
        : 'The assistant could not process this request. Check your message and try again.');
    }

    return await response.json() as T;
  } catch (requestError) {
    if (requestError instanceof Error && requestError.message.startsWith('This confirmation')) throw requestError;
    if (requestError instanceof Error && /^(The active dataset|The AI service|The DataInsight service|The confirmation|The assistant)/.test(requestError.message)) throw requestError;
    if (requestError instanceof DOMException && requestError.name === 'AbortError') {
      throw new Error('The request timed out. Check the service and try again.');
    }
    throw new Error('Could not connect to the DataInsight service. Check that the backend is running.');
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function sendAgentMessage(datasetId: string | null, message: string, history: ChatTurn[], conversationId?: string): Promise<AgentResponse> {
  return postAgentRequest<AgentResponse>('chat', {
    dataset_id: datasetId,
    message,
    conversation_id: conversationId,
    history: history.slice(-40).map(({ role, content }) => ({ role, content })),
  }, 'chat');
}

export async function confirmAgentAction(confirmationId: string, confirm: boolean): Promise<AgentResponse> {
  return postAgentRequest<AgentResponse>('confirm', { confirmation_id: confirmationId, confirm }, 'confirm');
}
