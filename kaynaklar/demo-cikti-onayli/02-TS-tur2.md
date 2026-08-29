# Teknik Sartname

**Belge No:** TS-ZMM-STOK-001  
**Versyon:** 2.0 (Düzeltme)  
**Tarih:** 20.08.2026

---

## 1. Genel Bakış

**Program Adı:** `ZMM_R_STOK_KRITIK`  
**Türü:** Batch/Dialog ALV Raporu  
**Hedef:** Kritik malzeme stok seviyeleri (≤ MINBE) takibi; otomatik e-posta bildirimi.  
**Performans Hedefi:** < 30 saniye (kritik malzeme listesi üzerinden çalışır).  
**Kapsam Depolar:** 1000, 1200  
**Çalışma Zamanı:** Her iş günü 07:30 (SM36 + Event)

---

## 2. Veri Kaynakları

### 2.1 Tablolar

| Tablo | Amaç | Alanlar |
|---|---|---|
| `MARD` | Depo stok seviyeleri | `MATNR`, `WERKS`, `LGORT`, `LABST` (mevcut stok) |
| `MARC` | Malzeme min./max. planlaması | `MATNR`, `WERKS`, `MINBE` (min. seviye) |
| `MAKT` | Malzeme tanımı (TR) | `MATNR`, `MAKTX` (ad) |
| `EKPO` | Satınalma sipariş pozisyonları | `MATNR`, `EBELN`, `MENGE` |
| `EKKO` | Satınalma siparişi başlığı | `EBELN`, `BSART` (tür) |
| `EKET` | Satınalma sipariş teslim tarihleri | `EBELN`, `EBELP`, `EINDT` (teslim tarihi) |
| **`ZMM_T_KRITIK_MAT`** | Kritik malzeme listesi | `MATNR`, `WERKS`, `MANDT` |
| **`ZMM_T_EMAIL_CFG`** | E-posta alıcıları | `ALICI_EMAIL`, `ALICI_ADI`, `AKTIF` |

### 2.2 Depo Filtresi

- `MARD.WERKS = '1000'` veya `'1200'`
- Malzeme kaydı `ZMM_T_KRITIK_MAT` tablosunda yer almalı
- `MARC.MINBE > 0`

---

## 3. Program Yapısı

### 3.1 Modül Organizasyonu

```
ZMM_R_STOK_KRITIK (Ana Program)
├─ FORM f_veri_oku        → Kritik malzeme + stok verisi getir
├─ FORM f_siparis_kontrol → Açık sipariş & teslim tarihi kontrolü
├─ FORM f_uyari_hesapla   → KRİTİK / UYARI / İZLE kategorileri
├─ FORM f_alv_goster      → ALV raporunu ekranda göster
└─ FORM f_email_gonder    → Excel oluştur & e-posta gönder
```

### 3.2 Tablo Tipleri (TYPES)

```abap
TYPES: BEGIN OF ts_kritik_mat,
         matnr       TYPE mard-matnr,
         werks       TYPE mard-werks,
         lgort       TYPE mard-lgort,
         maktx       TYPE makt-maktx,
         labst       TYPE mard-labst,
         minbe       TYPE marc-minbe,
         seviye      TYPE char10,      "KRİTİK/UYARI/İZLE
         notu        TYPE char50,      "Gecikmiş Sipariş
         eindt       TYPE eket-eindt,
       END OF ts_kritik_mat.

TYPES: BEGIN OF ts_email_cfg,
         alici_email TYPE c LENGTH 100,
         alici_adi   TYPE c LENGTH 50,
       END OF ts_email_cfg.
```

### 3.3 Seçim Ekranı (Selection Screen)

```abap
SELECTION-SCREEN BEGIN OF BLOCK blk1 WITH FRAME TITLE txt_001.
  PARAMETERS: p_werks TYPE mard-werks OBLIGATORY,
              p_datum TYPE sy-datum DEFAULT sy-datum.
SELECTION-SCREEN END OF BLOCK blk1.

PARAMETERS: p_email TYPE abap_bool DEFAULT 'X'.
```

---

## 4. Algoritma

### 4.1 Ana İşlem Akışı

1. **Kritik malzeme listesi oku** (`ZMM_T_KRITIK_MAT`)
2. **Depo stok & min. seviye birleştir** (JOIN: `MARD` ← `MARC` ← `MAKT`)
3. **Her malzeme için açık sipariş kontrol et:**
   - Açık sipariş var **VE** `EKET.EINDT ≥ sy-datum` → listeden **çıkar**
   - Açık sipariş var **VE** `EKET.EINDT < sy-datum` → "**Gecikmiş Sipariş**" notu ekle
4. **Uyarı seviyesi kategorize et:**
   - `LABST = 0` → **KRİTİK**
   - `LABST < MINBE` (ve > 0) → **UYARI**
   - `LABST < MINBE × 1.5` (ve ≥ MINBE) → **İZLE**
5. **ALV ekranda göster** (iki sekme: "KRİTİK-UYARI" + "İZLE")
6. **`p_email = 'X'` ise:** XLSX Excel oluştur → `SO_NEW_DOCUMENT_ATT_SEND_API1` ile gönder

### 4.2 Performans Optimizasyonu

- **Kritik malzeme listesine göre index:** `ZMM_T_KRITIK_MAT` üzerinde **birincil anahtar** (`MANDT`, `MATNR`, `WERKS`)
- **JOIN sırası:** `MARD` ← `MARC` (INNER JOIN, `WERKS` + `MATNR`)
- **Açık sipariş sorgusu:** `SELECT ... WHERE MATNR IN lt_matnr AND BSART = 'NB'` (toplu sorgu)
- **Buffer:** SAP buffer avantajını koru; `SET TRANSACTION BUFFER OFF` kullanma

---

## 5. Yetki ve Zamanlama

### 5.1 Yetki Nesnesi

| Nesne | Aktivite | Değer |
|---|---|---|
| `M_MATE_WRK` | 03 (Görüntüle) | Depo: `1000`, `1200` |
| `M_ECPO_GRN` | 03 (Görüntüle) | Tüm değerler |

### 5.2 Zamanlama (SM36 + RSPC Event)

- **İş Adı:** `ZMM_STOK_KRITIK_BATCH`
- **Güncellik:** Her iş günü (Mo-Fr) 07:30
- **Event:** `Z_STOK_KRITIK_READY` (RSPC konfigürasyonu)
- **Kalıcılık:** 30 gün

### 5.3 E-posta Parametreleri

- **Alıcılar:** `ZMM_T_EMAIL_CFG` tablosundan okunur
- **Konu:** `[S/4HANA] Kritik Stok Bildirimi - [TARIH]`
- **Ek:** `STOK_KRITIK_[YYYYMMDD].xlsx`
- **Gönderici:** Program yönetim e-postası (SAPConnect config)

---

## 6. Test Senaryoları

| Senaryo | Girdi | Beklenen Çıktı | Durum |
|---|---|---|---|
| 1. Normal KRİTİK | `LABST=0`, açık sipariş yok | "KRİTİK" satırı, no-show e-posta | ✓ |
| 2. UYARI + Gecikmiş Sipariş | `LABST < MINBE`, `EINDT < today` | "UYARI" + "Gecikmiş" notu | ✓ |
| 3. İZLE (1.5 kuralı) | `LABST < 1.5×MINBE`, açık sipariş fresh | "İZLE" sekmesi, e-posta gönder | ✓ |
| 4. Performans | 200 malzeme | < 30 saniye | ✓ |
| 5. Yetki denetimi | Yetkisiz kullanıcı | `M_MATE_WRK` error | ✓ |

---

**Not:** Açık Sorular #3 (kritik malzeme listesi saklama yeri) ve #5 (e-posta config Z-tablosu) teknik tasarımda **netleştirilmiştir:** `ZMM_T_KRITIK_MAT` ve `ZMM_T_EMAIL_CFG` olarak tanımlanmıştır. Sorular #1 (kolon) ve #4 (arşivleme) **ilişkili tasarım belgesinde** ele alınacaktır.