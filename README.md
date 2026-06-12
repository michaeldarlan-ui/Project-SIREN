# SIREN
**Sales Intelligence, Review & Enablement Network**

SIREN is a sales call grading and coaching platform powered by Claude AI. It analyzes call transcripts, scores rep performance across five coaching dimensions, and gives sales teams the feedback and practice tools they need to improve.

---

## Features

| Module | Description |
|--------|-------------|
| **PULSE** | Team performance dashboard — rep scores, call history tiles, and activity overview |
| **FORGE** | Grade a call — paste or upload a transcript and get AI-powered scoring and feedback |
| **COACH** | Rep coaching hub — individual scorecards, RANGE role-play scenarios, and the INTEL query panel |
| **ATLAS** | Deal and opportunity lifecycle tracking |
| **VIGIL** | Live team call monitoring feed |
| **SCOPE** | Sales methodology and process management |

### Grading Rubric
Calls are scored out of 100 across five dimensions:

| Dimension | Weight |
|-----------|--------|
| Value Framing | 25 pts |
| Tactical Empathy & Objection Handling | 25 pts |
| Discovery | 20 pts |
| Qualification | 15 pts |
| Call Control | 15 pts |

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
git clone https://github.com/michaeldarlan-ui/siren.git
cd siren
npm install
```

### 2. Configure environment

Create a `.env` file in the project root:

```env
ANTHROPIC_API_KEY=sk-ant-api03-...

# Optional — omit to use a local siren.db file
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
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

By default SIREN stores data in a local `siren.db` file. To sync your database across machines, set up a free Turso database:

1. Sign up at [turso.tech](https://turso.tech) and create a database named `siren`
2. Copy the database URL and auth token into your `.env` on every machine
3. Push your local data to Turso once from the source machine:

```bash
npm run db:push
```

All machines pointing at the same `TURSO_DATABASE_URL` will share live data automatically.

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
