# Railway Deploy Guide — BigMarkt WebSocket Server

## What this service does

Receives live trade data from the MT5 EA over WebSocket, authenticates via
SHA256-hashed bearer token (looked up in Supabase), and upserts trades into
the database. Also exposes an HTTP `/status` endpoint consumed by the web
app's EA Setup page to show connection health.

Both WebSocket upgrades and HTTP requests share **one port** (Railway's
`PORT` env var), so no special networking config is needed.

---

## 1. Required environment variables

Set all of these in the Railway service's **Variables** tab before deploying.

| Variable | Value | Where to get it |
|---|---|---|
| `SUPABASE_URL` | `https://<your-project-ref>.supabase.co` | Supabase dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service role JWT) | Supabase dashboard → Project Settings → API → **service_role** (secret) |

> **Do not set `PORT` or `WS_PORT`** — Railway injects `PORT` automatically.
> The server reads `process.env.PORT` first, so it just works.

---

## 2. Deploy steps

### 2a. Create the Railway project

1. Go to [railway.app](https://railway.app) and click **New Project**.
2. Choose **Deploy from GitHub repo**.
3. Select the `BigMarkt-Trade-Journal-` repository.
4. Railway will detect it as a monorepo. When asked for the **Root Directory**,
   enter: `websocket-server`
5. Railway reads `railway.json` from that directory and uses:
   - Build: `npm ci && npm run build`
   - Start: `npm run start`

### 2b. Set environment variables

In the Railway service → **Variables** tab, add:

```
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### 2c. Deploy

Click **Deploy**. Railway builds the TypeScript, then starts the compiled JS.
The healthcheck hits `GET /healthz` — if it returns `200 ok`, the service is up.

---

## 3. After deploy — update Vercel

Once Railway shows the service as **Active**, copy the public URL from the
Railway dashboard (e.g. `https://bigmarkt-ws-server-production.up.railway.app`).

In **Vercel → web project → Settings → Environment Variables**, update:

| Variable | New value |
|---|---|
| `WS_STATUS_URL` | `https://<railway-url>/status` |

Redeploy the Vercel web project (or wait for the next push) for the change to take effect.

---

## 4. Verify the deployment

```bash
# Health check
curl https://<railway-url>/healthz
# → ok

# Status endpoint (shows connected EA clients)
curl https://<railway-url>/status
# → {"connected_clients":0,"server_uptime_seconds":42,"ts":...,"connections":[]}
```

The EA Setup page in the journal should now show a live connection status
once an MT5 terminal connects with a valid bearer token.

---

## 5. Local dev (unchanged)

```bash
cd websocket-server
cp .env.example .env   # fill in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev            # tsx watch, port 8080
```

Status endpoint locally: `http://localhost:8080/status`
WebSocket locally: `ws://localhost:8080`
