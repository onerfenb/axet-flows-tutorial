# Teknik Sartname

**Belge No:** ZMM-TS-001  
**Tarih:** 20.08.2026  
**Hazirlayan:** ABAP Gelistirme  
**Referans FS:** ZMM-FS-001

---

## 1. Genel Bakis

**Program Adı:** `ZMM_R_STOK_KONTROL`  
**Tür:** ABAP Report (ALV + Background Job + Email)  
**Hedef Sistem:** SAP S/4HANA 2023 on-premise  
**Gelistirme Paketi:** `ZMM_RAPOR`

**Kapsam Depolar:** 1000 (Merkez), 1200 (Üretim)  
**Dil:** Türkçe (`SPRAS = 'TR'`)  
**Çalisma:** Hafta içi sabah 07:30, max 30 saniye  
**Malzeme Filtresi:** Kritik malzeme listesi (Z tablosu)

---

## 2. Veri Kaynaklari

### 2.1 Temel Tablolar

| Tablo | Amaç | Filtre |
|---|---|---|
| `MARD` | Depo stok seviyeleri | `MARD~WERKS IN (1000, 1200)` |
| `MARC` | Malzeme min/max seviyeleri | `MARC~WERKS IN (1000, 1200)` |
| `MAKT` | Malzeme tanimi | `MAKT~SPRAS = 'TR'` |
| `EKPO` | Satinalma satirlari | Acik siparis |
| `EKET` | Satinalma teslim tarihleri | `EKET~EINDT < sy-datum` |

### 2.2 Konfigürasyon Tablosu

**Tablo Adı:** `ZMM_T_MAILEX`  
**Yapı:** 
- `MANDT` (PK)
- `BUKRS` (PK) — İşletme
- `EMAIL_ADDR` — Alici e-posta (virgülle ayrilmis)
- `CREATED_ON`, `CHANGED_ON`

**SM30 Görünümü:** `ZMM_V_MAILEX`

### 2.3 Kritik Malzeme Tablosu

**Tablo Adı:** `ZMM_T_KRITMAT`  
**Yapı:**
- `MANDT` (PK)
- `MATNR` (PK) — Malzeme
- `KRITIK_FLAG` — 'X' = Kritik
- `CHANGED_ON`

---

## 3. Program Yapisi

### 3.1 Temel Moduller

```
ZMM_R_STOK_KONTROL
├─ FORM frm_veri_hazirla
│  ├─ Kritik malzeme listesi oku (ZMM_T_KRITMAT)
│  ├─ MARD + MARC + MAKT JOIN
│  ├─ EKPO/EKET ile acik siparis kontrol
│  └─ Hesapla: LABST vs MINBE
├─ FORM frm_stok_siniflandir
│  ├─ KRITIK: LABST = 0
│  ├─ UYARI: LABST < MINBE ve LABST >= MINBE*1.5
│  └─ İZLE: LABST < MINBE*1.5
├─ FORM frm_alv_hazirla
│  ├─ Tab 1: KRITIK + UYARI
│  └─ Tab 2: İZLE
├─ FORM frm_email_gonder
│  ├─ Alici listesi ZMM_T_MAILEX'ten oku
│  ├─ cl_salv_export_xlsx ile Excel oluştur
│  └─ SO_NEW_DOCUMENT_ATT_SEND_API1 gönder
└─ FORM frm_log_tut
   └─ ZMM_T_STOK_LOG'a kayıt
```

### 3.2 Veri Yapilari

**İç Tablo `gt_stok_rapor`:**
```
STRUCTURE: ZS_STOK_RAPOR
- MATNR          (Malzeme)
- MAKTX          (Tanim, TR)
- WERKS          (Fabrika)
- LGORT          (Depo)
- LABST          (Mevcut stok)
- MINBE          (Minimum seviye)
- STOK_DURUM    (KRITIK/UYARI/İZLE)
- ACIK_SIPARIS   (X = var, boş = yok)
- GECIKME_NOTU   (Gecikmis/Boş)
- EINDT          (Teslim tarihi)
```

---

## 4. Algoritma

### 4.1 Ana Süreç (START-OF-SELECTION)

1. **Kritik malzeme kümesi oku**
   ```
   SELECT MATNR FROM ZMM_T_KRITMAT WHERE KRITIK_FLAG = 'X'
   ```

2. **3-tablo JOIN (MARD + MARC + MAKT)**
   ```
   SELECT MARD~MATNR, MARD~LABST, MARC~MINBE, MAKT~MAKTX
   FROM MARD
   INNER JOIN MARC ON ...
   INNER JOIN MAKT ON ... WHERE SPRAS = 'TR'
   WHERE MARD~MATNR IN lt_kritmat
   AND MARD~WERKS IN (1000, 1200)
   ```

3. **Açik siparis kontrol (EKPO/EKET)**
   ```
   SELECT EBELN FROM EKPO WHERE MATNR = matnr
   INNER JOIN EKET ON ...
   WHERE ELIFN = '' (henüz teslim alınmadı)
   ```

4. **Stok sınıflandırma:**
   - IF `LABST = 0` → KRITIK
   - ELSE IF `LABST < MINBE` → UYARI (açik siparis yoksa) / İZLE (varsa)
   - ELSE IF `LABST < MINBE * 1.5` → İZLE
   - Eğer sipariş varsa ve `EINDT < sy-datum` → "Gecikmis Siparis" notu

5. **ALV 2 sekme:**
   - Sekme 1: KRITIK + UYARI
   - Sekme 2: İZLE

6. **Background Job:** Alici listesi ZMM_T_MAILEX'ten oku → Excel → E-posta

### 4.2 Performance

- **Index Kullan:** `MARD~WERKS, MARD~MATNR`, `MARC~WERKS, MARC~MATNR`
- **Batch Processing:** Max 200 malzeme → 1 SELECT
- **Timeout:** 30 saniye limit

---

## 5. Yetki ve Zamanlama

### 5.1 Yetki Nesnesi

- `M_MATE_WRK` (Malzeme Master, İş özelliği = Görüntüle)

### 5.2 Background Job (SM36)

- **İş Adı:** `ZMM_STOK_KONTROL_GUNLUK`
- **Program:** `ZMM_R_STOK_KONTROL`
- **Zamanlama:** Hafta içi (Mo-Fr) 07:30
- **Varyant:** `*DEFAULT` (tüm depolar / tüm kritik malzeme)

---

## 6. Test Senaryolari

| Senaryo | Girdi | Beklenen Çikti | Not |
|---|---|---|---|
| T1: LABST=0 | 1 malzeme, stok=0 | KRITIK satiri Tab1'de | |
| T2: LABST<MINBE | 1 malzeme, stok=50, min=100 | UYARI (açik siparis yok) | |
| T3: Gecikmis siparis | EINDT < sy-datum | "Gecikmis Siparis" notu | |
| T4: ALV 2 sekme | İZLE malzemeleri | Tab2'de görünür | |
| T5: Email eki | İçinde 2 sekme Excel | Alici listesi oku, gönder | |
| T6: Performance | 200 malzeme | < 30 saniye | |

---

**Teknik Sartname Onayı Bekleniyor:**
- ☐ Kolon listesi (Zeynep tarafindan)
- ☐ Email alici konfigürasyon (Z tablosu uygun mu?)
- ☐ Yetki nesnesi (M_MATE_WRK yeterli?)