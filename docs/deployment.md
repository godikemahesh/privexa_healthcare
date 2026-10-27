# Deploying Privexa (Vercel + Render)

```
Browser ──► Vercel (website, apps/web)
              │  /api/* is forwarded (vercel.json rewrite)
              ▼
            Render: privexa-api ──► Render PostgreSQL (privexa-db)
              │            └──────► Sepolia test network (optional, step 5)
              ├──► Render: privexa-hospital-a  (simulated MetroCare, synthetic data)
              └──► Render: privexa-hospital-b  (simulated Sunrise, synthetic data)
```

Because Vercel forwards `/api/*` to Render, the browser only ever talks to your Vercel domain, so
login cookies work without any cross-site configuration.

## 1. Put the code on GitHub

Both Vercel and Render deploy from a GitHub repository. Create an **empty private** repository at
github.com/new (no README), then from the project folder:

```bash
git init
git add .
git commit -m "Privexa initial version"
git branch -M main
git remote add origin https://github.com/<your-account>/privexa.git
git push -u origin main
```

`.env`, databases, `node_modules` and build output are excluded by `.gitignore`. Check `git status`
before committing that no `.env` file is listed.

## 2. Render: API, hospitals and database

1. Sign in at render.com with GitHub.
2. **New → Blueprint** → pick the repository. Render reads `render.yaml` and proposes four resources:
   `privexa-db`, `privexa-api`, `privexa-hospital-a`, `privexa-hospital-b`.
3. It asks for the values marked `sync: false`. For now:
   - `CORS_ORIGINS`: put `https://privexa.vercel.app` (you will correct it in step 4).
   - Leave the blockchain and SMTP fields empty (fill them later, steps 5–6).
4. **Apply**. The first deploy takes 5–10 minutes.
5. Check each service's URL in the Render dashboard. If Render had to rename a service (because the
   name was taken), its URL differs from the defaults. Then:
   - edit `HOSPITAL_A_FHIR_URL` / `HOSPITAL_B_FHIR_URL` on `privexa-api` → Environment, and
   - edit the `destination` URL in `apps/web/vercel.json`, commit and push.
6. Test: open `https://privexa-api.onrender.com/api/v1/health` and
   `https://privexa-hospital-a.onrender.com/fhir/metadata`. Both should return JSON.

## 3. Vercel: the website

1. Sign in at vercel.com with GitHub → **Add New → Project** → import the repository.
2. **Root Directory**: `apps/web` (important). Framework is detected as Vite.
3. **Environment Variables**:
   - `VITE_SITE_URL` = the address the site will live at, e.g. `https://privexa.vercel.app`
     (or your own domain later).
   - `VITE_CONTACT_EMAIL` = your public business email (optional).
4. **Deploy**.

## 4. Connect the two

On Render → `privexa-api` → Environment, set `CORS_ORIGINS` to your exact Vercel URL
(e.g. `https://privexa.vercel.app`, no trailing slash) and save; Render redeploys automatically.

Open the Vercel URL → **Demo** → **Launch Interactive Demo**.

## 5. Blockchain anchoring (optional)

The local Hardhat chain cannot be hosted, so hosted anchoring uses the free **Sepolia** test network.
Until this step, `ANCHOR_ENABLED=false` and the site honestly shows audit events as *not anchored*.

1. Create a **new, empty** wallet in MetaMask used only for this. Export its private key
   (Account details → Show private key). Never use a wallet holding real money.
2. Get free Sepolia test ETH from a faucet (e.g. Google Cloud Web3 faucet, or Alchemy's Sepolia faucet).
3. Get an RPC URL: sign up at alchemy.com (or infura.io) → create an app on **Ethereum Sepolia** →
   copy the HTTPS URL.
4. Deploy the contract from your computer (PowerShell, in the `contracts` folder):
   ```powershell
   $env:SEPOLIA_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/<key>"
   $env:DEPLOYER_PRIVATE_KEY="0x<private key>"
   npm run deploy:sepolia
   ```
   It prints `AuditAnchor deployed to 0x…`.
5. On Render → `privexa-api` → Environment:
   `CHAIN_RPC_URL` = the Alchemy URL, `ANCHOR_CONTRACT_ADDRESS` = the printed address,
   `ANCHOR_PRIVATE_KEY` = the same private key, `ANCHOR_ENABLED` = `true`.

Each audit event costs a tiny amount of test ETH; top up from the faucet when it runs low. Sepolia
confirms in about 12 seconds, so anchors take a little longer than locally.

## 6. Contact form email (optional)

On Render → `privexa-api` → Environment, set the SMTP values (see `docs/contact-setup.md`; for Gmail,
`SMTP_HOST=smtp.gmail.com` and an App Password). Without them, submissions are stored in the
database and the site says so.

## 7. Your own domain (optional)

Vercel → Project → Settings → Domains → add e.g. `privexa.ai` and follow the DNS instructions. Then
update `VITE_SITE_URL` on Vercel (redeploy) and `CORS_ORIGINS` on Render.

## Free-tier limits to know

| Limit | Effect | Fix |
|---|---|---|
| Render free services sleep after 15 minutes idle | The first visit after a quiet period takes ~1 minute; the first demo step may report a hospital timeout, then succeed on retry | Upgrade the three services to **Starter**, or ping the health URLs every 10 minutes with a free monitor (e.g. UptimeRobot) |
| Hospital simulators have no persistent disk | They reload their synthetic records on every start | Nothing to do; the data is deterministic |
| Render free PostgreSQL expires after 30 days | Demo state and contact submissions are lost | Upgrade the database, or create a free Neon database and paste its URL into `DATABASE_URL` |
| Vercel waits about 30 seconds for the API | A request that reaches a sleeping API can fail once | Refresh, or keep the API awake as above |

## Updating the site

Push to `main`. Vercel and Render both redeploy automatically.
