# OneAxiom Sales Call Grader

An internal tool for grading sales calls across five coaching dimensions, powered by Claude.

## Setup

**Requirements:** Node.js 18+

### 1. Clone and install

```bash
git clone https://github.com/YOUR_ORG/oa-call-grader.git
cd oa-call-grader
```

No `npm install` needed — zero dependencies.

### 2. Add your API key

```bash
cp .env.example .env
```

Open `.env` and replace the placeholder with your real key:

```
ANTHROPIC_API_KEY=sk-ant-api03-...
```

Get a key at [console.anthropic.com](https://console.anthropic.com).

### 3. Run

```bash
node server.js
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

For auto-reload during development:

```bash
node --watch server.js
```

## How it works

- `server.js` reads your `ANTHROPIC_API_KEY` from `.env` and injects it into the page at request time — only served to `localhost`, never written into any file
- `public/index.html` is the full app — it calls the Anthropic API directly from the browser using the injected key
- `.env` is gitignored, so your key never touches GitHub

## Grading dimensions

| Dimension | Points |
|---|---|
| Discovery & needs confirmation | 20 |
| Value framing & demo delivery | 25 |
| Tactical empathy & objection handling | 25 |
| Qualification & deal mechanics | 15 |
| Call control & next steps | 15 |
| **Total** | **100** |

CMMC positioning is only surfaced if the transcript explicitly mentions DoD contracts, CMMC, or CUI.

## Cost

Each graded call uses ~1,500–2,000 tokens. At Claude Sonnet 4.6 pricing ($3/$15 per million tokens input/output) that's well under $0.05 per call.
