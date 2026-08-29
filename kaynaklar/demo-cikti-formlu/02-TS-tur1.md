# Teknik Sartname

**Belge No:** ZMM_R_STOK_UYARI-TS-001  
**Kaynak FS:** ZMM_R_STOK_UYARI-FS-001 (19.08.2025 esas)  
**Geliştirme Paketi:** ZMM_RAPOR  

---

## 1. Genel Bakis

**Program Adı:** ZMM_R_STOK_UYARI  
**Program Tipi:** Report (SE38)  
**Hedef Sistem:** SAP S/4HANA 2023+  
**Scope:** Merkez 1000 ve 1200 (üretim depoları)  
**Max Çalışma Süresi:** <30 saniye  
**Max Veri Hacmi:** 200 kayıt  

**Işlevler:**
1. Seçim ekranı ile manuel rapor çalıştırması (ALV)
2. Batch job ile zamanlı e-posta (Excel) gönderimi (07:30, iş günleri)
3. Stok kategorisi (KRİTİK/UYARI/İZLE) otomatik sınıflandırması
4. Açık sipariş kontrol ve gecikmeli sipariş bayrağı

---

## 2. Veri Kaynaklari

| Tablo | Açıklama | Alanlar |
|---|---|---|
| **MARD** | Depo stok verisi | MATNR, WERKS, LABST |
| **MARC** | Malzeme-merkez spesifikasyonları | MATNR, WERKS, MINBE |
| **MAKT** | Malzeme tanımı (dil spesifik) | MATNR, SPRAS, MAKTX |
| **EKPO** | Satın alma siparişi pozisyon | EBELN, EBELP, MATNR, WERKS |
| **EKET** | Satın alma siparişi teslim planlama | EBELN, EBELP, EINDT |
| **EKKO** | Satın alma siparişi header | EBELN, BSART, LOEKZ |

**Index Kullanımı:** MARD: WERKS+MATNR; EKKO: MATNR+LOEKZ (performans)

---

## 3. Program Yapisi

### 3.1 Veri Yapilari

```
TYPES: 
  BEGIN OF ty_stok_uyari,
    matnr    TYPE mard-matnr,
    maktx    TYPE makt-maktx,
    werks    TYPE mard-werks,
    labst    TYPE mard-labst,
    minbe    TYPE marc-minbe,
    kategori TYPE char10,         "KRİTİK/UYARI/İZLE
    note     TYPE char50,         "GECİKMİŞ SİPARİŞ (opsiyonel)
  END OF ty_stok_uyari,
  
  BEGIN OF ty_ekpo_open,
    matnr TYPE ekpo-matnr,
    werks TYPE ekpo-werks,
    eindt TYPE eket-eindt,
  END OF ty_ekpo_open.

DATA: gt_stok_uyari TYPE TABLE OF ty_stok_uyari,
      gt_ekpo_open  TYPE TABLE OF ty_ekpo_open,
      gv_prf_werks  TYPE char4,   "Selection parameter
      gv_prf_matnr  TYPE matnr,   "Selection parameter
      gv_prf_cat    TYPE char10.  "Selection parameter (KRİTİK/UYARI/...)
```

### 3.2 Program Sekmesi (Main Logic)

**SELECTION-SCREEN:**
- Merkez (WERKS): Default 1000, 1200 önerilir
- Malzeme No (MATNR): Opsiyonel range
- Kategori filtresi: KRİTİK / UYARI / İZLE (multiple select)
- Tarih (şu anki tarih öncesi açık sipariş): Otomatik

**START-OF-SELECTION:**
1. `PERFORM fill_stok_data` → MARD, MARC, MAKT JOIN
2. `PERFORM check_open_po` → EKPO, EKET ile açık sipariş verisi yükle
3. `PERFORM categorize_stock` → KRİTİK/UYARI/İZLE hesapla, gecikmeli sipariş flagı
4. `PERFORM alv_output` → ALV ekrana bas

---

## 4. Algoritma

### 4.1 Stok Verisi Doldurma (fill_stok_data)

```
SELECT mard~matnr, mard~werks, mard~labst,
       marc~minbe, makt~maktx
  INTO TABLE gt_stok_uyari
  FROM mard
  JOIN marc ON mard~matnr = marc~matnr 
           AND mard~werks = marc~werks
  LEFT JOIN makt ON mard~matnr = makt~matnr 
                AND makt~spras = sy-langu
  WHERE mard~werks IN (p_werks)
    AND mard~matnr IN (p_matnr).
```

**Filtre:** LABST ≥ MINBE × 1.5 olan kayıtlar hariç tutulur (WHERE LABST < MINBE * 1.5)

### 4.2 Açık Sipariş Kontrolü (check_open_po)

```
SELECT ekpo~matnr, ekpo~werks, MAX(eket~eindt) AS eindt
  INTO TABLE gt_ekpo_open
  FROM ekpo
  LEFT JOIN eket ON ekpo~ebeln = eket~ebeln 
                AND ekpo~ebelp = eket~ebelp
  JOIN ekko ON ekpo~ebeln = ekko~ebeln
  WHERE ekpo~matnr IN (gt_stok_uyari[*]-matnr)
    AND ekpo~werks IN (p_werks)
    AND ekko~bsart IN ('NB')  "Standart satın alma siparişi
    AND ekko~loekz = ' '      "Açık (silinmemiş)
    AND eket~eindt > sy-datum "Gelecek teslim tarihi
  GROUP BY ekpo~matnr, ekpo~werks.
```

### 4.3 Kategorilendirme ve Gecikmeli Bayrak (categorize_stock)

```
LOOP AT gt_stok_uyari ASSIGNING <fs_rec>.
  CLEAR <fs_rec>-note.
  
  IF <fs_rec>-labst = 0.
    <fs_rec>-kategori = 'KRİTİK'.
  ELSEIF <fs_rec>-labst < <fs_rec>-minbe.
    <fs_rec>-kategori = 'UYARI'.
  ELSEIF <fs_rec>-labst < <fs_rec>-minbe * 1.5.
    <fs_rec>-kategori = 'İZLE'.
  ENDIF.
  
  "Açık sipariş kontrolü
  READ TABLE gt_ekpo_open WITH KEY matnr = <fs_rec>-matnr
                                   werks = <fs_rec>-werks
    ASSIGNING <fs_po>.
  
  IF sy-subrc = 0.
    IF <fs_po>-eindt < sy-datum.
      "Gecikmeli sipariş → rapora dahil + nota ekle
      <fs_rec>-note = 'GECİKMİŞ SİPARİŞ'.
    ELSE.
      "Normal açık sipariş → rapora çıkar
      DELETE gt_stok_uyari.
    ENDIF.
  ENDIF.
ENDLOOP.

"Kategori filtresi uygula
IF p_cat IS NOT INITIAL.
  DELETE gt_stok_uyari WHERE kategori NOT IN (p_cat).
ENDIF.
```

### 4.4 ALV Çıktısı (alv_output)

- FM `REUSE_ALV_GRID_DISPLAY` kullanarak interaktif grid
- Sütunlar: MATNR, MAKTX, WERKS, LABST, MINBE, KATEGORI, NOTE
- Sıralama: KATEGORI (KRİTİK→UYARI→İZLE), MATNR

---

## 5. Yetki ve Zamanlama

**Authorization Objects:**
- `S_TABU_DIS` (tablo erişimi)
- `S_ACTVT` (rapor yürütme)

**Batch Job (Zamanlı E-posta):**
- **Program:** ZMM_R_STOK_UYARI
- **Çalışma Saati:** 07:30 (gün başı)
- **İş Günleri:** SCAL (fabrika takvimi T-kodu)
- **Alıcı:** FM `SO_NEW_DOCUMENT_ATT_SEND_API1` ile Excel eki
  - Alıcı list: **[AÇIK SORU AQ-01 - Müşteri onayı bekliyor]**
- **Excel Türü:** OLE2 kaynakları `.xlsx` formatı

---

## 6. Test Senaryolari

| Senaryo | Input | Beklenen Sonuç |
|---|---|---|
| **TS-01: KRİTİK Stok** | LABST=0, MINBE=100 | Kategori="KRİTİK", rapora dahil |
| **TS-02: UYARI Stok** | LABST=50, MINBE=100 | Kategori="UYARI", rapora dahil |
| **TS-03: İZLE Stok** | LABST=140, MINBE=100 | Kategori="İZLE", rapora dahil |
| **TS-04: Hariç Tutulan** | LABST=160, MINBE=100 | Rapora **dahil değil** |
| **TS-05: Açık PO (Normal)** | LABST=50, EINDT=+5 gün | Rapora **dahil değil** |
| **TS-06: Gecikmeli PO** | LABST=50, EINDT=-2 gün | NOTE="GECİKMİŞ SİPARİŞ", rapora **dahil** |
| **TS-07: Performans** | 10.000 MARD kayıt | <30 saniye |

---

## Ekler

**Açık Sorular (Çözüm Bekleniyor):**
- AQ-01: E-posta alıcı listesi
- AQ-02: Fabrika takvimi (SCAL) parametresi
- AQ-03: Sipariş tipi filtresi (yalnızca NB mi?)
- AQ-04: MINBE=0 senaryosu
- AQ-05: Seçim ekranı ek parametreleri