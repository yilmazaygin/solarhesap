# Solarhesap — Sunucu Kurulum Rehberi

Sıfır bir Ubuntu 22.04 LTS CLI sunucusunda Solarhesap'ı ayağa kaldırma adımları.

---

## 1. Sunucuyu Güncelle

```bash
sudo apt update && sudo apt upgrade -y
```

---

## 2. Docker Kur

```bash
# Gerekli paketler
sudo apt install -y ca-certificates curl gnupg

# Docker'ın resmi GPG anahtarı
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Docker deposunu ekle
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Docker'ı kur
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Kurulumu doğrula
docker --version
docker compose version
```

Mevcut kullanıcıyı `docker` grubuna ekle (sudo olmadan çalıştırmak için):

```bash
sudo usermod -aG docker $USER
newgrp docker
```

---

## 3. Port Kontrolü

`docker-compose.yml` içinde nginx portu varsayılan olarak `8080:80` şeklinde ayarlıdır (geliştirme ortamı için). Sunucuda 80. port boşsa bunu `80:80` olarak değiştir:

```bash
# docker-compose.yml içinde:
#   - "8080:80"   ← bunu
#   - "80:80"     ← buna çevir
nano docker-compose.yml
```

> 80. portu başka bir servis (ör. Traefik, Apache, host nginx) tutuyorsa ya o servisi durdur ya da Solarhesap'ı farklı bir portta bırak.

---

## 4. Projeyi Sunucuya Al

```bash
git clone <repo-url> /opt/solarhesap
cd /opt/solarhesap
```

> Alternatif: `scp` veya `rsync` ile yerel makineden kopyalayabilirsin.
> ```bash
> rsync -avz --exclude='node_modules' --exclude='.next' --exclude='.venv' \
>   ./ user@sunucu-ip:/opt/solarhesap/
> ```

---

## 4. Ortam Değişkenlerini Yapılandır

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Düzenlenmesi gereken değerler:

```env
APP_ENV=production
APP_VERSION=v0.2.0

# Tarayıcının ulaştığı gerçek domain — CORS için zorunlu
ALLOWED_ORIGINS=["https://alanadiniz.com"]

LOG_BASE_LEVEL=INFO
LOG_STREAM_HANDLER=True
```

`backend/.env` asla git'e commit edilmez (`.gitignore` tarafından korunur).

---

## 5. Rate Limit'i Ayarla (İsteğe Bağlı)

`docker-compose.yml` içindeki `nginx` servisinin `environment` bölümünde:

```yaml
API_RATE_LIMIT: "30"   # dakikada IP başına maksimum istek
```

---

## 6. Servisleri Derle ve Başlat

```bash
docker compose up -d --build
```

İlk build 5–10 dakika sürebilir (Python bağımlılıkları + Next.js derleme).

Durumu kontrol et:

```bash
docker compose ps
```

Beklenen çıktı:

```
NAME                STATUS
solarhesap-backend-1   Up (healthy)
solarhesap-frontend-1  Up
solarhesap-nginx-1     Up
```

---

## 7. Çalıştığını Doğrula

```bash
# Backend sağlık kontrolü
curl http://localhost/api/v1/

# Beklenen yanıt:
# {"status":"ok","app":"Solarhesap","version":"v0.2.0"}
```

Tarayıcıdan `http://sunucu-ip` adresine gidildiğinde uygulama açılmalıdır.

---

## 8. HTTPS Kurulumu (Let's Encrypt)

Bir alan adın varsa SSL sertifikası eklemek için önce Certbot'u kur:

```bash
sudo apt install -y certbot
```

### 8a. Sertifika Al

80. portu Certbot'a geçici olarak bırakmak için servisleri durdur:

```bash
docker compose stop nginx
sudo certbot certonly --standalone -d alanadiniz.com -d www.alanadiniz.com
docker compose start nginx
```

Sertifikalar `/etc/letsencrypt/live/alanadiniz.com/` altına kaydedilir.

### 8b. Nginx Yapılandırmasını Güncelle

`nginx/nginx.conf.template` dosyasını aşağıdaki gibi düzenle:

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=${API_RATE_LIMIT}r/m;

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

    client_max_body_size 10M;

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

Sertifika dosyalarını nginx container'ına mount etmek için `docker-compose.yml` içinde `nginx` servisine şunu ekle:

```yaml
nginx:
  volumes:
    - /etc/letsencrypt:/etc/letsencrypt:ro
  ports:
    - "80:80"
    - "443:443"
```

Ardından nginx'i yeniden başlat:

```bash
docker compose up -d --build nginx
```

### 8c. Otomatik Yenileme

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
docker compose up -d --build
```

Yalnızca backend'i güncellemek için:

```bash
docker compose up -d --build backend
```

---

## 10. Log Yönetimi

```bash
# Canlı loglar
docker compose logs -f

# Son 100 satır
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
| CORS hatası | `ALLOWED_ORIGINS` domain'ini kontrol et (protokol dahil: `https://`) |
| Build çok uzun sürüyor | Normal — ilk build'de Next.js + Python bağımlılıkları indirilir |
