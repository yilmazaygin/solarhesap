# Solarhesap v0.2: Yüksek Hassasiyetli Güneş Işınımı Simülasyon Motoru

**Solarhesap**, yüksek doğruluğa sahip güneş ışınımı modellemesi, çoklu model veri orkestrasyonu ve kararlı fotovoltaik (PV) simülasyonları için tasarlanmış gelişmiş, servis odaklı bir ekosistemdir. Bir **TÜBİTAK 2209** projesi olarak desteklenen bu arka uç (v0.2), saf fiziksel ve ampirik radyasyon denklemlerini sunan, önde gelen klimatolojik araştırma kurumlarından gelen API'leri orkestre eden ve araştırmacılar için özelleştirilmiş veri seti ortalama algoritmaları sağlayan güçlü bir FastAPI uygulaması sunmaktadır.

---

## Teknik ve Bilimsel Kapasitesi

Mimari, değişen simülasyon karmaşıklıklarına hitap eden ve birbiriyle bağlantılı sistemlere bölünmüştür.

### 1. Kararlı Açık Gökyüzü (Clear-Sky) Modellemesi
Solarhesap, bulutsuz atmosferik koşullar altında kuramsal ışınım bileşenlerini (GHI, DNI, DHI, POA) saf fiziksel uygulamalar ve kararlı ampirik metodolojiler üzerinden yeniden inşa eder:

* **Saf BIRD Modeli Uygulaması**: Astronomik modelleri (Meeus algoritması), geniş bant aerosol geçirgenliklerini, Rayleigh saçılmasını, ozon soğurmasını ve yoğunlaşabilir su dinamiklerini tam olarak dönüştürebilen temel Bird & Hulstrom (1981) modeline dayanan matematiksel bir hesaplayıcı. Batan/doğmakta olan güneş ufuk noktasındayken donanımsal çökme hatalarını engelleyen (sıfır noktası ve sub-zero gün batımı kalkanları) atmosferik güvenlik eşiklerini içerir.
* **Entegre Çerçeve Yetenekleri**: Kesin koordinatları ve çok yıllı zaman dilimlerini ölçekleyip içine almak için yapılandırılmış, küresel standartlı modeller barındırır:
  * **Ineichen / Perez Modeli**: Klimatolojik Linke Bulanıklık (Turbidity) faktörü türevlerini kullanarak doğru geniş bant optik kalınlık değişimlerini çözer.
  * **Simplified Solis Modeli**: AOD sınır koşullarını kullanarak atmosferik geçirgenliği sofistike Solis spektral parametrizasyonuna uydurur.

### 2. Çok Yıllı Meteorolojik Veri Birleştirme Setleri
Sistem, belirli küresel API'lerden stabil veri hattı (ETL pipeline) kurarak geçmiş on yılların meteorolojik kalıplarını simüle edilmiş, kesin sınır koşullarıyla uyuşan zaman serilerine (time-series) yansıtır.

* **Open-Meteo Arşiv Senkronizasyonu**: Bölgesel sıcaklıkları, sınır rüzgar gradyanlarını ve çok katmanlı optik derinlikleri içeren girdileri entegre ederek, 8760 saatlik matrisler aracılığıyla yerel mikro iklimleri dinamik olarak yapılandırır.
* **PVGIS Veri Toplama Ağı**:
  * PVGIS **TMY** (Typical Meteorological Year - Tipik Meteorolojik Yıl) çıktılarını natif olarak entegre edip derler.
  * Topografik ufkun (horizon) yanı sıra kısıtlamaları doğrudan eşleştirerek, eğimli yüzeylerde (Plane of Array - POA) direkt (direct), yayılan (diffuse) ve yerden yansıyan (albedo/ground-reflected) radyasyon dinamiklerini spesifik açılarda hesaplar.

### 3. İleri Düzey Strateji Derlemesi ("Ortalama Yıl" Mimarisi)
Büyük ve çok yılları kapsayan dönemsel veriler (ör. 2005-2023), idealize edilmiş sentetik referans yıllarını inşa etmek üzere bilimsel olarak standartlaştırılmış sıkıştırma (compression) paradigmaları aracılığıyla derlenmektedir.

* **Simple Mean (Basit Ortalama) Stratejisi**: Aykırı durumları (noise) eşitleyen temel matematiksel ortalamalar üretir.
* **Trimmed Mean (Kırpılmış Ortalama) Stratejisi**: Yüzdelik (percentile) eşik değerleri kullanarak istatistiksel aykırılıkları dinamik olarak engeller (ekstrem mikro radyasyon sapmalarını temizler).
* **Exponential Weighted (Üstel Ağırlıklı) Stratejisi**: Makro iklimlerdeki son kaymalara ağırlık vererek azalan etkinin matematiksel projeksiyonlarını geçmiş fenomenler üzerine uygular (değişen iklim ışınımı gerçekliklerini saptar).
* **Consensus / Super Average Year (Görüş Birliği Stratejisi)**: Farklı matematiksel formülasyonların yarattığı varyasyonları çapraz olarak düzleştiren agresif ve yalıtılmış tek bir "kesinlik" (ground truth) veri seti kurgular.

### 4. Somut Güneş İklim Hesaplama Araçları
Astronomik geometriden sayısız nümerik eşiğe kadar inebilen kapsamlı bir saf durumsuz (stateless) algoritmik hesaplayıcı setine sahiptir:
* **Astronomik Projeksiyonlar ve Yörüngeler**: Meeus formülasyonlu Julian günü yapılandırmaları, lokal güneş öğlesinin (Solar Noon) deşifresi, Dünya dısı radyasyon (Extraterrestrial Radiation - ETR) sınırları ve net gündüz uzunluğu hesaplamaları.
* **Radyometrik Ayrıştırma ve Dönüşümler**: Yere özgü berraklık endeksi ($K_T$) verilerini kullanarak, Global sınırları (GHI) kesin Doğrudan (DNI)/Yayılan (DHI) kompozisyonlarına hizalayan dinamik *Erbs Ayrıştırmasını* bulundurur.
* **Uzamsal Optimizasyonlar**: Çift eksenleri baz alan yönelim sınırlarını hesaplar (Optimal Eğim / Azimut tespitleri) ve yapısal Geliş Açısı (Angle of Incidence) gibi vektör dış çarpım denklemlerini net bir şekilde çözer.

---

## Temel Teknolojiler ve Bağımlılıklar

* `FastAPI`: Girdi bağımlılıkları ve veri doğrulama yapılarını asenkron temelde kontrol eden yüksek performanslı web çerçevesi.
* `Pydantic`: Sistem sınırında verilerin kesin tip dönüştürmeleri ve sınır kısıtlamalarını denetleyen doğrulama birimi.
* `uvicorn`: Endpoint komutlarını entegre edip servis eden ASGI sunucusu.

## Bilimsel Teşekkürler ve Atıflar

Solarhesap'ın gücü, kamuoyuna açık bilimsel veri servislerinin ve yüksek saygınlığa sahip kütüphanelerin derinlemesine düzenlenmesi ekseninde döner. Bu arka uç üzerinden işlevselliğe ulaşan araştırmacılar bu verilerin yaratıcılarının bilimini desteklemekle yükümlüdür: 

* **BIRD Model Base Logic**: Bird, R. E., & Hulstrom, R. L. (1981). *A Simplified Clear Sky Model for Direct and Diffuse Insolation on Horizontal Surfaces*. Technical Report SERI/TR-642-761, Solar Energy Research Institute.
* **PVLIB Uygulaması**: Holmgren, W. F., Hansen, C. W., & Mikofski, M. A. (2018). *pvlib python: a python package for modeling solar energy systems*. Journal of Open Source Software, 3(29), 884.
* **PVGIS Entegrasyon Motoru**: Ham güneş ışınımı lokasyon ve simülasyon yansımaları: Avrupa Komisyonu (European Commission), Avrupa Birliği Ortak Araştırma Merkezi (JRC) *Photovoltaic Geographical Information System API'lerinden* türetilmiştir. 
* **Open-Meteo Entegrasyon Motoru**: Zippenfenig, P. (2023). *Open-Meteo.com Weather API*. Bölgesel atmosferik veri setlerini temin eden kesintisiz tarihsel veri API'si.
