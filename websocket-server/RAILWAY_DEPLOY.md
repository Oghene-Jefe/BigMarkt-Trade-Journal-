# Railway Deploy Guide — BigMarkt WebSocket Server

## What this service does

**Presence / status surface for the MT5 EA.** Authenticates connections via
SHA256-hashed bearer token (looked up in Supabase), tracks live EA
connections, and surfaces them through a server-to-server `/status`
endpoint that the journal's EA Setup page polls.

Trade ingest is **HTTP-only**. The MT5 EA POSTs every trade to
`https://journal.bigmarkt.co/api/ea/ingest` using the v2 envelope
(HMAC-signed, replay-protected). The WebSocket server does NOT accept
trade events; it returns a `trade_ingest_disabled` error pointing clients
at the HTTP endpoint. The HTTP-only ingest decision is enforced by
`websocket-server/src/server.ts` and the EA ingest route in
`web/app/api/ea/ingest/route.ts`.

Both WebSocket upgrades and HTTP requests share **one port** (Railway's
`PORT` env var), so no special networking config is needed.

---

## 1. Required environment variables

Set all of these in the Railway service's **Variables** tab before deploying.

| Variable | Value | Where to get it |
|---|---|---|
| `SUPABASE_URL` | `https://<your-project-ref>.supabase.co` | Supabase dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service role JWT) | Supabase dashboard → Project Settings → API → **service_role** (secret) |
| `WS_STATUS_SECRET` | Long random string (`openssl rand -base64 32`) | Generate locally; set the same value on Vercel's `WS_STATUS_SECRET` |

> **Do not set `PORT` or `WS_PORT`** — Railway injects `PORT` automatically.
> The server reads `process.env.PORT` first, so it just works.

> **`WS_STATUS_SECRET` is required.** The `/status` endpoint refuses to serve
> unless this env var is set; the journal server (Vercel) sends it as a
> `Authorization: Bearer …` header. Use the same value on both sides.

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
WS_STATUS_SECRET=<long random string, same value as in Vercel>
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
| `WS_STATUS_SECRET` | same value as on Railway |

Redeploy the Vercel web project (or wait for the next push) for the change to take effect.

---

## 4. Verify the deployment

The `/status` endpoint is **server-to-server** and **scoped by caller**:
the journal supplies the calling user's active EA token IDs in
`?token_ids=` and the WS server filters its in-memory connection map
against that allow-list **before responding**. There is no longer any way
for `/status` to return the global active-connection map — even with the
right `WS_STATUS_SECRET`. A caller with the secret but no `token_ids` gets
back zero connections by design.

```bash
# Health check — public, no auth.
curl https://<railway-url>/healthz
# → ok

# Status without the secret — must be rejected.
curl https://<railway-url>/status
# → {"error":"Unauthorized"}

# Status with the secret but no token IDs — empty allow-list, zero
# connections. Confirms the server doesn't leak its global map even to a
# privileged caller.
curl -s -H "Authorization: Bearer <secret>" https://<railway-url>/status
# → {"connected_clients":0,"server_uptime_seconds":...,"ts":...,"connections":[]}

# Status with the secret AND a specific token allow-list — returns only
# matching connections. Replace UUIDs with real ones from your ea_tokens.
curl -s \
  -H "Authorization: Bearer <secret>" \
  "https://<railway-url>/status?token_ids=11111111-2222-3333-4444-555555555555"
# → {"connected_clients":0|1,...,"connections":[]|[{"token_id":...}]}
```

The journal's `/ea-setup` page builds the `token_ids` list automatically
from the calling user's active rows in `ea_tokens` and sends it on every
poll. Once an MT5 terminal connects with that token, the EA-setup status
card shows it live.

---

## 5. Local dev (unchanged)

```bash
cd websocket-server
cp .env.example .env   # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WS_STATUS_SECRET
npm install
npm run dev            # tsx watch, port 8080
```

Status endpoint locally: `http://localhost:8080/status` (still requires the
bearer secret + `?token_ids=` allow-list — same contract as production).
WebSocket locally: `ws://localhost:8080`
