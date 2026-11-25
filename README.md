# Kesar & Co. Support Copilot — Sumit

> Completed submission package. Credentials remain outside the repository; workflow exports use credential references only.

## 1. Summary

An n8n workflow classifies fictional support emails, uses a tool-calling AI agent to draft grounded replies, checks privacy and policy rules in JavaScript, and writes tickets plus an audit log to Google Sheets. It never sends emails or performs refunds.

- Platform: n8n 2.49.5; configured model: Gemini 3.5 Flash-Lite, temperature 0.
- Live validation: v2 webhook completed all 25 supplied scenarios; local tests pass 21/21.
- Implemented: workflow exports, classifier validation/retry/fallback, two agent tools, sender verification, return rules, ticket upserts, audit upserts, serial test runner and local safety tests.
- Completed: Google Sheets OAuth connection, live v2 execution evidence, generated test report and final workflow exports.
- Google Sheet: the live test sheet is linked below; reviewers can use a copy with their own credentials.
- Recording: required by the assignment; add the final Loom, Google Drive or unlisted YouTube URL below.

## Submission links

- Google Sheet (set sharing to **Anyone with the link → Viewer** before submitting): [Kesar Support](https://docs.google.com/spreadsheets/d/1zUSz8ByY4TbmuB8wdD0WlueOytx-d1vybZA09dz85Yk/edit)
- Screen recording: pending upload. Add the public or reviewer-accessible recording URL before submission.
- Screenshots required by the brief: `workflow.png`, `tickets.png` and `audit_log.png` in `screenshots/`.

The original assignment is preserved in docs/ASSIGNMENT.md.

## 2. Architecture

Webhook → normalize email → LLM classification → validate JSON → retry/fallback if needed → deterministic safety assessment → tool-using drafting agent or log-only route → guard draft → read/update tickets → write audit row → return result.

| Step | Behavior | Reason |
|---|---|---|
| Classification | Seven schema fields, one repair attempt, valid low-confidence fallback | Bad model output must not break intake silently |
| get_order tool | Exact ID lookup, otherwise sender email; ownership check before returning data | The model cannot choose another customer's identity |
| search_faq tool | Returns the complete supplied short FAQ | Keeps exceptions and product facts together without unnecessary retrieval infrastructure |
| Policy checks | IST date calculations, separate damage reporting window, unopened/kit/COD rules | Arithmetic and hard rules belong in code |
| Draft guard | Validates agent JSON/tool use, denies third-party requests, blocks unsupported links and obvious approval claims | Reduces unsafe drafts while retaining human review |
| Tickets | Open ticket lookup, preserve High priority, append unique email IDs | Follow-ups reuse the customer's existing ticket |
| Audit | Upsert by email_id using RAW cell values | One row per email; safe retries; no spreadsheet formulas from customer text |

The workflow exports are in `workflow/`; live execution evidence is summarized in `TEST_REPORT.md`.

## 3. Setup

Follow docs/CONNECTIONS.md. You need an n8n instance, Gemini API credential and Google Sheets connection. Use only the supplied fictional data.

1. Install local n8n with `npm install --prefix .runtime n8n@2.49.5 --no-audit --no-fund`, or use n8n Cloud.
2. For local execution run `powershell -ExecutionPolicy Bypass -File scripts/start-n8n.ps1`.
3. Import the two JSON workflow exports, select the Gemini/Sheets credentials and set the spreadsheet ID on all Sheets nodes.
4. Import the CSV headers into tabs named Audit Log and Tickets.
5. Publish v1 and run `python scripts/run-suite.py --url http://localhost:5678/webhook/kesar-support-v1 --version v1`.
6. Preserve baseline evidence, publish v2, then run the same command using v2 in the URL and version argument. Review all 25 drafts and actions against tests/expectations.json.
7. Run `npm test` for local logic tests. Run `npm run build` after editing source code/prompts to regenerate workflow exports.

Never commit credentials. Local runtime, credential storage, screenshots and raw test results are gitignored. The checked-in report contains sanitized summary evidence.

## 4. Prompts

The exact prompts are in prompts/classifier-v1.md, prompts/classifier-v2.md and prompts/agent.md, and embedded in the exports. The initial setting is Gemini 3.5 Flash-Lite at temperature 0; update this section if the actual model changes. Model temperature does not make outputs fully deterministic. The agent has at most five iterations and only read-only tools.

## 5. Key decisions and assumptions

- Confidence below 0.85 requires review. This is an initial heuristic, not a calibrated probability. Risk flags override high confidence. Returns/refunds and complaints always require a person.
- Ticket deduplication matches an open ticket for a verified order and sender. Unverified requests cannot join somebody else's ticket; their order_id is left blank. Unknown-order requests from the same sender may share a manual-triage ticket, which is a documented limitation.
- Dates use email received_at in IST. Standard returns use calendar-day differences; the exact 48-hour damage boundary is escalated when date-only delivery data cannot establish it.
- Photos listed as attachments have not been examined. Replacements/refunds need human verification.
- The provided data is snapshotted into the export to make imports reproducible. Edit data files and rebuild to refresh it.
- E13 is other + human triage because invoice policy is absent. E17 is other/log-only under the brief even though the FAQ has a partnership contact.
- E08 and E23 use complaint as primary intent and return_refund as secondary. Both needs remain represented.
- Draft guard checks are defense in depth, not a proof of semantic correctness. A human should review drafts before sending.

## 6. Scaling to 1,000 emails/day

The demo serializes processing to avoid Google Sheets read/update races. For production, use a queue, a transactional database with a unique open-ticket constraint and an idempotency key per email, and a separate reporting sync to Sheets. Introduce provider-aware backoff, a dead-letter queue, bounded retry budgets, alerts and privacy-aware retention. A real email connector must provide trusted sender metadata; a public anonymous webhook is not identity authentication. Restrict and authenticate that connector before using real data.

## 7. Product-thinking questions

### Auto-send vs. draft

This build stores drafts only. After a reviewed pilot, I would consider auto-sending straightforward order-status and FAQ replies with verified ownership, supported source facts and confidence at least 0.95. The current threshold of 0.85 only distinguishes normal drafts from human-triage drafts. Returns, complaints, medical questions, identity mismatches, unsupported requests and injections always stay with people regardless of score. I would calibrate thresholds against a labeled validation set rather than trusting the model's self-reported confidence.

### Cost

Illustrative paid-tier estimate, not measured usage: assume 8,000 input tokens and 1,000 output tokens per email across classification and agent calls, including tool context. At Gemini 3.5 Flash-Lite's listed $0.30/M input and $2.50/M output, cost = (8,000 × 0.30 + 1,000 × 2.50)/1,000,000 = $0.0049/email. At 1,000/day for 30 days: $147/month; a 20% retry margin gives $176.40. This excludes hosting/taxes and depends on actual thinking/output tokens and tool iterations. Free-tier testing may cost zero within available quota. Source: https://aistudio.google.com/docs/pricing#gemini-3.5-flash-lite (checked 24 November 2026). Replace assumptions with measured token totals after the live run.

### Success metric

Week-one metric: the share of support drafts a human accepts without a factual, policy or privacy correction. This measures useful work saved while avoiding a misleading count of generated replies. Track the numerator and denominator, sample escalations for missed automation opportunities, and separately treat any privacy disclosure or unauthorized financial approval as a stop condition. If either occurs, disable automated drafting for that route, keep intake/logging and investigate before re-enabling it.

### Failure experience

The customer receives nothing automatically. A failed classifier produces a valid fallback and a human-review flag; a failed agent produces a cautious handoff draft. If Google Sheets fails, n8n marks the execution failed and the test runner reports it rather than claiming success. The operator fixes the integration and retries the email; stable IDs avoid ordinary replay duplicates. In production, a monitored queue and human inbox would make sure failed cases do not disappear. These failure paths still need live integration verification.

### Don't automate

Final approval of refunds, replacements and policy exceptions should remain manual. The dataset cannot verify photos, physical item condition, packing records or exact delivery times. A model should prepare the facts and draft; a support person should approve the remedy. The workflow has no payment or fulfillment write tools.

## 8. How I used AI tools

OpenAI Codex assisted with interpreting the brief, writing workflow-generation code, prompts, safety tests, test expectations and documentation. The candidate reviewed the workflow, connected the credentials, ran the live v2 suite and should understand the privacy gate, date rules, agent tools and deduplication before the live interview.

## 9. If I had one more week

Add transactional ticket storage and queueing, calibrated evaluation across a larger set of emails, attachment review tooling, automatic usage accounting, stronger source-claim validation, and better observability for failed integrations. Keep financial and medical decisions manual.

## 10. Complete setup and reviewer runbook

The following is a clean-machine runbook. It keeps credentials outside Git and lets a reviewer rebuild the workflow exports.

### Prerequisites

- Node.js 24 or newer
- Python 3.10 or newer
- Git
- A Google account
- A Gemini API key
- An n8n instance (local or Cloud)
- A Google Sheet with `Audit Log` and `Tickets` tabs

Check versions:

```bash
node --version
npm --version
python --version
git --version
```

### Clone and install local n8n

```bash
git clone https://github.com/90sumit99/kesar-ai-support-copilot.git
cd kesar-support-copilot
mkdir -p .runtime
npm install --prefix .runtime n8n@2.49.5 --no-audit --no-fund
```

On Windows PowerShell, the equivalent is:

```powershell
New-Item -ItemType Directory -Force .runtime | Out-Null
npm install --prefix .runtime n8n@2.49.5 --no-audit --no-fund
```

n8n is installed locally in `.runtime/node_modules/n8n`, not globally. Private n8n data and encrypted credentials are stored in `.local/.n8n`; both directories are ignored by Git.

### Start n8n

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-n8n.ps1
```

Or from Git Bash:

```bash
powershell.exe -ExecutionPolicy Bypass -File ./scripts/start-n8n.ps1
```

Open `http://localhost:5678` and create the local owner account. Verify the server:

```powershell
Invoke-RestMethod http://localhost:5678/healthz
```

### Configure credentials

Create `Kesar Gemini` in n8n using the Gemini key from Google AI Studio. Create `Kesar Google Sheets` using Google OAuth. The OAuth redirect URI is:

```text
http://localhost:5678/rest/oauth2-credential/callback
```

Add your Google account as a test user in Google Cloud, enable Google Sheets API and Google Drive API, then use **Sign in with Google** in n8n. Never put either secret in this repository.

### Create and configure the Sheet

Create tabs named exactly `Audit Log` and `Tickets`. The complete header templates are in `templates/audit_log_template.csv` and `templates/tickets_template.csv`. Copy the spreadsheet ID from the URL, then rebuild the workflow exports:

PowerShell:

```powershell
$env:KESAR_SHEET_ID = "YOUR_GOOGLE_SHEET_ID"
npm run build
```

Git Bash:

```bash
export KESAR_SHEET_ID="YOUR_GOOGLE_SHEET_ID"
npm run build
```

### Import and publish workflows

Import `workflow/kesar-support-v1.json` and `workflow/kesar-support-v2.json` in n8n. Select the `Kesar Gemini` credential on the three model nodes and `Kesar Google Sheets` on all Sheets nodes. Publish the workflow before calling its production webhook.

For a local CLI import:

```powershell
$env:N8N_USER_FOLDER = (Join-Path (Get-Location).Path ".local")
$env:N8N_DIAGNOSTICS_ENABLED = "false"
node .runtime\node_modules\n8n\bin\n8n import:workflow --separate --input=workflow
```

### Run tests

```bash
npm test
npm run build
npm test
```

`npm test` runs 21 deterministic safety and workflow tests. It does not consume Gemini quota.

### Test one live webhook request

The required input shape is `id`, `from.email`, `subject`, `body`, and ISO-8601 `received_at`:

```powershell
$payload = @{id="demo-001"; from=@{name="Demo User";email="demo-user@example.com"}; subject="Where is my order?"; body="Hi, I placed order KC-1001 yesterday."; received_at=(Get-Date).ToUniversalTime().ToString("o")} | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post -Uri "http://localhost:5678/webhook/kesar-support-v2" -ContentType "application/json" -Body $payload
```

The workflow returns a draft and audit result; it does not send email.

### Run the complete supplied suite

```bash
python scripts/run-suite.py --url http://localhost:5678/webhook/kesar-support-v1 --version v1 --delay 0.5
python scripts/run-suite.py --url http://localhost:5678/webhook/kesar-support-v2 --version v2 --delay 0.5
node scripts/build-report.cjs
```

Raw responses are written to `test-results/`, which is intentionally ignored and must not be uploaded. Review generated drafts against `tests/expectations.json`.

### Upload safely to GitHub

```bash
git add .
git diff --cached --check
git status
git commit -m "Complete Kesar AI support copilot assignment"
git branch -M main
git remote set-url origin https://github.com/90sumit99/kesar-ai-support-copilot.git
git push -u origin main
```

Before pushing, verify that `.local`, `.runtime`, `test-results`, logs, API keys and OAuth secrets are not staged.
