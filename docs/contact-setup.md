# Contact form delivery

Every submission is validated and stored in the `contact_submissions` table. The form tells the visitor
exactly what happened:

| Configuration | What the visitor sees |
|---|---|
| Nothing configured | "Your message has been securely stored. Automatic notification isn't configured yet…" |
| Delivery configured and succeeded | "Your message has been sent to the Privexa team." |
| Delivery configured but failed | "Your message has been stored, but the notification to our team failed…" |

It never claims a message was sent unless delivery actually succeeded.

## Option 1 — Webhook (Slack, Teams, Zapier, a CRM…)
```
CONTACT_WEBHOOK_URL=https://hooks.example.com/your-endpoint
```
Privexa POSTs JSON: `{"text": "...", "submission_id": "...", "inquiry_type": "provider"}`.
A non-2xx response is treated as a failed delivery.

## Option 2 — Email (SMTP with STARTTLS)
```
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USERNAME=...
SMTP_PASSWORD=...
SMTP_FROM=website@your-domain
CONTACT_TO=team@your-domain
```
The visitor's address is set as `Reply-To`. If both options are set, the webhook is used.

## Public contact email
To show an address on the About page, set `VITE_CONTACT_EMAIL` and rebuild the web app. Leave it empty
until the address is verified.

## Spam protection
A hidden honeypot field and a per-IP rate limit (5 submissions per 10 minutes). For a public deployment,
add a CAPTCHA (e.g. Cloudflare Turnstile) in front of `POST /api/v1/contact`.

## Reading submissions
Until an admin inbox exists, read them from the database, e.g. with SQLite:
```
sqlite3 apps/api/privexa-dev.db "select created_at, inquiry_type, name, email, organization, message from contact_submissions order by created_at desc"
```
