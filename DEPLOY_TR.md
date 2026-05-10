# Solarhesap — Sunucu Kurulum Rehberi

Sıfır bir Ubuntu 22.04 LTS sunucusunda Solarhesap'ı adım adım ayağa kaldırma.

---

## 1. Sunucuyu Güncelle

```bash
sudo apt update && sudo apt upgrade -y
```

---

## 2. Docker'ı Kur

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

Mevcut kullanıcıyı `docker` grubuna ekle (sudo olmadan çalıştırmak için):

```bash
sudo usermod -aG docker $USER
newgrp docker
```

---

## 3. Projeyi Sunucuya Al

```bash
git clone <repo-url> /opt/solarhesap
cd /opt/solarhesap
```

Alternatif olarak yerel makineden kopyalama:

```bash
rsync -avz --exclude='node_modules' --exclude='.next' --exclude='.venv' \
  ./ kullanici@sunucu-ip:/opt/solarhesap/
```

---

## 4. Ortam Değişkenlerini Yapılandır

```bash
cp backend/.env.example backend/.env   # .env.example yoksa backend/.env oluştur
nano backend/.env
```

Zorunlu asgari değerler:

```env
APP_ENV=production
APP_VERSION=v0.2.0

LOG_BASE_LEVEL=INFO
LOG_STREAM_HANDLER=True
```

`backend/.env` asla git'e commit edilmez (`.gitignore` tarafından korunur).

---

## 5. (İsteğe Bağlı) Rate Limit Ayarla

`docker-compose.yml` içindeki `nginx` servisinin `environment` bölümünde:

```yaml
API_RATE_LIMIT: "30"   # dakikada IP başına maksimum istek
```

---

## 6. Servisleri Derle ve Başlat

```bash
docker compose -f docker-compose.yml up -d --build
```

> **Önemli:** Tek başına `docker compose up` kullanma — bu `docker-compose.override.yml` dosyasını da yükler (geliştirme modu).

İlk build 5–10 dakika sürebilir (Python bağımlılıkları + Next.js derleme).

Durum kontrolü:

```bash
docker compose ps
```

Beklenen çıktı:

```
NAME                     STATUS
solarhesap-backend-1     Up (healthy)
solarhesap-frontend-1    Up
solarhesap-nginx-1       Up
```

---

## 7. Çalıştığını Doğrula

```bash
curl http://localhost/api/v1/
# Beklenen: {"status":"ok","app":"Solarhesap","version":"v0.2.0"}
```

Tarayıcıdan `http://sunucu-ip` adresine gidildiğinde uygulama açılmalıdır.

---

## 8. HTTPS — Let's Encrypt ile SSL Sertifikası

Bir alan adın varsa Certbot ile ücretsiz SSL sertifikası ekleyebilirsin.

### 8a. Certbot'u Kur

```bash
sudo apt install -y certbot
```

### 8b. Sertifika Al

80. portu serbest bırakmak için nginx'i geçici olarak durdur:

```bash
docker compose stop nginx
sudo certbot certonly --standalone -d alanadiniz.com -d www.alanadiniz.com
docker compose start nginx
```

Sertifikalar `/etc/letsencrypt/live/alanadiniz.com/` altına kaydedilir.

### 8c. Nginx Yapılandırmasını Güncelle

`nginx/nginx.conf.template` dosyasını aşağıdaki gibi düzenle:

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=${API_RATE_LIMIT}r/m;

server_tokens off;

# HTTP → HTTPS yönlendirmesi
server {
    listen 80;
    server_name alanadiniz.com www.alanadiniz.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name alanadiniz.com www.alanadiniz.com;

    ssl_certificate     /etc/letsencrypt/live/alanadiniz.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/alanadiniz.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    client_max_body_size 1M;

    # Güvenlik başlıkları
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

### 8d. Sertifika Dosyalarını nginx Container'ına Bağla

`docker-compose.yml` içindeki `nginx` servisine volume ekle:

```yaml
nginx:
  volumes:
    - /etc/letsencrypt:/etc/letsencrypt:ro
  ports:
    - "80:80"
    - "443:443"
```

nginx'i yeniden derle ve başlat:

```bash
docker compose -f docker-compose.yml up -d --build nginx
```

### 8e. Otomatik Yenileme

```bash
sudo crontab -e
```

Şu satırı ekle:

```
0 3 * * * docker compose -f /opt/solarhesap/docker-compose.yml stop nginx && certbot renew --quiet && docker compose -f /opt/solarhesap/docker-compose.yml start nginx
```

---

## 9. Güncelleme

```bash
cd /opt/solarhesap
git pull
docker compose -f docker-compose.yml up -d --build
```

Yalnızca belirli bir servisi güncellemek için:

```bash
docker compose -f docker-compose.yml up -d --build backend
```

---

## 10. Log Yönetimi

```bash
# Tüm servisler için canlı loglar
docker compose logs -f

# Backend son 100 satır
docker compose logs --tail=100 backend

# Backend uygulama logları (volume'dan)
docker run --rm -v solarhesap_backend_logs:/logs alpine ls /logs
```

---

## Sorun Giderme

| Belirti | Kontrol |
|---|---|
| Site açılmıyor | `docker compose ps` — tüm servisler `Up` mı? |
| Backend başlamıyor | `docker compose logs backend` — `.env` eksik değer var mı? |
| 429 Too Many Requests | `API_RATE_LIMIT` değerini artır |
| Tarayıcıda CORS hatası | İsteğin nginx üzerinden gittiğini kontrol et (`/api/...`), doğrudan backend'e değil |
| Build çok uzun sürüyor | İlk build'de Next.js + Python bağımlılıkları indirilir — bu normaldir |
| Sertifika hatası | `/etc/letsencrypt/live/alanadiniz.com/` klasörünün izinlerini kontrol et |
