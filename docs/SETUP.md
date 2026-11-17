# Setup Guide (all free tiers)

Everything in this assignment can be done at **zero cost**. Free-tier limits change from time to time. If one option doesn't work for you, pick an alternative and mention it in your README.

> **Security first:** store every API key/token in your platform's **credentials manager** or a local `.env` file. Never paste keys directly into nodes that get exported, and never commit them. `.env` is already in `.gitignore`.

---

## 1. Automation platform (pick one)

| Option | How to get it | Notes |
|---|---|---|
| **n8n — self-hosted (recommended)** | Docker: `docker run -it --rm --name n8n -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n` · or Node: `npx n8n` · then open http://localhost:5678 | Free, no limits, has a built-in **AI Agent** node with tool support. Docs: https://docs.n8n.io |
| **n8n Cloud** | Free trial at https://n8n.io | Public webhook URLs out of the box. Mind the trial length vs. your deadline. |
| **Make** | Free plan at https://www.make.com | Watch the monthly operations limit. Running 25 emails × several steps × 2 prompt versions adds up. |
| **Zapier** | Free plan at https://zapier.com | Free-plan limits on multi-step workflows may restrict you. Check before committing. |

**Public URLs:** if an external service ever needs to call *into* your workflow (e.g., a webhook from another tool), a locally hosted instance needs a public URL. Use n8n Cloud or a tunnel such as `ngrok` or `cloudflared`.

---

## 2. LLM API (pick one, or mix)

| Option | Where |
|---|---|
| Google Gemini (free tier via AI Studio) | https://aistudio.google.com |
| Groq (free tier, fast open models) | https://console.groq.com |
| OpenRouter (some free models) | https://openrouter.ai |
| OpenAI / Anthropic | Only if you already have credits. Not required. |

You choose the model(s). Mention them and your settings (temperature, etc.) in your README. Using a cheaper/faster model for classification and a stronger one for drafting is a legitimate design choice. Just explain it.

---

## 3. Order "API" — `data/orders.json`

Treat this file as a **read-only order API**.

- **Easiest:** open `data/orders.json` in the GitHub web UI → click **Raw** → copy the URL. Call it with an HTTP GET request and filter the result by `order_id` or `customer_email` inside your workflow.
- **Alternatives:** import the orders into a Google Sheet or Airtable, or serve the file locally (e.g., `npx json-server data/orders.json`). Any approach is fine if your `get_order` tool behaves like an API lookup.

Field reference (each order):

| Field | Meaning |
|---|---|
| `order_id` | `KC-####` |
| `customer_name`, `customer_email` | Who placed the order |
| `order_date` | Date the order was placed |
| `items[]` | `sku`, `name`, `qty`, `unit_price` |
| `subtotal`, `shipping_fee`, `cod_fee`, `total` | Amounts in INR |
| `payment_method` | `prepaid` or `cod` |
| `status` | `processing`, `shipped`, `out_for_delivery`, `delivered`, `cancelled` |
| `courier`, `tracking_url` | Courier partner and tracking link (null if not shipped) |
| `shipped_date`, `estimated_delivery`, `delivered_date` | Dates (null if not applicable) |
| `cancelled_date`, `cancellation_reason`, `refund_status` | Filled only for cancelled orders |
| `shipping_address` | Delivery address |

---

## 4. FAQ knowledge — `data/faq.md`

Your `search_faq` tool can be as simple or as sophisticated as you like: fetch the raw file and pass the relevant section (or all of it) to the agent, split it by headings, or put it in a vector store. Explain your choice. The key requirement is that answers stay **grounded** in this file.

---

## 5. Jira (free)

1. Create a free Jira site at https://www.atlassian.com/software/jira/free (free for up to 10 users).
2. Create a project named **Kesar Support** with key **`KS`**. A team-managed Kanban project is fine.
3. Create an API token: https://id.atlassian.com/manage-profile/security/api-tokens
4. Authenticate with **Basic auth**: your Atlassian account email + the API token. Your API base URL is `https://<your-site>.atlassian.net`.
5. REST API docs: https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/
6. n8n, Make and Zapier all have Jira integrations. You may use those or raw HTTP requests.

Tip: issue search uses **JQL** (Jira Query Language), which is useful for finding existing issues before creating new ones.

---

## 6. Slack (free)

1. Create a free Slack workspace (or use a personal one you own) and a channel named **`#support-escalations`**.
2. Either:
   - create a Slack app with an **Incoming Webhook** for that channel: https://api.slack.com/messaging/webhooks, **or**
   - create a Slack app with a bot token (`chat:write` scope) and use your platform's Slack integration.

---

## 7. Google Sheets (audit log)

1. Create a Google Sheet named **Kesar Support Audit Log**.
2. Import [`templates/audit_log_template.csv`](../templates/audit_log_template.csv) (File → Import) to get the column headers.
3. You may add columns, but keep the existing ones.
4. Before submitting, set sharing to **"Anyone with the link can view"**.

---

## 8. Running the 25 test emails

You can trigger your flow in either of two ways:

**A. Webhook + sender script (closest to real life)**

```bash
# Python 3.8+, no extra packages needed
python scripts/send_test_emails.py --url <YOUR_WEBHOOK_URL>                # all 25, 5s apart
python scripts/send_test_emails.py --url <YOUR_WEBHOOK_URL> --only E01,E05  # a subset
python scripts/send_test_emails.py --url <YOUR_WEBHOOK_URL> --dry-run       # preview only
```

Each POST body is one email object exactly as in `data/test_emails.json`.

**B. Loop inside your workflow:** fetch `data/test_emails.json` (raw URL) and iterate over `emails[]`.

Either is fine. Keep a **delay between emails** so you don't hit free-tier rate limits on your LLM or Jira.
