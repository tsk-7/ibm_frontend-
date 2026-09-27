# IBM DataInsight Studio Frontend

This Vite/React frontend now includes the **DataInsight Assistant** UI. The assistant communicates only with the FastAPI agent API; no OpenRouter credential is used in the browser.

## Assistant integration

Copy `.env.example` to `.env` and set:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

For the Vercel production environment, set `VITE_API_BASE_URL` to `https://datainsight-studio-backend.onrender.com`. Keep `VITE_AGENT_API_URL` unset unless the agent API is hosted separately.

The assistant uses the active dataset ID from application state and sends it with every request to `POST /api/agent/chat`. It uses `VITE_API_BASE_URL` by default; set `VITE_AGENT_API_URL` only when the agent API is hosted separately. The agent URL may be an origin or an API base ending in `/api`.

The assistant is available from the **AI Assistant** sidebar item and the floating launcher. The included backend answers dataset overview, missing-value, duplicate, quality, numerical-statistics, and chart-recommendation questions using its existing services. General knowledge, RAG citations, and confirmation-backed mutations require a separate configured agent; the local endpoint does not claim to provide those capabilities.

The backend is in `E:\IBM_Backend\backend`. Its `.env` selects MySQL, and the running API health check currently reports the database as available. Start it with `uvicorn app.main:app --reload --port 8000` from that directory. The dataset API and assistant use the same base URL unless `VITE_AGENT_API_URL` is set separately.

## Development

```bash
npm install
npm run dev
```

Validation commands:

```bash
npm run typecheck
npm run lint
npm run build
```
