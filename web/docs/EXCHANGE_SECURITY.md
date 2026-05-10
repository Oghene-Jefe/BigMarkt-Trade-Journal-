# Exchange Credential Security

How BigMarkt stores, uses, and protects exchange API credentials.

## Threat model

The credentials we hold are **read-only** Bybit API keys. We reject any key that:
- Has `readOnly !== 1` from `/v5/user/query-api`
- Carries withdrawal, transfer, or trading permissions
- Reports an unknown / unrecognised permission set

The worst-case impact of a full compromise is therefore: an attacker can read another user's exchange history (positions, fills, balances). They cannot move funds or place trades through BigMarkt's stored credentials. That doesn't make leakage acceptable — but it bounds the blast radius.

## Encryption design (envelope, app-side)

```
master      = base64-decoded EXCHANGE_CREDENTIAL_ENCRYPTION_KEY env var (≥32 bytes)
key_salt    = random 32 bytes per connection (stored in exchange_connections.key_salt as bytea)
derived key = HKDF-SHA256(master, salt = key_salt,
                          info = "bigmarkt-exchange-credential|v1|<user_id>",
                          length = 32 bytes)
ciphertext  = AES-256-GCM(derived_key, iv = random 12 bytes, plaintext)
```

The serialised on-disk blob is JSON: `{ "v": 1, "iv": "<b64>", "ct": "<b64>", "tag": "<b64>" }`.

Properties:
- **Per-row salt + per-user info** means the derived key is unique to each (connection, user) pair. An attacker who steals only ciphertexts can't reuse a derived key across rows or users.
- **AES-GCM auth tag** detects any tampering (with the ciphertext itself, the IV, the tag, the salt, or the userId — all of which feed the verification path).
- **Random IV per encrypt** so encrypting the same plaintext twice produces different ciphertexts. Pinned by `tests/exchange-crypto.spec.ts`.

Code: `web/lib/exchanges/crypto.ts`. Tests: `web/tests/exchange-crypto.spec.ts` (14 tests).

## What's in the database

Per `exchange_connections` row:

| Column | Encrypted? | Notes |
|---|---|---|
| `encrypted_api_key` | ✅ versioned blob | derived key uses `key_salt` + `user_id` |
| `encrypted_api_secret` | ✅ versioned blob | same salt, different IV |
| `key_salt` | ✗ stored as bytea | Random per connection. Useless without the master key. |
| `api_key_hint` | ✗ plain text | First/last 4 chars of the API key for UI display. Never the secret. |
| `permissions` | ✗ plain JSON | Bybit-side permission metadata captured at connect time. |
| `bound_ips` | ✗ plain text array | IP allow-list reported by Bybit at connect time. |

The DB never sees plaintext credentials. They exist in memory only:
- briefly during `connectBybitAction` (form submit → encrypt → insert)
- briefly during `syncBybitAction` (fetch row → decrypt → sign requests → discard)

## What's NOT in the database

- Plaintext API keys or secrets (anywhere)
- Logs of plaintext (we use the `api_key_hint` shape `XXXX...XXXX` in any operational logs)
- The master encryption key (only in env vars + Vercel secrets store)

## Master key compromise

Anyone with `EXCHANGE_CREDENTIAL_ENCRYPTION_KEY` can decrypt every connection's credentials. This is a known limitation of the envelope design and acceptable for MVP. Mitigations:

- The env var is set in Vercel Production + Preview only, not Development. It's not in the repo.
- Vercel marks env vars as "Sensitive" by default, so they're not surfaced in build logs or readable from the dashboard once set.
- Only project members with admin access on Vercel can read the value back.
- Local devs working on this feature get a separate dev-only key in their `.env.local` (encrypts toy/testnet credentials only).

If a future compromise scenario requires defence beyond this — KMS, per-user device keys, hardware-backed signing — that's a Phase G+ item, not MVP.

## Rotation procedure

Rotation re-encrypts every existing blob under a new master key without ever exposing plaintext outside the trusted server.

1. **Generate the new key** locally:
   ```bash
   openssl rand -base64 32
   ```
2. **Set both keys in Vercel** as env vars:
   - `EXCHANGE_CREDENTIAL_ENCRYPTION_KEY_NEXT` = the new key
   - `EXCHANGE_CREDENTIAL_ENCRYPTION_KEY` = (still the current key)
3. **Deploy a one-shot rotation route** (`web/app/api/admin/rotate-exchange-keys/route.ts`, gated by `requireAdmin()`) that:
   - Selects all `exchange_connections` rows
   - For each: decrypts with the *current* key, encrypts under the *next* key, updates the row, also writes a fresh `key_salt`
   - Logs only counts and ids, never plaintext
4. **Verify** by hitting one connection's `syncBybitAction` and confirming Bybit accepts the request.
5. **Promote the new key**: in Vercel, set `EXCHANGE_CREDENTIAL_ENCRYPTION_KEY` = the new key. Remove `EXCHANGE_CREDENTIAL_ENCRYPTION_KEY_NEXT`.
6. **Redeploy.**
7. Delete the rotation route from the codebase (it's a one-shot tool, not a permanent endpoint).

For the MVP slice, the rotation route does not exist yet. Add it before the first key rotation is due, not before MVP launch.

## Logging discipline

- `console.log` of an `ExchangeCredentials` object → forbidden. Lint rule TBD; for now, code review.
- `error_message` columns on `exchange_sync_runs` and `exchange_connections.last_error` may store Bybit error messages but never request bodies, headers, or the credentials themselves.
- The `raw_payload` jsonb columns on `exchange_closed_pnl` and `exchange_fills` store the Bybit *response* — which never includes the API secret. Acceptable.

## Why we reject non-read-only keys

Two layers of defence:
1. Bybit's `query-api` returns `readOnly: 1` for read-only keys. We reject anything else.
2. We allow-list known read-only permission strings. Any unknown permission appearing on a key is treated as a write capability and rejected.

Even if someone manages to pass a bad key past the validator, the keys are stored encrypted, our sync code only ever issues signed GET requests against history endpoints, and the keys can be revoked from Bybit's UI immediately. The validator is the first line of defence, not the only one.

## Test coverage

`web/tests/exchange-crypto.spec.ts` pins the encryption invariants:
- Round-trip: 2 tests
- Secrecy: 3 tests (no-plaintext-substring, random IV, salt-uniqueness)
- Tamper detection: 4 tests (ciphertext-flip, tag-flip, malformed JSON, future version)
- Key isolation: 2 tests (wrong userId, wrong salt)
- Hint masking: 2 tests
- Empty plaintext rejection: 1 test

If any of these fail in CI, the PR is blocked.
