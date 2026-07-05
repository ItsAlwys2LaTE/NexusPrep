# [NexusPrep](https://nexus-prep-navy.vercel.app/)

**The Intelligent Academic Strategist**

🔗 **Live app:** [nexus-prep-navy.vercel.app](https://nexus-prep-navy.vercel.app/) — frontend on Vercel, backend on Render, database on MongoDB Atlas.

NexusPrep is an AI-driven educational platform that converts raw academic material — textbooks, lecture notes, formula sheets, and previous year question papers — into interactive, data-driven study experiences. It combines OCR-backed document ingestion, Google Gemini-powered content extraction, KaTeX-rendered mathematics, and an Ebbinghaus-curve spaced-repetition engine, with all user data, statistics, and flashcard decks persisted centrally in MongoDB for full cross-device access.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Core Features](#2-core-features)
3. [Architecture](#3-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Backend Components](#5-backend-components)
6. [Frontend Components](#6-frontend-components)
7. [Data Models](#7-data-models)
8. [API Reference](#8-api-reference)
9. [Cloud Flashcard Storage & Spaced Repetition](#9-cloud-flashcard-storage--spaced-repetition)
10. [Mathematical Rendering Pipeline](#10-mathematical-rendering-pipeline)
11. [Installation & Setup](#11-installation--setup)
12. [Environment Variables](#12-environment-variables)
13. [Project Structure](#13-project-structure)
14. [Credits](#14-credits)

---

## 1. System Overview

NexusPrep operates in two distinct modes:

- **Normal Mode** — ingests one or more study-material PDFs and produces a subject title, chapter takeaways, extracted formulas, and 15–20 flashcards.
- **Exam Mode** — ingests a set of Study Notes *and* a set of Previous Year Question Papers (PYQs), semantically validates that both belong to the same subject, cross-references them, and produces high-yield topics, strategic insights, 10+ predicted descriptive questions (4- and 8-mark), a difficult MCQ quiz, and flashcards.

Every flashcard deck generated from either mode is persisted server-side in MongoDB and scheduled for spaced-repetition revision, with automated email reminders when a deck falls overdue.

The system is a two-tier application:

- A **FastAPI** backend (`main.py`) that owns all AI orchestration, document parsing, authentication, and data persistence.
- A **React (Vite)** single-page frontend (`App.jsx`) that owns all UI, client-side session state, and math rendering.

There is no separate database layer or ORM — the backend talks to MongoDB directly through the `motor` async driver.

---

## 2. Core Features

| Feature | Description |
|---|---|
| Email/OTP registration | 6-digit OTP emailed via the Brevo transactional email API, 10-minute expiry, required to complete registration |
| Resend OTP | A 60-second cooldown on the OTP screen, after which the user can request a fresh code without leaving the flow |
| Password reset | Generates and emails a new random temporary password |
| Personalized AI context | Optional per-user context (age, education level) injected into every Gemini prompt |
| Normal Mode analysis | Chapter summary, key formulas, and flashcards from up to 5 PDFs |
| Exam Mode strategy | Cross-referenced Notes + PYQs → high-yield topics, strategic insights, predicted questions, MCQ quiz, flashcards |
| OCR fallback | Automatic Gemini Vision OCR for scanned/image-based PDFs where native text extraction yields too little text |
| Cloud flashcard decks | All decks stored in MongoDB (`flashcards_collection`), fetched by email, fully synced across devices |
| Ebbinghaus spaced repetition | Revision intervals of 1, 3, 7, 14, and 30 days, computed server-side and advanced on every completed revision |
| Automated revision reminders | Email dispatched when a deck is overdue, throttled to at most once per 24h per user, respecting user opt-outs |
| Legacy localStorage → cloud migration | One-time client-side import of any pre-existing local decks into MongoDB, idempotent by deck ID |
| Quiz mode | Interactive MCQ quiz generated from Normal or Exam Mode output |
| Study statistics | Per-user counters (docs processed, PYQs analyzed, strategies generated, quizzes taken, cards learned, study streak) |
| AI resilience | Rolling fallback across three Gemini model versions with exponential backoff on rate limits |
| Inactivity auto-logout | Session cleared after 30 minutes of no user interaction, unless "stay signed in" was selected at login |

---

## 3. Architecture

```
┌──────────────────────────┐          ┌───────────────────────────────┐
│   React SPA (Vite)       │  HTTPS   │   FastAPI (Uvicorn ASGI)      │
│   App.jsx                │◄────────►│   main.py                     │
│  - Auth / Profile views  │  JSON    │  - Auth & profile endpoints   │
│  - Normal / Exam modes   │          │  - Flashcard deck endpoints   │
│  - Flashcards / Quiz     │          │  - AI orchestration           │
│  - KaTeX math rendering  │          │  - OCR fallback pipeline      │
│  - three.js ambient bg   │          └───────────────┬───────────────┘
└──────────────────────────┘                          │
                                                        │ motor (async)
                                        ┌───────────────▼───────────────┐
                                        │           MongoDB              │
                                        │  users · otps · flashcard_decks│
                                        └───────────────┬───────────────┘
                                                        │
                                        ┌───────────────▼───────────────┐
                                        │  Google Gemini API             │
                                        │  (gemini-2.5-flash → 3.1-flash-│
                                        │   lite → 3.5-flash fallback)   │
                                        └────────────────────────────────┘
```

The frontend holds no persistent client-side state beyond the current session (`sessionStorage`/`localStorage` cache of the logged-in user object) — flashcard decks, profile settings, and statistics are the source-of-truth in MongoDB and are re-fetched or re-derived from the backend on each relevant action.

---

## 4. Technology Stack

### Backend
- **FastAPI** — async HTTP framework, served by **Uvicorn**
- **python-multipart** — required by FastAPI to parse the `multipart/form-data` file uploads used by `/api/summarize` and `/api/exam-strategy`
- **Motor** (`AsyncIOMotorClient`) — async MongoDB driver
- **PyMuPDF (`fitz`)** — native PDF text extraction
- **Pillow (`PIL`)** — rasterizes PDF pages to images for the OCR fallback path
- **google-generativeai** SDK — used for document validation and OCR calls (Google has deprecated this SDK in favor of `google.genai`; it still functions, but a future migration is worth planning)
- **aiohttp** — used both for the heavier structured-JSON Gemini calls (manual retry/backoff, bypassing the SDK) and for dispatching transactional email via the Brevo HTTP API
- **json-repair** — tolerantly parses AI-generated JSON that may contain minor formatting issues
- **certifi** — TLS certificate bundle for the MongoDB Atlas connection
- **hashlib** (standard library) — SHA-256 password hashing
- **uuid** (standard library) — deck ID generation

### Frontend
- **React** (functional components + hooks, no external state library)
- **Vite** — build tool / dev server
- **Tailwind CSS** — utility-first styling
- **three.js** — ambient animated background geometry
- **lucide-react** — icon set
- **KaTeX** (`0.16.8`) — loaded dynamically from a CDN at runtime (not an npm dependency) for LaTeX rendering

---

## 5. Backend Components

All backend logic lives in a single `main.py` module, organized into clearly delimited sections.

### 5.1 Email Sender Utility
`send_email(to_email, subject, message_body)` is an async function that sends plain-text email via the **Brevo** transactional email HTTP API (`POST https://api.brevo.com/v3/smtp/email`), authenticated with a `BREVO_API_KEY` and sent from a single Brevo-verified sender address (`BREVO_FROM_EMAIL`) — no domain ownership required, just a verified sender. It returns `True`/`False` rather than silently swallowing failures, and every caller (OTP send, password reset, reminder dispatch) checks that result and raises a proper error if the send genuinely failed, so a misconfigured or rejected email is never reported to the user as a false "success."

This replaced an earlier `smtplib`-based Gmail SMTP implementation, which worked locally but silently failed in production: most PaaS hosts (Render included) block outbound SMTP ports (25/465/587) on all plans to prevent spam abuse, so the switch to an HTTP-based email API was necessary for the hosted deployment to actually deliver mail.

### 5.2 Gemini API Key Configuration & Fallback Logic
Two API keys (`GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, falling back to a shared `GEMINI_API_KEY`) allow the two halves of a single request (e.g. summary + definitions) to be dispatched under separate keys/quotas concurrently.

`ACTIVE_MODELS = ["gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-3.5-flash"]` defines a rolling fallback array. Two distinct call paths exist:

- **`call_gemini_with_fallback(contents)`** — uses the official SDK (`genai.GenerativeModel(...).generate_content_async`). Used for lightweight tasks: document-validity checks and OCR text extraction from page images. On any exception it moves to the next model in the array; if all models fail it raises a `500`.
- **`fetch_gemini_json(prompt, api_key, retries=5)`** — uses raw `aiohttp` calls directly against the `generateContent` REST endpoint with `generationConfig.responseMimeType = "application/json"`, forcing Gemini's own constrained JSON output. Used for all heavy structured-content generation (summaries, formulas, definitions, exam strategy, quiz/QA). On HTTP 429 it retries with exponential backoff (`2^i + random jitter` seconds); on 404 or other non-200 statuses it moves to the next fallback model. The raw response text is parsed with `json_repair.loads(...)` rather than strict `json.loads`, tolerating minor AI-introduced formatting issues, and returns `{}` on unrecoverable parse failure rather than raising.

### 5.3 MongoDB Setup
A single Motor client connects (via `certifi`'s CA bundle, required for many managed MongoDB Atlas clusters) to a database named `smart_study`, exposing three collections:

| Collection | Purpose |
|---|---|
| `users` | One document per registered user: credentials, profile fields, preference toggles, and lifetime statistics |
| `otps` | Transient OTP codes keyed by email, with an expiry timestamp |
| `flashcard_decks` | One document per flashcard deck, keyed by a generated `id` + owning `email` |

If `MONGODB_URL` is not set, the app still boots (so the frontend can be developed against), but every database-backed route will fail at call time.

### 5.4 Pydantic Schemas
Request bodies are validated with Pydantic models: `LoginModel`, `SendOTPModel`, `ResetModel`, `RegisterModel`, `ProfileUpdateModel`, `StatUpdateModel`, `ReminderDispatchModel`, `FlashcardModel`, `DeckCreateModel`, `DeckEmailModel`, `DeckImportModel` (full field listing in [§7](#7-data-models)).

### 5.5 Auth & Profile Endpoints
Implements OTP-gated registration, login, password reset, and profile updates. Passwords are hashed with SHA-256 (`hash_password`) before storage — see [§14](#14-known-limitations) for a note on this. Full endpoint behavior is documented in [§8](#8-api-reference).

### 5.6 Flashcard Deck Endpoints (Cloud Storage)
The most recently added subsystem. Documented in full in its own section: [§9](#9-cloud-flashcard-storage--spaced-repetition).

### 5.7 AI PDF Processing Pipeline
- **`ocr_semaphore = asyncio.Semaphore(3)`** — a global concurrency limiter ensuring at most 3 PDF pages are OCR'd at once across all concurrent requests, protecting server memory during heavy load.
- **`extract_text_with_fallback(file)`** — opens the uploaded PDF with PyMuPDF and extracts native text from every page. If the combined extracted text is shorter than 50 characters (a strong signal the PDF is scanned/image-based rather than text-based), it falls back to rendering each page to a 2×-scaled RGB image (`page.get_pixmap`) and sending each image to Gemini via `call_gemini_with_fallback` with an "extract all text exactly as it appears" instruction, respecting the semaphore. If no text can be extracted by either path, a `400` is raised naming the offending file.
- **`construct_personal_context(user_context_str)`** — parses the JSON-encoded personalization payload sent from the frontend (age + education level) into a short instruction string injected into every generation prompt, so explanations are pitched at the right level. Fails silently (returns `""`) on malformed input.
- **`MATH_FORMATTING_RULES`** — a shared block of prompt instructions enforcing a consistent LaTeX convention across every AI-generated field. See [§10](#10-mathematical-rendering-pipeline) for the full rationale and rule set.
- **`POST /api/summarize`** (Normal Mode) and **`POST /api/exam-strategy`** (Exam Mode) — the two main generation endpoints, detailed in [§8](#8-api-reference).

Both generation endpoints follow the same overall shape: extract text → run a lightweight validity/subject-match check via `call_gemini_with_fallback` → fire 2–3 concurrent `fetch_gemini_json` tasks (staggered by 0.5s each to avoid burst rate-limiting) against different prompts covering different parts of the output shape → merge the JSON results into a single response payload.

---

## 6. Frontend Components

`App.jsx` is a single-file React application. Key building blocks, top to bottom:

| Component / Function | Responsibility |
|---|---|
| `formatName`, `validatePassword` | Small pure helpers: name capitalization, password strength validation |
| `MathRenderer` | Renders a single inline (`$...$`) or block (`$$...$$`) math expression via KaTeX, lazy-loading the KaTeX JS/CSS from CDN on first use; falls back to plain text on a render error |
| `FormattedText` | Splits arbitrary AI-generated prose on `$...$` / `$$...$$` boundaries, strips markdown bold markers, strips any dangling unmatched `$$`, and renders each math segment through `MathRenderer` |
| `DynamicBackground` | Ambient animated three.js particle/geometry background, pausable |
| `StatPopCard`, `UploadCard`, `ProcessingIndicator`, `EbbinghausCurve`, `NexusLogo` | Presentational building blocks used across views |
| `AuthView` | Login, registration (with OTP step + 60s resend cooldown), and password-reset flows |
| `HomeView` / `ResultsDashboardView` | Normal Mode upload UI and results dashboard (summary, formulas, quiz/flashcard launch) |
| `ExamModeView` / `ExamResultsDashboard` / `QuestionAccordion` | Exam Mode upload UI (separate Notes/PYQs dropzones) and its results dashboard |
| `QuizView` | Interactive MCQ quiz runner with scoring |
| `FlashcardsView` | Flip-card revision UI; on completing a session calls back to mark the deck revised or to stop future reminders |
| `ActivityGraph` | Renders the user's study-streak / activity statistics |
| `ProfileView` | Profile editing, preference toggles, password change, statistics tab, and the **Saved Decks** tab (cloud-backed deck library, launch/delete) |
| `App` (default export) | Top-level shell: session bootstrap from storage, view routing, inactivity auto-logout, notification queue, overdue-revision check, and all handlers that call the backend (`handleFileUpload`, `handleStartFlashcards`, `handleRevisionComplete`, `handleStopRevision`, `handleStatsIncrement`, etc.) |

### 6.1 Session Persistence
On mount, `App` reads a cached user object from `sessionStorage` first, then `localStorage`, via a lazy `useState` initializer. Whichever storage is used depends on whether "stay signed in" was checked at login: checked → `localStorage` (survives browser restarts); unchecked → `sessionStorage` (cleared when the tab/window closes) plus a 30-minute inactivity auto-logout timer.

### 6.2 Notifications
A simple in-memory notification queue (`notifications` state) surfaces transient messages — most notably overdue-revision alerts computed on login (see [§9](#9-cloud-flashcard-storage--spaced-repetition)).

---

## 7. Data Models

### 7.1 `users` collection
```json
{
  "email": "string (unique)",
  "password": "sha256 hex digest",
  "name": "string",
  "age": "string",
  "educationLevel": "string",
  "educationSubOption": "string",
  "usePersonalContext": true,
  "storeFlashcards": true,
  "emailReminders": true,
  "studyStreak": 1,
  "totalCardsLearned": 0,
  "docsProcessed": 0,
  "pyqsAnalyzed": 0,
  "strategiesGenerated": 0,
  "quizzesTaken": 0
}
```

### 7.2 `otps` collection
```json
{
  "email": "string",
  "otp": "6-digit string",
  "expires_at": "datetime (UTC, +10 minutes from issue)"
}
```
Upserted on send, deleted on successful registration.

### 7.3 `flashcard_decks` collection
```json
{
  "id": "uuid4 hex string",
  "email": "string (owner)",
  "title": "string",
  "cards": [{ "term": "string", "definition": "string" }],
  "timestamp": "int (ms since epoch, creation time)",
  "revisionCount": 0,
  "lastRevised": "int (ms since epoch)",
  "nextRevisionDate": "int (ms since epoch)",
  "stopRevision": false
}
```

---

## 8. API Reference

All routes are prefixed with `/api`. All request/response bodies are JSON unless noted.

### Auth & Profile

| Method | Path | Body | Notes |
|---|---|---|---|
| `POST` | `/auth/send-otp` | `{ email }` | Rejects if email already registered. Generates and emails a 6-digit OTP, valid 10 minutes. |
| `POST` | `/auth/register` | `{ email, password, name, age, educationLevel, educationSubOption, otp }` | Validates OTP + expiry, creates the user document with default preference/statistic fields, deletes the consumed OTP. Returns the created user (minus password). |
| `POST` | `/auth/login` | `{ email, password }` | Returns the full user document (minus password) on success, `401` otherwise. |
| `POST` | `/auth/reset` | `{ email }` | Generates a random strong temporary password, emails it, and overwrites the stored password hash. |
| `PUT` | `/profile/update` | `{ email, name, age, educationLevel, educationSubOption, usePersonalContext, storeFlashcards, emailReminders, newPassword? }` | Updates profile fields; if `newPassword` is non-empty, also updates the password hash. `404` if user not found. |
| `POST` | `/stats/increment` | `{ email, stat, value }` | Atomically `$inc`s an arbitrary numeric field on the user document (e.g. `docsProcessed`, `quizzesTaken`). |
| `POST` | `/reminders/dispatch` | `{ email, message, subject? }` | Sends an email reminder, but only if the user hasn't opted out via `emailReminders` or `storeFlashcards`. |

### Flashcard Decks (Cloud Storage)

| Method | Path | Body / Query | Notes |
|---|---|---|---|
| `GET` | `/flashcards/decks?email=` | — | Returns all decks owned by the email, newest first, with legacy documents backfilled to the current schema. |
| `POST` | `/flashcards/decks` | `{ email, title, cards: [{term, definition}] }` | Creates a new deck with a fresh `uuid4` id, `revisionCount: 0`, and `nextRevisionDate` set 1 day out. |
| `POST` | `/flashcards/decks/import` | `{ email, decks: [...] }` | Idempotent bulk-import (by deck `id`) used once per user to migrate pre-existing `localStorage` decks into MongoDB. |
| `PUT` | `/flashcards/decks/{deck_id}/revision` | `{ email }` | Marks a revision complete: increments `revisionCount`, advances `nextRevisionDate` by the next Ebbinghaus interval, clears `stopRevision`. `404` if not found. |
| `PUT` | `/flashcards/decks/{deck_id}/stop` | `{ email }` | Sets `stopRevision: true`, halting future overdue reminders for that deck. |
| `DELETE` | `/flashcards/decks/{deck_id}?email=` | — | Deletes a single deck owned by that email. |

### AI Generation

| Method | Path | Body (multipart/form-data) | Notes |
|---|---|---|---|
| `POST` | `/summarize` | `files[]` (≤5 PDFs), `userContext?` | Normal Mode. Returns `{ title, summary_points[], formulas[], definitions[] }`. `400` on validation failure or >5 files. |
| `POST` | `/exam-strategy` | `notes_files[]` (≤5), `pyqs_files[]` (≤5), `userContext?` | Exam Mode. Returns `{ title, highYieldTopics[], strategicInsights[], formulas[], predictedQuestions[], definitions[] }`. `400` on subject-mismatch or file-count violations. |

---

## 9. Cloud Flashcard Storage & Spaced Repetition

This is the subsystem most recently migrated from client-side `localStorage` to server-side MongoDB persistence, enabling a user's decks to follow them across any device.

**Storage.** Every deck a user generates (from either Normal or Exam Mode) is created server-side via `POST /flashcards/decks` and stored in the `flashcard_decks` collection, scoped by the owner's `email`. The frontend never writes deck content to `localStorage` going forward — the Profile view's "Saved Decks" tab fetches the full list from `GET /flashcards/decks` on mount (showing a loading state while in flight), and deleting a deck calls `DELETE /flashcards/decks/{id}` with an optimistic UI update that reverts if the request fails.

**Spaced repetition.** The revision schedule follows the Ebbinghaus Forgetting Curve using expanding intervals of **1, 3, 7, 14, and 30 days** (`REVISION_INTERVALS_DAYS`), computed entirely server-side by `get_next_revision_interval(revision_count)` — the interval used is `REVISION_INTERVALS_DAYS[min(revision_count, 4)]`, so after 5+ completed revisions the interval plateaus at 30 days. Completing a revision (`PUT /flashcards/decks/{id}/revision`) increments `revisionCount`, recomputes `nextRevisionDate` from the current server time, and clears any previous `stopRevision` flag.

**Overdue detection & reminders.** On login, the frontend fetches all decks and filters for `nextRevisionDate < now && !stopRevision`. Any overdue decks surface as an in-app notification; additionally, if the user hasn't opted out (`emailReminders !== false`), an email reminder is dispatched via `POST /reminders/dispatch`, client-side throttled to at most once per 24 hours per user (tracked via a `localStorage` timestamp — this throttle key is the one piece of reminder logic that intentionally remains local, since it's a UI-level rate limit rather than deck data).

**Per-deck opt-out.** A user can stop future reminders for an individual deck (`PUT /flashcards/decks/{id}/stop`) without affecting other decks or their global `emailReminders` preference.

**Legacy migration.** On first login after this feature shipped, the frontend checks for a pre-existing `smartstudy_decks_{email}` entry in `localStorage`. If found, it is bulk-imported via `POST /flashcards/decks/import` — a `$setOnInsert` upsert keyed on deck `id`, making the import safe to run more than once — and then the local copy is removed so it is never re-imported or read from that device again.

---

## 10. Mathematical Rendering Pipeline

Formulas, variables, and Greek letters generated by the AI are wrapped in inline `$...$` or block `$$...$$` LaTeX delimiters and rendered client-side by **KaTeX**. This pipeline went through several correctness fixes and now follows a strict, explicit convention, enforced via the shared `MATH_FORMATTING_RULES` prompt block sent with every generation request:

1. No markdown (`**bold**`, `*italics*`) in plain-text fields.
2. No LaTeX structural environments (`\begin{itemize}`, etc.).
3. Every mathematical symbol, formula, or Greek letter must be wrapped in `$...$` / `$$...$$`, and every delimiter opened must be closed — no dangling `$`/`$$`.
4. Greek letters must be written as LaTeX commands (`$\rho$`), never spelled out (`"rho"`).
5. LaTeX commands use a **single** backslash and **single** curly braces, exactly as in a normal `.tex` file (`\frac{a}{b}`, not `\frac{{a}}{{b}}` or `\\frac{a}{b}`) — because the API call already requests `responseMimeType: application/json`, Gemini's own constrained decoding handles JSON-escaping automatically; any manual pre-escaping by the model results in double-escaped, unrenderable output.
6. The `equation` field of a formula object must contain **only** raw LaTeX with no `$`/`$$` wrapper at all, since the frontend already renders that field as display math automatically — `$`/`$$` delimiters are only meaningful inside prose fields like `explanation` or `summary_points`.

**Frontend defenses.** Even with the above prompt discipline, `MathRenderer` and `FormattedText` are hardened against occasional AI slips:
- `MathRenderer` trims the input and strips leading/trailing `$` or `$$` independently (rather than requiring a single anchored symmetric pattern), so an asymmetric wrap (e.g. a trailing `$$` with no matching opening one) is still handled gracefully.
- `FormattedText` strips any leftover dangling `$$` sequences that didn't pair up during splitting, so an unmatched delimiter degrades to invisible rather than leaking into the UI as literal text.
- `MathRenderer`'s container only applies `overflow-x-auto` to **block**-level equations (where genuinely long formulas may need horizontal scroll on narrow screens); inline math has no overflow styling, avoiding spurious scrollbar artifacts on short inline symbols.
- Formula titles, high-yield topic chips, and dashboard titles are all routed through `FormattedText` rather than rendered as raw strings, so any `$...$` the AI includes in a title actually renders instead of showing literal dollar signs.

---

## 11. Installation & Setup

### Prerequisites
- Node.js v18+
- Python 3.10+
- A MongoDB cluster URI (e.g. MongoDB Atlas)
- One or two Google Gemini API keys
- A [Brevo](https://www.brevo.com) account with a verified sender email (for OTP/reset/reminder emails) — free tier, no domain required

### 11.1 Backend Setup

```bash
# from the backend directory
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt
```

Create a `.env` file in the backend root:

```dotenv
# Database
MONGODB_URL=mongodb+srv://<username>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority

# AI Engine Keys
GEMINI_API_KEY_1=your_primary_gemini_key
GEMINI_API_KEY_2=your_secondary_gemini_key_for_load_balancing

# Email Dispatch (Brevo API)
BREVO_API_KEY=your_brevo_api_key
BREVO_FROM_EMAIL=your_verified_sender@example.com
```

Start the server:

```bash
uvicorn main:app --reload --port 8000
```

The API will be live at `http://127.0.0.1:8000/api`.

### 11.2 Frontend Setup

```bash
# from the frontend directory
npm install
npm install three lucide-react
```

The frontend reads the backend URL from `import.meta.env.VITE_API_BASE`, falling back to `http://127.0.0.1:8000/api` if unset — so local development works with zero configuration. To point it at a different backend, create a `frontend/.env.local` with:
```dotenv
VITE_API_BASE=http://127.0.0.1:8000/api
```

Start the dev server:

```bash
npm run dev
```

### 11.3 Verifying the Setup
1. Open the frontend URL printed by Vite (typically `http://localhost:5173`).
2. Register a new account — confirm the OTP email arrives (and that "Resend OTP" works after the 60s cooldown).
3. Upload a sample study PDF in Normal Mode and confirm a summary, formulas, and flashcards are generated.
4. Open the flashcards, complete a revision, and check the Profile → Saved Decks tab to confirm the deck (and its updated revision schedule) round-trips through MongoDB.

### 11.4 Production Deployment
The live instance runs on **Vercel** (frontend) + **Render** (backend) + **MongoDB Atlas** (database). See `DEPLOYMENT_GUIDE.md` for the full step-by-step (repo setup, environment variables per host, MongoDB network access, CORS tightening) and `BREVO_SETUP_GUIDE.md` for the transactional email provider setup specifically.

---

## 12. Environment Variables

| Variable | Required | Used By | Description |
|---|---|---|---|
| `MONGODB_URL` | Yes | All DB-backed routes | MongoDB connection string |
| `GEMINI_API_KEY_1` (or `GEMINI_API_KEY`) | Yes | AI generation & OCR | Primary Gemini API key |
| `GEMINI_API_KEY_2` | No (falls back to key 1) | AI generation | Secondary key, used for the second concurrent generation task to spread quota usage |
| `BREVO_API_KEY` | No* | `send_email` | API key from Brevo → SMTP & API → API Keys |
| `BREVO_FROM_EMAIL` | No* | `send_email` | The sender address verified in Brevo → Senders |

\* Brevo variables are not strictly required for the app to boot, but OTP-based registration, password reset, and revision reminder emails will fail with a clear `500` error (rather than silently no-op) if they're missing or invalid.

---

## 13. Project Structure

```
nexusprep/
├── backend/
│   ├── main.py              # FastAPI app: auth, profile, decks, AI endpoints
│   ├── requirements.txt     # pip install -r requirements.txt
│   └── .env                 # MongoDB URL, Gemini keys, Brevo credentials (not committed)
├── frontend/
│   ├── src/
│   │   └── App.jsx          # Entire SPA: views, components, state, API calls
│   ├── index.html
│   └── package.json
├── DEPLOYMENT_GUIDE.md       # Step-by-step Render + Vercel deployment walkthrough
└── BREVO_SETUP_GUIDE.md      # Step-by-step Brevo transactional email setup
```

---

## 14. Credits

Developed by: **Anupam Sharma**
