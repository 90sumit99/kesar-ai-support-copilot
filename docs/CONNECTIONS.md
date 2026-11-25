# Connect the working workflow

## Local n8n

Run `powershell -ExecutionPolicy Bypass -File scripts/start-n8n.ps1` from this project. Open http://localhost:5678 and finish the local owner setup. This installation keeps its encrypted credential database in the ignored `.local` folder. It listens only on this computer.

Import `workflow/kesar-support-v1.json` and `workflow/kesar-support-v2.json` using n8n's Import from File command.

## Gemini

Create a key in https://aistudio.google.com/apikey. In n8n create a Google Gemini (PaLM) credential named **Kesar Gemini** and enter the key there. Select it on Classification Model, Repair Model and Drafting Model in both workflows. Do not put the key in code, prompts, screenshots, workflow parameters, or chat.

The initial model setting is `models/gemini-3.5-flash-lite`; check the credential's model selector for actual account availability before the first run. If unavailable, choose a supported tool-capable Gemini model and update all three model nodes. Record the actual model used in the README. Gemini 2.5 Flash is deprecated and should not be the default for a new build.

## Google Sheets

Create a spreadsheet named **Kesar Support** with two tabs named exactly **Audit Log** and **Tickets**. Import the corresponding template CSV headers into those tabs. Preserve the required column names.

For local n8n, Google Sheets OAuth needs a Google Cloud project with Google Sheets API and Google Drive API enabled, an OAuth consent screen (add your Google email as a test user), and an OAuth Web Application client. Add the redirect URI shown by n8n's Google Sheets credential (normally `http://localhost:5678/rest/oauth2-credential/callback`). Enter the client ID and secret only in n8n credentials, then sign in with Google. Name the credential **Kesar Google Sheets**.

For n8n Cloud, use its built-in Google sign-in instead; a custom OAuth client is usually unnecessary. The workflow export works in either installation.

Select this credential on Read Open Tickets, Upsert Ticket and Write Audit Log. Set the same spreadsheet ID in all three nodes. The ID is the portion between `/d/` and `/edit` in the Google Sheet URL. Alternatively regenerate the exports after setting the non-secret `KESAR_SHEET_ID` environment variable.

## Test

Publish v1, then run `python scripts/run-suite.py --url http://localhost:5678/webhook/kesar-support-v1 --version v1`. Actual responses are saved under `test-results/v1/`.

Publish v2, then run `python scripts/run-suite.py --url http://localhost:5678/webhook/kesar-support-v2 --version v2`. This processes all 25 emails, updating audit rows by email_id and tickets by their stable ticket ID. v1 evidence remains in its result files. Review the final 25 audit rows and drafts manually against `tests/expectations.json`.

Only run one request at a time. The local start script limits production executions to one; on Cloud, send serial requests and do not run multiple test scripts at once. Sheets has no transactional unique constraints. If you run parallel workloads, ticket deduplication is not guaranteed.

All Sheets writes use RAW values to avoid spreadsheet formula execution. If Sheets is unavailable, the execution fails rather than falsely reporting success; retry that email after resolving the failure. Upserts prevent duplicate rows on ordinary retries.

## Evidence and submission

Fill TEST_REPORT.md only from actual saved executions and manual draft review. Capture workflow.png, tickets.png and audit_log.png from the running application. Add the view-only Sheet link and five-minute recording link to README.md. Export the final configured workflow without secrets and scan it before publication. The local application must stay running during a live walkthrough; a permanent public endpoint is not necessary for the supplied local test runner.
