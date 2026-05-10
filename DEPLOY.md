# Solarhesap — Deployment Guide

Step-by-step instructions to deploy Solarhesap on a fresh Ubuntu 22.04 LTS server.

---

## 1. Update the Server

```bash
sudo apt update && sudo apt upgrade -y
```

---

## 2. Install Docker

```bash
sudo apt install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

docker --version
docker compose version
```

Add your user to the `docker` group (so you can run Docker without sudo):

```bash
sudo usermod -aG docker $USER
newgrp docker
```

---

## 3. Clone the Repository

```bash
git clone <repo-url> /opt/solarhesap
cd /opt/solarhesap
```

Or copy from your local machine:

```bash
rsync -avz --exclude='node_modules' --exclude='.next' --exclude='.venv' \
  ./ user@server-ip:/opt/solarhesap/
```

---

## 4. Configure Environment Variables

```bash
cp backend/.env.example backend/.env   # if .env.example exists, otherwise create backend/.env
nano backend/.env
```

Minimum required values:

```env
APP_ENV=production
APP_VERSION=v0.2.0

# Comma-separated list of allowed frontend origins (required for CORS in production)
# Example: https://solarhesap.com,https://www.solarhesap.com
ALLOWED_ORIGINS=https://yourdomain.com

LOG_BASE_LEVEL=INFO
LOG_STREAM_HANDLER=True
```

`backend/.env` is never committed to git (protected by `.gitignore`).

---

## 5. (Optional) Adjust Rate Limiting

In `docker-compose.yml` under the `nginx` service:

```yaml
API_RATE_LIMIT: "30"   # max requests per minute per IP
```

---

## 6. Build and Start

```bash
docker compose -f docker-compose.yml up -d --build
```

> **Important:** Don't use `docker compose up` alone — that loads `docker-compose.override.yml` (development mode).

First build may take 5–10 minutes (Python dependencies + Next.js compilation).

Check status:

```bash
docker compose ps
```

Expected output:

```
NAME                     STATUS
solarhesap-backend-1     Up (healthy)
solarhesap-frontend-1    Up
solarhesap-nginx-1       Up
```

---

## 7. Verify

```bash
curl http://localhost/api/v1/
# Expected: {"status":"ok","app":"Solarhesap","version":"v0.2.0"}
```

Open `http://server-ip` in your browser — the application should load.

---

## 8. HTTPS with Let's Encrypt

If you have a domain name, add a free SSL certificate via Certbot.

### 8a. Install Certbot

```bash
sudo apt install -y certbot
```

### 8b. Obtain a Certificate

Temporarily stop nginx to free port 80:

```bash
docker compose stop nginx
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
docker compose start nginx
```

Certificates are saved to `/etc/letsencrypt/live/yourdomain.com/`.

### 8c. Update nginx Configuration

Edit `nginx/nginx.conf.template`:

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=${API_RATE_LIMIT}r/m;

server_tokens off;

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    client_max_body_size 1M;

    # Security headers
    add_header X-Content-Type-Options    "nosniff"           always;
    add_header X-Frame-Options           "SAMEORIGIN"        always;
    add_header X-XSS-Protection          "1; mode=block"     always;
    add_header Referrer-Policy           "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location /api/ {
        limit_req zone=api burst=10 nodelay;
        limit_req_status 429;
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 310s;
        proxy_send_timeout 310s;
        proxy_connect_timeout 10s;
    }

    location / {
        proxy_pass http://frontend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 8d. Mount Certificates into nginx

Add a volume to the `nginx` service in `docker-compose.yml`:

```yaml
nginx:
  volumes:
    - /etc/letsencrypt:/etc/letsencrypt:ro
  ports:
    - "80:80"
    - "443:443"
```

Rebuild nginx:

```bash
docker compose -f docker-compose.yml up -d --build nginx
```

### 8e. Update ALLOWED_ORIGINS

In `backend/.env`:

```env
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

Then restart the backend:

```bash
docker compose -f docker-compose.yml up -d backend
```

### 8f. Auto-Renewal

```bash
sudo crontab -e
```

Add this line:

```
0 3 * * * docker compose -f /opt/solarhesap/docker-compose.yml stop nginx && certbot renew --quiet && docker compose -f /opt/solarhesap/docker-compose.yml start nginx
```

---

## 9. Updating the Application

```bash
cd /opt/solarhesap
git pull
docker compose -f docker-compose.yml up -d --build
```

To rebuild only a specific service:

```bash
docker compose -f docker-compose.yml up -d --build backend
```

---

## 10. Viewing Logs

```bash
# Live logs for all services
docker compose logs -f

# Last 100 lines from backend
docker compose logs --tail=100 backend

# Backend application logs (from volume)
docker run --rm -v solarhesap_backend_logs:/logs alpine ls /logs
```

---

## Troubleshooting

| Symptom | Check |
|---|---|
| Site not loading | `docker compose ps` — are all services `Up`? |
| Backend won't start | `docker compose logs backend` — missing `.env` values? |
| 429 Too Many Requests | Increase `API_RATE_LIMIT` in `docker-compose.yml` |
| CORS error in browser | Check `ALLOWED_ORIGINS` in `backend/.env` (include protocol: `https://`) |
| Build takes too long | Normal for first build — Next.js + Python dependencies are downloaded |
| Certificate errors | Check `/etc/letsencrypt/live/yourdomain.com/` permissions |
