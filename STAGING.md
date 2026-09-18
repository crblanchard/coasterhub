# A scratch copy of Coaster Hub

Somewhere to try things before they are real — reachable from a phone, safe to
break, and impossible to mistake for the live site.

Two flavours of the same thing. Both set **`DEV_AS=carter`**, which means no
login at all: every request is Carter, as an admin. Both wear the same skin — a
**plain black header** in the dark, a **plain white** one in the light, and
**DEV** beside the wordmark.

- **On your laptop:** `node tools/dev-server.mjs` → `http://127.0.0.1:8099`
- **On the web:** `coasterhub-staging.<your-subdomain>.workers.dev`

> `DEV_AS` is a complete bypass of authentication. It lives in
> `wrangler.staging.jsonc` and in no other config — its **absence** is the only
> thing keeping production honest. Never add it to `wrangler.jsonc`.

---

## Putting it on the web

### 1. Make the database

Cloudflare dashboard → **Workers & Pages → D1 → Create database**, named
`coasterhub-staging`. Copy the **Database ID** it gives you.

You can also do it from a terminal:

```sh
npx wrangler d1 create coasterhub-staging
```

### 2. Paste the id in

Open `wrangler.staging.jsonc` and replace `PUT-THE-STAGING-D1-ID-HERE` with it.

**Check it twice.** The production id is in `wrangler.jsonc`; if you paste that
one, a scratch copy starts writing to the real site.

### 3. Build the schema

Five files, in this order. A brand new D1 has nothing in it, so this is what
makes the tables:

```sh
for f in 000-base-schema 003-accounts 007-password-resets 010-follows 012-clone-groups; do
  npx wrangler d1 execute coasterhub-staging --remote --file=migrations/$f.sql
done
```

**Do not run `002` or `008`** against a fresh database. `000` already makes the
`activity` table and the profile columns, and the rest of those two files is a
day-one backfill that fails when there is no history to recover.

### 4. Fill it with data

```sh
node tools/staging-seed.mjs > staging-seed.sql
npx wrangler d1 execute coasterhub-staging --remote --file=staging-seed.sql
```

That is the repo's own exports — 1,114 coasters, 247 parks, 4,916 rides across
all five riders. Safe to re-run whenever you want the copy back to a known
state. (Rides are cleared per rider before being re-inserted, so nobody ends up
with double credits.)

### 5. Deploy

```sh
npx wrangler deploy -c wrangler.staging.jsonc
```

Wrangler prints the URL. Open it — black or white header, **DEV** next to the
wordmark, and you are already Carter.

### 6. Lock it

The `workers.dev` URL is public and has no login. Before you leave it up:

Cloudflare dashboard → **Zero Trust → Access → Applications → Add an
application → Self-hosted**, pointed at your staging hostname, with a policy
allowing your own email. Free at this scale, and it puts a one-time code in
front of the whole thing.

---

## Using it

| | |
|---|---|
| Be somebody else | `/__be?slug=cole` — local only |
| `/edit` password | `letmein` locally; on staging you are already an admin |
| Start over | locally `--fresh`; on staging, re-run step 4 |

Avatars **404 on staging** — there is no R2 bucket, and the Worker handles that.
Add one later if pictures ever need testing.

---

## Keeping it in step

When a migration is added, it has to be applied here too — `npx wrangler d1
execute coasterhub-staging --remote --file=migrations/NNN-whatever.sql` — and
added to the `SCHEMA` list at the top of `tools/dev-server.mjs` so a local
`--fresh` picks it up.

Deploying staging is **always by hand**. Pushing to `main` deploys production
and nothing else; `wrangler.staging.jsonc` is only read when you point wrangler
at it. That is deliberate: Cloudflare's git integration reads `wrangler.jsonc`
on every push, and a binding named there that does not exist yet fails the
deploy of the real site.
