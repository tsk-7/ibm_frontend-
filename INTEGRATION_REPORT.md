# DataInsight Assistant Frontend Integration

## Changed

The real IBM-FRONTEND Vite/React project now has `src/components/assistant/` containing the assistant API client, chat messages, tool activity, citations, confirmation cards, and the main assistant panel. The application shell adds an **AI Assistant** sidebar item, a floating launcher, an assistant route, and a drawer mode that is available from every page.

The browser sends `dataset_id`, message, and prior chat turns to `POST /api/agent/chat`. The dataset ID comes from the active application dataset context. Assistant requests use `VITE_AGENT_API_URL` when set, otherwise they derive the backend host from `VITE_API_BASE_URL` (defaulting to `http://127.0.0.1:8000/api`).

## Implemented

The React application includes a full-page AI Assistant route and a floating assistant drawer. It sends the active dataset ID, current message, conversation ID, and bounded conversation history to the FastAPI agent. Without a selected dataset, it supports general knowledge-base questions.

The UI renders backend answers, read-tool activity, and citations. Destructive actions display a confirmation card and call the confirmation endpoint only after the user confirms. Cancellation leaves data unchanged. Verified results display row and duplicate counts, refresh dataset context, and reload the visible data page.

## Backend contract

The assistant uses `POST /api/agent/chat` and `POST /api/agent/confirm`. It consumes `answer`/`message`, citations with `title` and `source`, and pending actions with `confirmation_id`, `type`, `dataset_id`, and `parameters`. Confirmation responses use `success`, `verified`, and before/after profiles.

## Local development

Set `VITE_API_BASE_URL=/api`. Vite proxies `/api` to `http://127.0.0.1:8000`, keeping browser requests same-origin even when the development server chooses another port. For production, set `VITE_API_BASE_URL` to the full backend API URL; set `VITE_AGENT_API_URL` only when the agent is hosted separately.

## Validation

`npm run typecheck`, `npm run lint`, and `npm run build` pass. Browser smoke tests verified general RAG chat with a rendered knowledge citation and a live dataset question with tool activity and a dataset-grounded answer. The duplicate confirmation endpoints were previously verified live with an unchanged dataset before approval and a verified modification after approval.

The build reports an outdated Browserslist database and a large JavaScript chunk; neither blocks the build.
