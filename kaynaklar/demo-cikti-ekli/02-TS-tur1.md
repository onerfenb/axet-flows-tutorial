# Teknik Sartname

**Proje:** Kritik Malzeme Stok Uyarı Raporu  
**Hedef:** SAP S/4HANA 2023 On-Premise  
**Paket:** `ZMM_RAPOR`  
**Tarih:** 20.08.2026

---

## 1. Genel Bakis

Program, merkez (`1000`) ve üretim (`1200`) depolarındaki kritik malzemeleri günlük tarama yaparak minimum stok eşik altında olanları tespit eder. Sonuçları ALV raporunda gösterir ve her iş günü 07:30'da e-posta (XLSX eki) gönderir. Hedef: ≤30 saniye.

---

## 2. Veri Kaynaklari

| Tablo | Alan | Amaç |
|-------|------|------|
| `MARD` | `MATNR`, `WERKS`, `LGORT`, `LABST`, `PCHME` | Kullanılabilir stok (depo × tesis) |
| `MARC` | `MATNR`, `WERKS`, `MINBE` | Minimum stok seviyesi |
| `MAKT` | `MATNR`, `SPRAS`, `MAKTX` | Malzeme tanımı (TR) |
| `EKPO` | `MATNR`, `WERKS`, `EBELN` | Satınalma siparişi başlığı |
| `EKET` | `EBELN`, `EBELP`, `EINDT`, `MENGE` | Teslim tarihi ve miktarı |
| `ZMM_KRITIK_MAT` | `MATNR`, `BUKRS`, `ACTIVE` | Kritik malzeme listesi (Z-tablo) |
| `ZMM_EMAIL_RECV` | `RECIPIENT`, `MAIL_ADDR`, `ACTIVE` | E-posta alıcı konfigürasyonu |
| `TFACD` | `DATUM`, `FAART` | Tatil takvimi (iş günü kontrolü) |

**Z-Tablo Tasarımları:**

```
ZMM_KRITIK_MAT:
  - MATNR (char 18) PK
  - BUKRS (char 4) PK
  - ACTIVE (char 1)
  - CREATED (timestamp)
  - CHANGED (timestamp)

ZMM_EMAIL_RECV:
  - ID (char 4) PK
  - RECIPIENT (char 40)
  - MAIL_ADDR (char 100)
  - ACTIVE (char 1)
```

---

## 3. Program Yapisi

### 3.1 Ana Program: `ZMM_R_STOCK_ALERT`

**Tip:** Batch (SM36) + Interactive Report (SE38)

**Modüller:**

| Modül | Fonksiyon |
|-------|-----------|
| `ZMM_M_STOCK_ALERT` | İş mantığı ve veri sorgusu |
| `ZMM_F_CHECK_WORKDAY` | Tatil takvimi kontrolü |
| `ZMM_F_GET_CRITICAL_MAT` | Kritik malzeme listesi oku |
| `ZMM_F_GET_PO_STATUS` | Aktif PO ve teslim tarihi sorgula |
| `ZMM_F_SEND_EMAIL` | XLSX ek ve e-posta gönder |

### 3.2 Veri Yapilari

```abap
TYPES:
  BEGIN OF ty_stock_line,
    matnr        TYPE mard-matnr,
    maktx        TYPE makt-maktx,
    werks        TYPE mard-werks,
    lgort        TYPE mard-lgort,
    labst        TYPE mard-labst,
    minbe        TYPE marc-minbe,
    status       TYPE char 10,  "KRİTİK/UYARI/İZLE
    po_note      TYPE char 50,  "Gecikmiş Sipariş notu
    sort_key     TYPE i,        "Sekme sıralaması (1=KRİTİK, 2=UYARI, 3=İZLE)
  END OF ty_stock_line.

ty_stock_tab TYPE TABLE OF ty_stock_line.
```

---

## 4. Algoritma

### 4.1 Günlük İş Akışı (SM36 Tetiklemesi)

1. **Tatil Kontrolü:** `ZMM_F_CHECK_WORKDAY()` → Bugün iş günü mü? Hayırsa çık.
2. **Kritik Malzemeleri Oku:** `SELECT * FROM ZMM_KRITIK_MAT WHERE ACTIVE = 'X'` (≤200 kayıt)
3. **MARD/MARC Sorgusu (İndeksli):**
   ```sql
   SELECT mard~matnr, mard~werks, mard~lgort, mard~labst, marc~minbe
   INTO TABLE @lt_stock
   FROM mard
   INNER JOIN marc ON mard~matnr = marc~matnr 
                  AND mard~werks = marc~werks
   WHERE mard~matnr IN @critical_list
     AND mard~werks IN ('1000', '1200')
     AND mard~lgort NOT IN ('999', '999X')
     AND marc~mandt = @sy-mandt
   ```
4. **Her Satır için Durum Hesapla:**
   - `LABST = 0` → **KRİTİK** (sort_key=1)
   - `LABST < MINBE` → **UYARI** (sort_key=2)
   - `LABST < MINBE × 1.5` → **İZLE** (sort_key=3)

5. **PO Kontrolü (Paralel):**
   ```sql
   SELECT ebeln, ebelp, eindt, menge
   INTO TABLE @lt_po
   FROM ekpo INNER JOIN eket ON ebeln = eket~ebeln
   WHERE matnr = @matnr AND werks = @werks
     AND loekz = ''  "Silinmemiş
     AND eket~eindt >= CAST(sy-datum AS DATE)  "Gelecek teslim
   ```
   Eğer aktif PO ile teslim tarihi ≥ bugün → listeye ekleme.

6. **ALV Gösterimi:** 2 sekme (KRİTİK+UYARI / İZLE), sort_key'e göre sırala.
7. **E-posta Gönder:** `ZMM_F_SEND_EMAIL()` → XLSX + alıcı listesi (`ZMM_EMAIL_RECV`)

### 4.2 Performans Optimizasyonları

- **İndeks Kullanımı:** `MARD` ve `MARC` sorgusuları `(MATNR, WERKS)` indeksini kullan
- **SELECT İn-List:** Kritik malzeme listesi bellek taşıyıcı olarak geç (`@lt_critical`)
- **Depo Filtresi:** `WERKS IN ('1000', '1200')` → 2 tesis sınırı
- **JOIN Stratejisi:** EKPO/EKET birleştirmesi PO sayısı düşük, hash join ideal

---

## 5. Yetki ve Zamanlama

### 5.1 Yetki

- **Transaksiyon:** `ZMM_R_STOCK_ALERT` (SE93)
- **Yetki Nesnesi:** `M_MATE_WRK` (Malzeme, depo seviyesi)
- **Aktiviteler:** 03 (Görüntüle), 06 (Çalıştır)

### 5.2 Arka Plan İşi (SM36)

| Parametre | Değer |
|-----------|-------|
| Program | `ZMM_R_STOCK_ALERT` |
| Varyant | `DEFAULT` |
| İş Sınıfı | `A` (Ön Plan) |
| Başlangıç | Hergün 07:30 (Pazartesi–Cuma) |
| İşin Adı | `ZMM_STOCK_ALERT_DAILY` |

---

## 6. Test Senaryolari

| Senaryo | Adımlar | Beklenen Sonuç |
|---------|---------|---|
| **TS-01: KRİTİK Tespit** | MARD'da LABST=0, MINBE>0 | Durum = KRİTİK; sekme 1 |
| **TS-02: UYARI Tespit** | 0 < LABST < MINBE | Durum = UYARI; sekme 1 |
| **TS-03: İZLE Tespit** | MINBE ≤ LABST < MINBE×1.5 | Durum = İZLE; sekme 2 |
| **TS-04: Aktif PO Hariç Tutma** | Malzeme + gelecek teslim tarihi PO | Listeden çıkar |
| **TS-05: Gecikmiş PO Notu** | Malzeme + geçmiş teslim tarihi PO | "Gecikmiş Sipariş" notu göster |
| **TS-06: Tatil Günü Skip** | Cumartesi tetikleme | İş yapma (log: Tatil) |
| **TS-07: E-posta Gönderimi** | İş günü sabah 07:30 | XLSX ek alıcılara ulaş |
| **TS-08: Performans** | 200 malzeme, 2 depo | ≤30 saniye |

---

**Açık Sorular Durumu:** AQ-01 ~ AQ-07 proje yöneticisine sunul (Öner/Ayşe).