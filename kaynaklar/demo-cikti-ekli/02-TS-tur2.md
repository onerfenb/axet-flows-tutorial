# Teknik Sartname (Düzeltme Tur 2)

## 1. Genel Bakis

**Program:** `ZMM_R_KRITIK_STOK_UYARI`  
**Sistem:** SAP S/4HANA 2023 (on-premise)  
**Paket:** `ZMM_RAPOR`  
**Hedef:** Merkez depo (1000) ve üretim deposu (1200) kritik malzeme stok kontrolü, iş günleri sabah 07:30'da otomatik raporlama + XLSX e-posta gönderimi.

**Çıktı:**
- ALV raporu (2 sekme: KRİTİK+UYARI / İZLE)
- XLSX eki (e-posta)

**Performans Hedefi:** ≤30 sn (200 kritik malzeme)

---

## 2. Veri Kaynaklari

### 2.1 Tablolar ve Alanlar

| Tablo | Alanlar | Amaç |
|-------|---------|------|
| **ZMM_KRITIK_MAT** | MATNR, WERKS, AKTIV | Kritik malzeme tanımı (veri kaynağı: Z-tablo, Excel import, veya malzeme sınıfı) |
| **MARD** | MATNR, WERKS, LGORT, LABST | Depoda kullanılabilir stok |
| **MARC** | MATNR, WERKS, MINBE | Minimum stok seviyesi |
| **MAKT** | MATNR, SPRAS, MAKTX | Malzeme tanımı (TR dilinde) |
| **EKPO** | EBELN, EBELP, MATNR, WERKS, LOEKZ | Satınalma siparişi başlığı (loekz ≠ "X") |
| **EKET** | EBELN, EBELP, EINDT, RBNR | Sipariş teslim tarihi |
| **TFACD** | DATE, HOLIDAY | Tatil takvimi (fabrika) |
| **ZMM_CONF_EMAIL** | MAIL_TO, MAIL_FROM, SMTP_ADDR | E-posta alıcı konfigürasyonu |

### 2.2 Kritik Malzeme Kaynağı (AQ-01 Çözüm)

**Seçilen Çözüm:** Z-tablo `ZMM_KRITIK_MAT` (WERKS + MATNR + AKTIV alanları)  
**Veri Yönetimi:**
- Excel import modülü: `ZMM_F_IMPORT_KRITIK_MAT` (haftalık manual veya API)
- Alternatif: Malzeme sınıflandırma alanı `MARA.ZMAT_KLT` = "K" kullanılabilir (gelecek faz)
- **Karar:** FS ekibinden onay alındığında, Z-tablo öncelikli kullanılacak

---

## 3. Program Yapisi

### 3.1 Ana Program: `ZMM_R_KRITIK_STOK_UYARI`

```
ZMM_R_KRITIK_STOK_UYARI (SE38, Rapor Programı)
├─ PERFORM F_INIT
├─ PERFORM F_CHECK_WORKDAY (AQ-04 çözüm: TFACD tablosu)
├─ PERFORM F_READ_KRITIK_MAT
├─ PERFORM F_READ_STOK_DATA (MARD + MARC paralel SELECT)
├─ PERFORM F_READ_PO_DATA (EKPO + EKET; COALESCE + GROUP BY)
├─ PERFORM F_CLASSIFY_STATUS (KRİTİK / UYARI / İZLE)
├─ PERFORM F_BUILD_ALV (2 sekme)
├─ IF p_batch = 'X'
│   └─ PERFORM F_SEND_EMAIL (XLSX + ZMM_CONF_EMAIL)
└─ PERFORM F_DISPLAY_ALV
```

### 3.2 Veri Yapilari

```abap
* Ana çalışma tablosu
TYPES: BEGIN OF ty_stok_alert,
  matnr        TYPE matnr,
  maktx        TYPE maktx,
  werks        TYPE werks_d,
  lgort        TYPE lgort_d,
  labst        TYPE labst,
  minbe        TYPE minbe,
  status       TYPE char1,  "K/U/I
  po_gecikmis  TYPE char1,  "X
  po_no        TYPE ebeln,
  po_tarih     TYPE eindt,
END OF ty_stok_alert.

TYPES: tt_stok_alert TYPE STANDARD TABLE OF ty_stok_alert WITH KEY matnr werks lgort.

* E-posta konfigürasyonu
TYPES: BEGIN OF ty_email_conf,
  mail_to      TYPE ad_smtpaddr,
  mail_from    TYPE ad_smtpaddr,
END OF ty_email_conf.
```

### 3.3 Modüler Fonksiyonlar

| Modül | Girdi | Çıktı | Notlar |
|-------|-------|-------|--------|
| `ZMM_F_CHECK_WORKDAY` | SY-DATUM | sy-ucomm (proceed/skip) | TFACD fabrika takvimi kontrolü (AQ-04) |
| `ZMM_F_READ_KRITIK_MAT` | WERKS aralığı | tt_kritik_mat | Z-tablo okuması; aktif kalemler (AKTIV='X') |
| `ZMM_F_READ_STOK_DATA` | tt_kritik_mat | tt_stok_alert (labst, minbe) | Paralel SELECT MARD+MARC (INDEX MATNR, WERKS) |
| `ZMM_F_READ_PO_DATA` | tt_kritik_mat | tt_po_aktif (ekpo tarafından JOIN) | AQ-04 açıklama: loekz ≠ "X" + ESTAT kontrol |
| `ZMM_F_CHECK_PO_DELAY` | ty_stok_alert, EKET.EINDT | po_gecikmis='X' | Bugün ≤ EINDT → gecikmis='X' |
| `ZMM_F_CLASSIFY_STATUS` | labst, minbe | status (K/U/I) | KRİTİK: labst=0; UYARI: 0<labst<minbe; İZLE: minbe≤labst<minbe×1.5 |
| `ZMM_F_SEND_EMAIL` | tt_stok_alert, ZMM_CONF_EMAIL | log | XLSX dönüştürme + SO_NEW_DOCUMENT_ATT_SEND_API1 (AQ-02 çözüm: ALV alanları + optional İZLE) |

---

## 4. Algoritma

### 4.1 Günlük İş Akışı (SM36 Tetiklemesi)

1. **07:30 tetiklemesi** → Program batch modda çalışır (`p_batch='X'`)
2. **Çalışma günü kontrolü:** `TFACD` tablosundan fabrika takvimi okuması (AQ-04 çözüm)
   - Gün tatil ise `sy-ucomm = 'SKIP'` → program sonlanır
3. **Kritik malzeme listesi:** `ZMM_KRITIK_MAT` tablosundan WERKS 1000, 1200 kalemler
4. **Stok sorgusu (paralel):**
   ```sql
   SELECT matnr, labst FROM MARD WHERE matnr IN kritik_list AND werks IN (1000, 1200)
   SELECT matnr, minbe FROM MARC WHERE matnr IN kritik_list AND werks IN (1000, 1200)
   INNER JOIN
   ```
5. **PO sorgusu (aktif siparişler):**
   ```sql
   SELECT ekpo~ebeln, ekpo~matnr, eket~eindt FROM ekpo 
   INNER JOIN eket ON ekpo~ebeln = eket~ebeln AND ekpo~ebelp = eket~ebelp
   WHERE ekpo~loekz <> 'X' AND eket~eindt >= sy-datum  
   (AQ-04: loekz='' + ESTAT kontrol)
   ```
6. **Gecikmiş PO tespiti:** `EKET.EINDT < sy-datum` → `po_gecikmis='X'`
7. **Durum sınıflandırması:**
   - Gecikmiş PO varsa → uyarı gösterilir
   - Aktif PO ve teslim tarihi ≥ bugün → stok uyarısı **bastırılır**
8. **ALV çıktısı (2 sekme):**
   - Tab 1: KRİTİK (labst=0) + UYARI (0<labst<minbe) kalemler
   - Tab 2: İZLE (minbe≤labst<minbe×1.5) kalemler
9. **E-posta (batch modda):**
   - `ZMM_CONF_EMAIL` tablosundan alıcıları oku
   - XLSX dönüştürme (main tab alanları: MATNR, MAKTX, WERKS, LABST, MINBE, STATUS, PO_GECIKMIS)
   - (AQ-05 kararı: İZLE sekmesi FS onayı bekliyor; default: main tab + not)

### 4.2 Performans Optimizasyonları

- **Index:** MARD (MATNR + WERKS), EKPO (MATNR + LOEKZ), EKET (EBELN + EBELP)
- **Buffer:** `MAKT` TR dili setlemesi (single pass)
- **Paralel SELECT:** MARD ve MARC ayrı ayrı (DB optimizer)
- **Limit:** 200 kritik malzeme × 2 depo = 400 max satır (30 sn hedef ✓)

---

## 5. Yetki ve Zamanlama

### 5.1 Yetki (AQ-03 Çözüm)

**Rol: `ZMM_RAPOR_USER`** (PM tarafından oluşturulacak)

| İzin Objesi | Aktivite | Kimler |
|-------------|----------|--------|
| **S_REPORT** | RZR_RREP (Rapor çalıştırma) | Program: ZMM_R_KRITIK_STOK_UYARI |
| **M_MATE_WRK** | 03 (Okuma) | WERKS: 1000, 1200 |
| **S_BTCH_NAM** | ZMMSTOK_ALERT (Batch işi) | SM36 arka plan işi |
| **S_TCODE** | SM50 (Process monitor - optional e-posta takip için) | TS Admin |

**Z-tablo Okuma:** `ZMM_KRITIK_MAT` → M_MATE_WRK'ye bağlı (WERKS kontrolü)

**E-posta Yetkileri:**
- SMTP gönderici: `ZMM_CONF_EMAIL.MAIL_FROM` (SO01 yetkilendirmesi)
- Alıcı yetkilendirmesi: `ZMM_CONF_EMAIL.MAIL_TO` (manuel teyit)

### 5.2 Arka Plan İşi (SM36)

| Parametre | Değer |
|-----------|-------|
| **Job Adı** | `ZMM_STOK_UYARI_GUNLUK` |
| **Program** | `ZMM_R_KRITIK_STOK_UYARI` |
| **Başlangıç** | İş günü 07:30 (TFACD kontrolü) |
| **Tekrar** | Günlük (MON-FRI, tatiller hariç) |
| **Kullanıcı** | Batch user (`ZMMBATCH`) |
| **Parametreler** | `p_batch='X'`, `p_werks_from=1000`, `p_werks_to=1200` |

---

## 6. Test Senaryolari

| Senaryo | Girdi | Beklenen Çıktı | Test İşlemi |
|---------|-------|-----------------|-------------|
| **T1: Kritik stok (labst=0)** | MATNR X, labst=0, minbe=10 | Status=K (Ana sekme) | MARD.LABST = 0 için kontrol |
| **T2: Uyarı stok (0<labst<minbe)** | MATNR Y, labst=5, minbe=10 | Status=U (Ana sekme) | Sınır kontrolü |
| **T3: İzle stok (minbe≤labst<minbe×1.5)** | MATNR Z, labst=15, minbe=10 | Status=İ (Tab 2) | 10≤15<15 doğru |
| **T4: Aktif PO teslimi bugün+1** | MATNR X, PO EINDT=+1 gün | Uyarı **bastırılır** (PO varsa) | EKPO+EKET JOIN, EINDT ≥ sy-datum |
| **T5: Gecikmiş PO** | MATNR X, PO EINDT=-1 gün | po_gecikmis='X' + not | EINDT < sy-datum flag |
| **T6: Tatil günü** | Cumartesi / 01.01 | Program skip (`TFACD` kontrolü) | TFACD.HOLIDAY='X' |
| **T7: E-posta XLSX** | p_batch='X' | XLSX eki (main sekme alanları) | SO_NEW_DOCUMENT_ATT_SEND_API1 check |
| **T8: ALV 2 sekme** | Mix K+U+İ satırları | Ana tab: K+U; Tab2: İ | CL_SALV_TABLE~SET_SCREEN_STATUS |

---

## Açıklama: AQ Çözümü Özeti

| AQ | Çözüm | TS Konumu |
|----|-------|-----------|
| **AQ-01** | Z-tablo `ZMM_KRITIK_MAT` (WERKS+MATNR+AKTIV), Excel import modülü | 2.2, 3.1 |
| **AQ-02** | ALV alanları fix: MATNR, MAKTX, WERKS, LABST, MINBE, STATUS, PO_GECIKMIS | 3.2, 4.1, 6 |
| **AQ-03** | Rol `ZMM_RAPOR_USER` + M_MATE_WRK (03), SMTP yetkileri | 5.1 |
| **AQ-04** | `TFACD` tablo kontrolü fonksiyonu `ZMM_F_CHECK_WORKDAY` | 2.1, 3.3, 4.1 |
| **AQ-05** | Default: Main tab (K+U) XLSX, İZLE optional (FS onayı bekleme) | 4.1, 6 |