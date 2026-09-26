# DataInsight Assistant Frontend Integration

## Changed

The real IBM-FRONTEND Vite/React project now has `src/components/assistant/` containing the assistant API client, chat messages, tool activity, citations, confirmation cards, and the main assistant panel. The application shell adds an **AI Assistant** sidebar item, a floating launcher, an assistant route, and a drawer mode that is available from every page.

The browser sends `dataset_id`, message, and prior chat turns to `POST /api/agent/chat`. The dataset ID comes from the active application dataset context. Assistant requests use `VITE_AGENT_API_URL` when set, otherwise they derive the backend host from `VITE_API_BASE_URL` (defaulting to `http://127.0.0.1:8000/api`).

## Backend connection

The FastAPI backend at `E:\IBM_Backend\backend` implements all dataset routes used by the frontend and now also implements `/api/agent/chat` for dataset-grounded overview, missingness, duplicates, quality, numerical statistics, and chart suggestions. MySQL is selected through `DATAINSIGHT_DATABASE_URL`; the live `/api/health` endpoint reports `{"status":"ok","database":"ok"}`. The API allows the Vite development origin `http://localhost:5173`.

The chat endpoint is deterministic and uses existing analytics services; it is not an LLM/RAG integration. General knowledge, citations, and confirmation-backed operations need a separately configured agent service. The live MySQL database lists two datasets, but both metadata rows point to files absent from this backend's `data/` directories, so those datasets currently return 404 when loaded. Re-upload their source files through the frontend before querying them.

## Validation

`npm run typecheck`, `npm run lint`, and `npm run build` all pass. The project reports only upstream toolchain/browser database warnings, not build errors.

## Validation

Backend integration tests pass, including an agent chat request. The live backend reports healthy MySQL connectivity and returns the expected Vite CORS header. Frontend typecheck, lint, and production build pass. The Vite UI is running locally; a fresh upload is still needed to verify chat against a dataset whose files exist on this machine.
