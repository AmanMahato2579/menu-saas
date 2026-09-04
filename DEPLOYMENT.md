# MenuQR — Deployment Runbook (Self-Hosted)

This guide walks us through deploying the MenuQR app on our own server, under
our own domain, with HTTPS, step by step. Nothing here is complicated — every
step has copy-paste commands and a small "checkpoint" so we always know it
worked before moving to the next step.

Plan of attack (the short version):

```
Domain  -->  Server (ECS)  -->  nginx (web server)  -->  App container (Node/Next.js)  -->  Database container (PostgreSQL)
```

- **Domain**: what customers type in their browser (e.g. `menusaas.com`).
- **Server**: an Alibaba Cloud machine (ECS) that runs our app 24/7.
- **nginx**: the "front door" – receives HTTPS requests and forwards them to our app.
- **App container**: the Docker container running the Next.js app (MenuQR).
- **Database container**: the Docker container running PostgreSQL, holding all data.

---

## What we need before we start

| Thing | Where to get it | Cost |
|-------|-----------------|------|
| A domain name | Buy it online (Step 1) | ~$10–15/year |
| A cloud server (ECS) | Alibaba Cloud (Step 2) | ~$10–30/month |
| This codebase | GitHub (already have it) | Free |
| A credit card / Alipay | For paying Alibaba Cloud | – |

**Time needed:** about 2–3 hours the first time. Later updates take minutes (Step 14).

---

## Step 1 — Buy the domain

The domain is your address on the internet. Pick something short and easy to spell.

1. Go to a domain registrar. Popular choices: **Namecheap**, **Cloudflare**, or
   **Alibaba Cloud (万网)** itself.
2. Search for the name you want (e.g. `menusaas.com`, `menusaas.com.np`,
   `yourrestaurant.com`). A `.com` or `.com.np` is fine.
3. Buy the domain for one year (renewal is automatic if you set it up).
4. Keep the registrar's login details — we need them in Step 3 to point the
   domain at our server.

> Couldn't decide on a name? Any name works for now — we can point a different
> domain at the same app later without changing the server.

**Checkpoint:** we can open the registrar's dashboard and see the domain listed
under "My Domains".

---

## Step 2 — Create the Alibaba Cloud server (ECS)

ECS = Elastic Compute Service. It's just a Linux computer in the cloud.

1. Create an Alibaba Cloud account and verify billing (phone + payment method).
2. Open **ECS console → Instances → Create Instance**.
3. Choose these settings:
   - **Region**: pick the one closest to the restaurant.
     For a restaurant in Nepal, **Singapore** or **Mumbai** works well.
     (Avoid mainland-China regions unless we want to deal with ICP filing /
     备案 — it's a legal registration process we don't need.)
   - **Image / OS**: **Ubuntu 22.04 LTS** (or 24.04 LTS). Simple and stable.
   - **Type / Spec**: start with **2 vCPU + 4 GB RAM**.
     That's cheap and comfortably runs one app + one database.
   - **Storage**: 40 GB SSD is enough to start.
   - **Bandwidth / Bandwidth plan**: 3–5 Mbps is fine. (If the restaurant needs
     to upload many menu photos later, this can be raised.)
   - **Login**: set an SSH key **and** a root password (keep the password safe —
     we log in with it in Step 5).
4. Buy / create the instance. Wait a minute for it to start.
5. **Security Group** (this is the server's firewall — must be done):
   - Open the instance, go to **Security Groups → Inbound rules**.
   - Add **3 rules**, choosing "SSH", "HTTP", "HTTPS" from the preset list:
     - `TCP 22`  (SSH — logging in)
     - `TCP 80`  (normal web traffic)
     - `TCP 443` (secure HTTPS traffic)
   - This opens the door for the browser and for us to log in, and nothing else.

6. Note down two things (we need them for the rest of this guide):
   - **Public IP address** of the server. It looks like `47.x.x.x`.
   - **Root password** we set in step 3.

**Checkpoint:** in the ECS console the instance shows **Running**.

---

## Step 3 — Point the domain to the server (DNS)

Now we tell the domain "when someone visits you, go to the Alibaba server's IP".
This is called a DNS record, type **A**.

1. Open the site where we bought the domain (registrar's dashboard, e.g.
   Namecheap / Cloudflare / Alibaba). Find **DNS / DNS management / Advanced DNS**.
2. Delete any old default records (they often say `@` pointing somewhere random).
3. Add **two `A` records** with our server's **Public IP** from Step 2:

   | Type | Host / Name | Value  (Points to) |
   |------|-------------|--------------------|
   | A    | `@`          | `<server-ip>`       |
   | A    | `www`        | `<server-ip>`       |

   - `@` means the bare domain (`menusaas.com`).
   - `www` means the `.www` version (`www.menusaas.com`).
4. DNS changes can take **5 minutes to a few hours**. Don't panic if it doesn't
   resolve immediately.

**Checkpoint:** after a while, on your laptop run `ping <your-domain>` and you
should see it reply with our server's IP. (If it says "could not find host",
wait a bit and try again.)

---

## Step 4 — Small code changes we make to the app (one time, before deploying)

The app needs a tiny bit of packaging so it can run in a container. These are
small, safe changes. We do them now, commit, and never touch them again for
normal updates.

### 4.1 Add a `Dockerfile`

Create a file named `Dockerfile` in the project root with this content:

```dockerfile
FROM node:22-alpine AS base

# ---- install dependencies ----
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build the app ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- small production image ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
RUN mkdir .next && chown nextjs:nodejs .next
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# carry Prisma's database engine into the final image
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

### 4.2 Turn on the "standalone" build in `next.config.ts`

Open `next.config.ts` and add one line so the container is small and fast:

```ts
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
};
```

### 4.3 Docker Compose file (already exists — we keep it and expand it)

`docker-compose.yml` already exists with PostgreSQL. On the **server** we will
use the expanded version shown in Step 7 (it adds the app + database-migration
services). We will replace the local file's content tomorrow.

### 4.4 Commit and push

```bash
git add Dockerfile next.config.ts docker-compose.yml
git commit -m "chore: prepare containerized deployment"
git push origin main
```

**Checkpoint:** the changes are on GitHub (`main` branch). The server can pull
them in Step 6.

---

## Step 5 — Connect to the server & install Docker

Docker is the program that runs our app and database in tidy little boxes
("containers").

1. From your laptop, open a terminal and log in to the server:

   ```bash
   ssh root@<server-ip>
   ```

   Enter the root password we set in Step 2 when asked.

2. Update the server's base software (one-time):

   ```bash
   apt update && apt upgrade -y
   ```

3. Install Docker with the official one-liner:

   ```bash
   curl -fsSL https://get.docker.com | sh
   systemctl enable --now docker
   ```

4. Verify Docker works:

   ```bash
   docker --version
   docker compose version
   ```

Both commands should print a version number and no errors.

**Checkpoint:** we are sitting inside the server's terminal (the prompt shows
`root@<something>`) and both Docker commands work.

---

## Step 6 — Put the app's code on the server & create the secrets file

1. Clone the repository on the server (inside the root home folder):

   ```bash
   cd ~
   git clone <git-repo-url> app
   cd ~/app
   ```

   Replace `<git-repo-url>` with the GitHub/GitLab URL of this project.

2. Now write the secrets file `.env`. Docker Compose reads it automatically.
   Use a real text editor (`nano .env`). The file should look like this
   (replace the `<...>` parts):

   ```bash
   # Random secret used to sign login tokens. Generate one with:
   #   openssl rand -base64 32
   AUTH_SECRET=<paste-the-random-string>

   # The public URL of the app (no trailing slash)
   NEXT_PUBLIC_APP_URL=https://<your-domain>

   # Database credentials (create a strong password, like: MyRest$2024!xQ7)
   POSTGRES_USER=menuuser
   POSTGRES_PASSWORD=<a-strong-database-password>
   POSTGRES_DB=menu_saas

   # Connection strings the app uses to reach the database.
   # The host name is "postgres" — that's the name of the database container.
   DATABASE_URL=postgresql://menuuser:<a-strong-database-password>@postgres:5432/menu_saas
   DIRECT_URL=postgresql://menuuser:<a-strong-database-password>@postgres:5432/menu_saas
   ```

   > Keep the same password in `POSTGRES_PASSWORD`, `DATABASE_URL` and
   > `DIRECT_URL`, and the same username in all three. The app talks to the
   > database through the `postgres` host name inside Docker.
   >
   > Make sure AUTH_SECRET is a long random string — generate it by running:
   > `openssl rand -base64 32`

3. Double check the secret file is **not** tracked by git (it isn't — the
   project's `.gitignore` already excludes `.env*`).

**Checkpoint:** `ls -la ~/app` shows the `.env` file sitting next to
`docker-compose.yml`.

---

## Step 7 — Build & start the app + database containers

1. Replace `docker-compose.yml` on the server with the expanded version:

   ```bash
   cd ~/app
   nano docker-compose.yml
   ```

   Paste this content (it adds the app and the migration services on top of
   what we already had):

   ```yaml
   version: "3.9"

   services:
     postgres:
       image: postgres:16-alpine
       container_name: menu-saas-postgres
       restart: unless-stopped
       environment:
         POSTGRES_USER: ${POSTGRES_USER}
         POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
         POSTGRES_DB: ${POSTGRES_DB}
       ports:
         - "127.0.0.1:5432:5432"
       volumes:
         - postgres_data:/var/lib/postgresql/data
       healthcheck:
         test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
         interval: 10s
         timeout: 5s
         retries: 5

     app:
       build: .
       container_name: menu-saas-app
       restart: unless-stopped
       ports:
         - "127.0.0.1:3000:3000"
       environment:
         AUTH_SECRET: ${AUTH_SECRET}
         NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL}
         DATABASE_URL: ${DATABASE_URL}
         DIRECT_URL: ${DIRECT_URL}
       depends_on:
         postgres:
           condition: service_healthy

     migrate:
       image: menu-saas-migrate
       build:
         context: .
         target: builder
       environment:
         DATABASE_URL: ${DATABASE_URL}
         DIRECT_URL: ${DIRECT_URL}
       depends_on:
         postgres:
           condition: service_healthy
       command: npx prisma migrate deploy

     seed:
       image: menu-saas-seed
       build:
         context: .
         target: builder
       environment:
         DATABASE_URL: ${DATABASE_URL}
         DIRECT_URL: ${DIRECT_URL}
       depends_on:
         postgres:
           condition: service_healthy
       command: npx prisma db seed

   volumes:
     postgres_data:
   ```

   > Why `127.0.0.1:` on the ports? It makes the database and the app reachable
   > only from the server itself, not from the public internet. Only nginx
   > (Step 10) talks to the app. This is important for security.
   >
   > `migrate` and `seed` are one-time helper jobs: `migrate` creates the
   > database tables, `seed` loads the demo restaurant so we can test.

2. Build the containers (this takes a few minutes the first time — normal):

   ```bash
   cd ~/app
   docker compose build
   ```

3. Create the database tables (runs the migrations — do this once):

   ```bash
   docker compose run --rm migrate
   ```

4. Load the demo data (super admin + demo restaurant — do this once):

   ```bash
   docker compose run --rm seed
   ```

5. Start the app and database:

   ```bash
   docker compose up -d
   ```

6. Check everything is running:

   ```bash
   docker compose ps
   ```

   All services should show `Up` and `healthy` (may take a minute).

**Checkpoint:** `docker compose ps` shows `app` and `postgres` as Up/healthy.

---

## Step 8 — Test the app on the server (before nginx)

The app is now running but only reachable from the server itself. Test it:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/
```

Expect `200`.

You can also peek at the app's logs (handy for solving problems):

```bash
docker compose logs -f app
```

Press `Ctrl+C` to stop watching.

**Checkpoint:** the curl command prints `200`. If it prints something else,
share the output of `docker compose logs app` — we'll fix it before moving on.

---

## Step 9 — Install & configure nginx (the "front door")

nginx is the web server that takes HTTPS requests from the internet and hands
them to our app.

1. Install nginx on the server (not in a container):

   ```bash
   apt install -y nginx
   ```

2. Create a config file for our app:

   ```bash
   nano /etc/nginx/sites-available/menu-saas
   ```

   Paste:

   ```nginx
   server {
       listen 80;
       server_name <your-domain> www.<your-domain>;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

   Replace `<your-domain>` with the real domain (no `https://`, just
   `menusaas.com`).

3. Enable the site (link it into the active folder) and remove the default one:

   ```bash
   ln -s /etc/nginx/sites-available/menu-saas /etc/nginx/sites-enabled/
   rm /etc/nginx/sites-enabled/default
   ```

4. Test the nginx config, then load it:

   ```bash
   nginx -t
   systemctl reload nginx
   ```

   `nginx -t` must print `syntax is ok` and `test is successful`.

5. Now test from your own laptop's browser: open `http://<server-ip>`.
   You should see the MenuQR landing page (the DNS from Step 3 may also route
   `http://<your-domain>` here).

**Checkpoint:** visiting `http://<your-domain>` in a browser shows the MenuQR
homepage. Don't worry that it's only "http" for now — HTTPS is next.

---

## Step 10 — HTTPS with a free, automatic certificate (Let's Encrypt)

This makes the browser show a secure 🔒 padlock. The certificate is free and
renews itself automatically.

1. Install Certbot (automates the whole thing):

   ```bash
   apt install -y certbot python3-certbot-nginx
   ```

2. Issue the certificate for our domain. It asks a few questions — answer
   "no" to redirect if offered (it'll be set automatically in a moment):
   - Email address: an email you own.
   - Agree to terms: `Y`.

   ```bash
   certbot --nginx -d <your-domain> -d www.<your-domain>
   ```

   Certbot automatically fixes the nginx config: enables HTTPS and
   redirects `http://` to `https://`.

3. Test that it will auto-renew (certs last 90 days; Certbot sets a timer
   that wakes up and renews before expiry):

   ```bash
   certbot renew --dry-run
   ```

   It should end with `Congratulations, all simulated renewals succeeded`.

4. Re-check nginx is happy:

   ```bash
   nginx -t && systemctl reload nginx
   ```

**Checkpoint:** in a browser, `https://<your-domain>` shows the MenuQR page
with a padlock, and `http://<your-domain>` jumps to `https://`.

---

## Step 11 — Final end-to-end tests (do these from your laptop)

Log in to the app the same way a real restaurant owner would:

1. Open `https://<your-domain>/login`
2. Sign in as the **Super Admin** (from Step 7's seed):
   - Email: `admin@menusaas.com`
   - Password: `Admin123!`
3. You should land on the Super Admin dashboard. Create the client's restaurant
   (name, owner email, temp password, number of tables).
4. Log out, then log in as the new restaurant owner using the credentials just
   created.
5. From the admin Tables page, open a table's QR link. It should open
   `https://<your-domain>/r/<restaurant-slug>/<table-token>` on **our domain**
   (not localhost, not `.vercel.app`). If it still shows a wrong URL, the
   `NEXT_PUBLIC_APP_URL` in `.env` is wrong — fix it with `nano ~/app/.env`,
   then `docker compose up -d --build app`.
6. Simulate a customer: add an item to the cart, place an order. Within 3
   seconds the order should appear in the admin **Orders** page, and you can
   advance its status (Pending → Accepted → Preparing → Ready → Completed).
7. Ask the demo/real restaurant to scan a printed QR from their phone (phone
   must be on mobile data, not the same Wi-Fi — that proves it's public).

**Checkpoint:** full order flow works over HTTPS on the public domain, from
phone and laptop.

---

## Step 12 — Backups (do this now, don't skip)

A self-hosted server doesn't back itself up. If the disk dies, the data is
gone. Let's make nightly backups.

1. Create a backup folder and a backup script:

   ```bash
   mkdir -p /var/backups/menu-saas
   nano /root/backup.sh
   ```

   Paste:

   ```bash
   #!/bin/bash
   cd ~/app
   docker compose exec -T postgres pg_dump -U ${POSTGRES_USER} ${POSTGRES_DB} \
     | gzip > /var/backups/menu-saas/menu_saas_$(date +\%F).sql.gz
   find /var/backups/menu-saas -name "*.sql.gz" -mtime +14 -delete
   ```

   Make it runnable:

   ```bash
   chmod +x /root/backup.sh
   ```

2. Run it once to make sure it works:

   ```bash
   /root/backup.sh && ls -lh /var/backups/menu-saas/
   ```

   You should see a `.sql.gz` file that is not empty (a few KB at least).

3. Schedule it every night at 3 AM:

   ```bash
   crontab -e
   ```

   Add this line (when the editor opens, paste it, save & exit):

   ```
   0 3 * * * /root/backup.sh >> /var/log/menu-saas-backup.log 2>&1
   ```

**Strongly recommended next step:** copy backups off the server too (so a
server failure can't destroy them too). The cheapest option is Alibaba Cloud
**OSS** (object storage) plus a small tool like `rclone`. Ask us before that —
it's 15 extra minutes and worth it since we have our first client.

**Checkpoint:** `/var/backups/menu-saas/` contains at least one `.sql.gz` file,
and `crontab -l` shows the nightly job.

---

## Step 13 — How we update the app later

Simple routine (a few minutes). From your laptop:

1. Make code changes, commit, push to GitHub (normal workflow).
2. On the server:

   ```bash
   cd ~/app
   git pull
   ```

3. If the database schema changed, run migrations first:

   ```bash
   docker compose run --rm migrate
   ```

4. Rebuild and restart the app:

   ```bash
   docker compose up -d --build app
   ```

5. Check it's healthy:

   ```bash
   docker compose ps
   ```

That's it. nginx and HTTPS need no touching — they just keep working.

---

## Troubleshooting

| Problem | What it means | Fix |
|---------|---------------|-----|
| `502 Bad Gateway` in the browser | nginx can't reach the app container | `docker compose up -d app`, then `docker compose ps`; check `docker compose logs app` |
| Domain shows "site not found" | DNS not pointing at server / still spreading | Wait a few hours; verify `ping <your-domain>` returns the server IP (Step 3) |
| Login error "Configuration" | `AUTH_SECRET` missing or changed | Re-create `.env` with a fresh `AUTH_SECRET` (Step 6), `docker compose up -d --build app` |
| App works on laptop but not on phone QR | Phone cached the old app URL | Ask the restaurnt to scan a fresh QR; if QR points to old domain, fix `NEXT_PUBLIC_APP_URL` and rebuild |
| Can't log in over SSH | Wrong password or port 22 blocked | Re-check Security Group (Step 2) has `TCP 22` |
| Certificate about to expire | Auto-renew job failed | Run `certbot renew`; check `docker` timer: `systemctl list-timers \| grep certbot` |
| Tables missing / duplicate errors | Migrations not run | `docker compose run --rm migrate` |
| `docker compose build` is slow | Normal on first build | It's fine; later builds use a cache and are fast |

**Useful log commands**

```bash
docker compose logs app          # app logs (orders, errors, logins)
docker compose logs postgres     # database logs
nginx -t                         # check nginx config is valid
```

---

## Recap — where things live

| Thing | Where |
|-------|-------|
| App running | Docker container `menu-saas-app`, port 3000 (localhost only) |
| Database | Docker container `menu-saas-postgres`, port 5432 (localhost only) |
| Database data (files) | Docker volume `postgres_data` (survives container restarts) |
| Web server | nginx on the server, ports 80/443 |
| Certificate | Let's Encrypt, auto-renewed by Certbot |
| Env secrets | `~/app/.env` on the server (never in git) |
| Backups | `/var/backups/menu-saas/` nightly at 3 AM |
| Code updates | `git pull` + `docker compose up -d --build app` on the server |