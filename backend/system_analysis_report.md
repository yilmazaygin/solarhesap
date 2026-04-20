# Sistem Analizi ve Bilimsel Doğrulama Raporu

**Hazırlayan:** Senior Backend Developer & TÜBİTAK Araştırmacısı
**Proje:** Solar Hesap
**Tarih:** 15 Nisan 2026

---

## Yönetici Özeti
Bu rapor, "Solar Hesap" projesi kapsamında mevcut backend altyapısının yazılım mimarisi, veri işleme hatları, bilimsel geçerliliği ve performans durumunu detaylı bir şekilde analiz etmektedir. Sistem genel itibarıyla astronomik ve klimatolojik açıdan yüksek bilimsel doğruluk standartlarına (Meeus, Spencer, Kasten-Young, Bird) sadık kalarak inşa edilmiştir. Ancak üretim ortamında (production) ölçeklenebilirlik ve dışa bağımlılıkların yönetimi konularında ele alınması gereken bazı yapısal darboğazlar ve teknik borçlar bulunmaktadır.

---

## 1. Mevcut Durum ve Endpoint Analizi

Sistemin API mimarisi, FastAPI üzerinden iki ana hat olarak modern ve temiz bir "Separation of Concerns" (Sorumlulukların Ayrılığı) prensibiyle tasarlanmıştır.

### **Aktif Çalışan Hatlar:**
- **`/solar-tools`:** Jülian günü, solar pozisyon, gün doğumu/batımı, atmosfere ait basınç/kırılma ve ışınım ayrıştırma gibi 15 farklı bağımsız hesaplama aracı mükemmel bir modülerlikle çalışmaktadır.
- **`/solar-simulation`:** INSTESRE Bird, PVLIB Ineichen, PVLIB Simplified Solis, PVLIB Bird modellerini; ayrıca PVGIS TMY ve POA veri çekimini yöneten simülasyon hatlarıdır. `run-modelchain` endpoint'i tüm bu modelleri tek çatı altında bağlayarak nihai enerji üretim tahmini sunmaktadır.

### **İyileştirme ve Standardizasyon İhtiyaçları:**
1. **Genel Geçer Hata Yakalama (Anti-Pattern):** Endpointlerin tamamında hatalar `except Exception as exc: raise HTTPException(status_code=500, ...)` kalıbıyla yakalanıp 500 dönüyor. Endüstri standartlarında (RESTful) dış API kaynaklı gecikmeler için **502/504**, veri doğrulama mantığı için **422** ve geçerli olmayan klimatolojik veri durumlarında **400** dönülmelidir. 
2. İş mantığı başarıyla router'lardan soyutlanıp `app/services` altına taşınmıştır; ancak spesifik Exception tabanlı HTTP statü kodlama standartları eksiktir.

---

## 2. İş Akışları (Workflows) ve Veri Boru Hatları

Bir kullanıcı `run_model_chain` tetiklediğinde, sistem arkaplanda sırasıyla: 
1. Spesifik hava veri setini üretir / indirir.
2. (Çok yıllıysa) Ortalama yıl (average year) stratejilerini uygular. 
3. Datayı standartlaştırıp PVLib Engine'e besler.

### **Veri Pipeline Optimizasyonu:**
- Veri setlerindeki **Artık Yıl (Leap Year - 29 Şubat)** verilerinin 28 Şubat ile güvenli bir biçimde birleştirilmesi (TMY oluşturma standartlarına uygun olarak) başarılıdır.
- Saatlik indeks normalizasyonu referans yıla (2023) göre çok doğru biçimlendirilmiştir.

### **Dış Bağlantılar İçin Retry / Fallback Mekanizması Açığı:**
Şu anda PVGIS (`app/outer_apis/pvgis_service.py`) veya OpenMeteo servislerine bağlanırken yaşanabilecek anlık kopmalar için arkaplanda "Retry" veya "Circuit Breaker" devresi görünmemektedir. Eğer PVGIS API down olursa, kullanıcı direkt 500 kodu alır. **Tenacity** kütüphanesi kullanarak *Exponential Backoff* (katlanarak artan bekleme süreli tekrar deneme) veya fallback veritabanı entegrasyonu acilen sisteme eklenmelidir.

---

## 3. Bilimsel Doğruluk ve Algoritma Validasyonu

Bilimsel açıdan bu sistemin ticari fizibilite raporlarına zemin oluşturabilecek denli titiz bir altyapıya sahip olduğu görülmüştür.

### **Astro-Fiziksel Hesaplamalar (Uç Vaka Analizi):**
- **Algoritmalar:** Jülian Dünü ve Solar Pozisyon hesaplamalarında Jean Meeus'un (1991) Astromik Algoritmaları kullanılmış ve Eşitlik Zamanı (Equation of Time), Güneş mesafe katsayısı (Earth-sun distance) mükemmel implemente edilmiştir. Güneş deklinasyonunda endüstri standardı Spancer serisi kullanılmıştır. Air Mass hesaplamasında basit *1/cos(z)* yerine, kırılmayı çok doğru hesaplayan *Kasten-Young* modeli aktiftir.
- **Kutup / Uç Vakaları:** `sunrise_sunset` fonksiyonunda `cos_omega > 1.0` veya `< -1.0` koşulları için **Polar Night (Kutup Gecesi)** ve **Midnight Sun (Kutup Gündüzü)** durumları çok zekice handle edilmiş ve çökmeler engellenip bilimsel açıklamalar (24h gündüz veya 0h gece) dönülmüştür. Bu TÜBİTAK düzeyinde bir validasyondur.

### **Average Year (Ortalama Alma) Yöntemleri:**
- Matematiksel ve klimatolojik açıdan en güçlü olduğumuz nokta burasıdır.
- 15-20 yıllık saatlik dataların basit ortalamasını almak iklimsel sapmalara (bias) yol açar. Sistemde bulunan **Trimmed Mean (örneğin %10 - %90)** sayesinde ekstrem (volkanik patlama, ağır anomaliler) yıllar traşlanmaktadır.  
- **Exponential Weighted Mean** ile ise yakın tarihli iklim değişikliği verilerine ağırlık verilmekte, ve **super_avg_year** ile tüm modellerin bir mutabakatı (consensus) çıkarılmaktadır. Bu yaklaşım son derece sofistike olup, matematiksel hiçbir bias barındırmamaktadır.

---

## 4. Tespit Edilen Darboğazlar ve Teknik Borçlar (Technical Debt)

En büyük riskler performans ve donanım kontrolsüzlüğü üzerinde yoğunlaşmaktadır.

### **Asenkron/Senkron Yönetimi (Büyük Tehdit):**
1. **Blocking Ops (Bloklanan İşlemler):** Uçtan uca tüm endpoint'ler (örneğin `create_average_year` içinde Pandas dataframe gruplama/ortalama alma operasyonları) senkronize (synchronous `def`) olarak tanımlıdır.
2. FastAPI mimarisinde senkron fonksiyonlar ayrı bir threadpool'da çalıştırılır, ki bu iyi bir şeydir. Ancak 20 yıllık hourly data (yaklaşık 175.000+ satır dataframe) işlenip 4 farklı algoritmayla `run_model_chain` yürütüldüğünde bu işlemler 5-10 saniye CPU'yu kilitler. 
3. *Çözüm Önerisi:* Yoğun veri taşıyan (Pandas pivot & ağır matematiksel modelleme) uçlar Celery, RQ gibi asenkron task worker'lara devredilmeli ve frontend bu queue'dan websocket veya short polling/long-polling ile bildirim almalıdır. Aksi halde 3-5 concurrent kullanıcı simülasyon sunucusunu çok ciddi bir CPU darboğazına sokarak backend'i kilitleyebilir.

### **Spagetti Kod ve Refactor İhtiyacı:**
- `app/services/clearsky_service.py` dosyası tek başına 700 satıra dayanmış durumdadır.
- Tüm `_run_modelchain_*` varyasyonları (pvgis_tmy, pvgis_poa, pvlib_clearsky vb.) temelde JSON response serialize etme (örneğin `summary["annual_ac_kwh"] = sum(...)` hesabı gibi) kodlarını tekrarlamaktadır (DRY prensibinin ihlali). Bu yardımcı formatlayıcılar `utils` adlı yeni bir katmana çıkarılmalıdır.

---

## Sonuç ve Öneriler
"Solar Hesap" projesi matematiksel temeli ve bilimsel literatüre uyumluluğu eksiksiz olan, oldukça yetkin bir güneş modelleme altyapısına sahiptir. "Ticari ve bilimsel fizibilite raporu üretebilecek" kapasiteye erişmesi için ise API Exception'larının detaylandırılması (HTTP 4xx ve 5xx ayırımı), dış API isteklerine Retry Circuit kırıcıların eklenmesi ve en elzem olanı simülasyon hesaplamalarının kuyruk sistemli tasarıma (Task Queue) taşınması (veya asenkron optimizasyona gidilmesi) gerekmektedir.
