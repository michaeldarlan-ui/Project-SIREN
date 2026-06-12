# SIREN
**Sales Intelligence, Review & Enablement Network**

SIREN is a sales call grading and coaching platform powered by Claude AI. It analyzes call transcripts, scores rep performance across five coaching dimensions, surfaces actionable feedback, and gives sales teams the tools to practice and improve.

---

## Modules

### PULSE
Real-time analytics dashboard — calls graded, average scores, rep leaderboards, industry breakdowns, partner performance, API cost tracking, and a full recent call history feed.

### ENGAGE
The core call grader. Paste or upload a transcript, and SIREN analyzes it across five coaching dimensions, assigns a letter grade, identifies SPICED coverage, generates rep-level scores when multiple speakers are present, and outputs recommended next steps.

### COACH
Rep-specific coaching hub with two panels:
- **Dashboard** — Score trends, stage distribution, call history, recognized strengths, and focus areas per rep.
- **RANGE** — Live scenario practice engine. Reps select a scenario type (cold outreach, discovery, objection handling, etc.) and difficulty level, then run a multi-turn coaching conversation with Claude. Scenarios are filtered by the rep's role — a Solutions Engineer won't see cold outreach scenarios, for example.
- **INTEL** — Freeform query panel. Ask any question about a rep's performance data and get a Claude-powered answer with context from their call history.

### ATLAS
Interactive deal lifecycle graph showing account nodes, graded calls, contacts, and asset relationships. Includes zoom, fit, and call-collapse controls.

### VIGIL
Account action feed — surfaces critical items, open tasks, and cleared accounts with risk and status tracking.

### FORGE
Report template engine. Generate Call Briefs, Follow-Up Emails, and Executive Summaries from graded call data, with audience toggle (internal vs. client-facing).

### SCOPE
Structured prospect environment questionnaire covering engagement overview, organization profile, environment sizing, security posture, and compliance drivers.

---

## Grading Rubric

Calls are scored out of 100:

| Dimension | Points |
|-----------|--------|
| Value Framing & Demo Delivery | 25 |
| Tactical Empathy & Objection Handling | 25 |
| Discovery & Needs Confirmation | 20 |
| Qualification & Deal Mechanics | 15 |
| Call Control & Next Steps | 15 |
| **Total** | **100** |

**Letter grades:** A+ (97–100) through F (0–59) with full +/− steps.

SPICED framework coverage (Situation, Pain, Impact, Critical Event, Evolution, Decision) is evaluated separately and reported as touched/untouched flags with summaries.

---

## Tech Stack

- **Frontend** — Vanilla JavaScript, no build step
- **Backend** — Node.js 18+ — serves static files and proxies the Claude API
- **Database** — [Turso](https://turso.tech) (hosted SQLite) for multi-device sync, or a local `siren.db` file for single-machine use
- **AI** — [Claude API](https://www.anthropic.com) (Anthropic)

---

## Setup

### 1. Clone & install

```bash
git clone https://github.com/michaeldarlan-ui/Project-SIREN.git
cd Project-SIREN
npm install
```

### 2. Configure environment

Create a `.env` file in the project root:

```env
ANTHROPIC_API_KEY=sk-ant-api03-...

# Optional — omit to use a local siren.db file
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token

# Optional — defaults to 3000
PORT=3000
```

Get your Anthropic API key at [console.anthropic.com](https://console.anthropic.com).

### 3. Run

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000).

For auto-reload during development:

```bash
npm run dev
```

---

## Multi-Device Sync (Turso)

By default SIREN stores data in a local `siren.db` file. To sync across machines, set up a free Turso database:

1. Sign up at [turso.tech](https://turso.tech) and create a database named `siren`
2. Add the database URL and auth token to `.env` on every machine
3. Push your local data to Turso once from the source machine:

```bash
npm run db:push
```

All machines pointing at the same `TURSO_DATABASE_URL` share live data automatically.

---

## Database Scripts

| Command | Description |
|---------|-------------|
| `npm run db:export` | Dump all tables to `data/export.json` |
| `npm run db:import` | Seed local `siren.db` from `data/export.json` |
| `npm run db:push` | Push local `siren.db` to Turso cloud |

---

## Cost

Each graded call uses roughly 1,500–2,000 tokens — well under $0.05 per call at current Claude Sonnet pricing.

---

## Requirements

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com)
