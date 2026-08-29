# Teknik Sartname
**Belge No:** ZMM_R_STOK_UYARI-TS-002 (Düzeltme Turu 2)  
**Tarih:** 2025 | **Revizyon:** Bulgu Düzeltmesi

---

## 1. Genel Bakis

**Program Adı:** ZMM_R_STOK_UYARI  
**Tür:** ABAP Rapor (SE38) + Batch Job (SM37)  
**Hedef:** SAP S/4HANA 2023 (Merkez 1000, 1200)

Stok seviyeleri KRİTİK/UYARI/İZLE kategorilerinde sınıflandırılır. **Tüm açık sipariş analizi** yapılır; gecikmeli sipariş varsa "GECİKMİŞ" bayrağı eklenir. Manuel ALV çıktı + otomatik batch e-posta (07:30, iş günü).

---

## 2. Veri Kaynaklari

| Tablo | Alanlar | Koşul |
|---|---|---|
| **MARD** | MATNR, WERKS, LABST | werks IN (1000, 1200) |
| **MARC** | MATNR, WERKS, MINBE | Minimum seviye kaynağı |
| **MAKT** | MATNR, SPRAS, MAKTX | Malzeme tanımı (SPRAS='T') |
| **EKPO** | EBELN, EBELP, MATNR, WERKS | Açık sipariş (LOEKZ=' ') |
| **EKET** | EBELN, EBELP, EINDT | Teslim tarihi; BSART='NB' |
| **T005S** | FABKA, DATUM, ** | Fabrika takvimi (iş günü) |

**FM:** `HOLIDAYS_GET` (iş günü tarafı kontrolü)

---

## 3. Program Yapisi

### 3.1 Veri Yapilari

```abap
TYPES: BEGIN OF ts_stok_item,
  matnr TYPE mard-matnr,
  werks TYPE mard-werks,
  labst TYPE mard-labst,
  minbe TYPE marc-minbe,
  maktx TYPE makt-maktx,
  kategori TYPE c,        "K=KRİTİK, W=UYARI, Z=İZLE
  po_flag TYPE c,         "P=PO_VAR, G=GECİKMİŞ, BOŞSA_YOK
  po_ebeln TYPE ekpo-ebeln,
  po_eindt TYPE eket-eindt,
END OF ts_stok_item.

TYPES: t_stok_list TYPE TABLE OF ts_stok_item WITH KEY matnr werks.
```

**Program Seçim Ekranı:**
- `p_date` (Referans Tarihi): TARİH, Varsayılan sy-datum
- `p_werks` (Merkez Range): werks-LOW, werks-HIGH
- `p_matnr` (Malzeme Range): matnr-LOW, matnr-HIGH
- `p_cat` (Kategori): K/W/Z (CHECKBOX array, "K", "W", "Z" multi-select)

**ALV Tablo Yapı:**
```abap
DATA: gt_alv TYPE STANDARD TABLE OF ts_stok_item,
      gs_alv TYPE ts_stok_item.
```

---

## 4. Algoritma

### 4.1 Stok Verisi Doldurma (fill_stok_data)

**INPUT:** p_date, p_werks[], p_matnr[], p_cat[]  
**OUTPUT:** gt_stok (t_stok_list)

1. MARD JOIN MARC JOIN MAKT: `MARD.WERKS IN (1000,1200)` + parametreler
2. **MINBE=0 Edge Case:** 
   - `IF marc-minbe = 0 THEN CONTINUE` (kapsam dışı)
3. Kategorilendirme:
   - `IF labst = 0 THEN kategori='K'`
   - `ELSEIF labst < minbe THEN kategori='W'`
   - `ELSEIF labst < minbe * 1.5 THEN kategori='Z'`
   - `ELSE CONTINUE` (rapora dahil etme)
4. Filtrele: `kategori IN p_cat[]`

---

### 4.2 Açık Sipariş Kontrolü (check_open_po)

**INPUT:** gt_stok, p_date  
**OUTPUT:** gt_stok[po_flag, po_ebeln, po_eindt] güncelle

**DÜZELTİLMİŞ SORGU:**
```sql
SELECT ebeln, ebelp, matnr, werks, eindt
  FROM ekpo INNER JOIN eket ON ebeln/ebelp
  WHERE ekpo~loekz = ' '              -- Açık sipariş
    AND ekpo~bsart = 'NB'             -- Satın alma siparişi
    AND matnr IN (gt_stok-matnr[])
    AND werks IN (1000, 1200)
    -- OHNE WHERE eindt > p_date (TÜFÜN KALDIR)
```

**Loop gt_stok:** Her kayıt için EKPO match et:
- PO bulunmazsa: `po_flag = BOŞSA` (uyarı gönderil)
- PO bulunursa:
  - `IF po_eindt >= p_date THEN po_flag='P'` (PO var, normal) → **rapora dahil etme**
  - `IF po_eindt < p_date THEN po_flag='G'` (Gecikmeli) → **rapora dahil, GECİKMİŞ notu ekle**

---

### 4.3 Kategorilendirme ve Gecikmeli Bayrak (categorize_stock)

**INPUT:** gt_stok  
**OUTPUT:** kategori + po_flag çapraz kontrol

```
Kategori: K / W / Z
PO Flag:  (boş) / P / G

Kombinasyon:
- K (LABST=0) + (PO=boş): Rapor dahil (ürün tükendi, siparişsiz)
- K + P: Rapor DİŞI (siparişli, gelecek teslim)
- K + G: Rapor dahil, "GECİKMİŞ" + kategori (stok bitti + PO gecikmeli)
- W / Z + (boş): Rapor dahil (düşük stok, siparişsiz)
- W / Z + P: Rapor DİŞI (PO gelecek)
- W / Z + G: Rapor dahil, "GECİKMİŞ" (düşük stok + PO gecikmeli)
```

---

### 4.4 ALV Çıktısı & E-posta (alv_output / send_email_batch)

**ALV Sütunlar:** MATNR, MAKTX, WERKS, LABST, MINBE, kategori, po_flag, po_ebeln, po_eindt

**E-posta (Batch Job: ZMM_R_STOK_UYARI_BATCH):**
- **Saati:** 07:30 (SM37)
- **Gün Filtresi:** T001S-FABKA='DESA', FM `HOLIDAYS_GET` çağrısı → iş günü doğru mu?
  ```abap
  CALL FUNCTION 'HOLIDAYS_GET'
    EXPORTING fabka = 'DESA'
              datum_von = sy-datum
              datum_bis = sy-datum
    IMPORTING holidays = lt_holidays.
  IF sy-datum NOT IN lt_holidays THEN "İş günü
    PERFORM send_batch_email.
  ```
- **Alıcı [AQ-01]:** SÜREÇ SORUMLUSU E-MAIL adresi (`ZMM_EMAIL_STOK_UYARI` Customizing param / SU3 değişkeni veya sabit)
- **Excel Ek:** ABAP_TO_FILE, UNI_FILENAME=`STOK_UYARI_yyyyMMdd.xlsx`
- **FM:** `SO_NEW_DOCUMENT_ATT_SEND_API1` veya `SEND_EMAIL_WITH_ATTACHMENT`
- **Hata Handling:** TRY-CATCH, hata LOG tablosu (ZMM_L_EMAIL_LOG) kaydedilir

---

## 5. Yetki ve Zamanlama

| Yetki | Nesne | Detay |
|---|---|---|
| Program Çalıştır | ZMM_R_STOK_UYARI | Kullanıcı manuel çalıştırma |
| Batch Job Tanım | SM37 | Sistem yöneticisi planı (07:30) |
| Tablo Okuma | MARD, MARC, MAKT, EKPO, EKET, T005S | Standart |
| E-posta Gönder | SMTP | Sistem konf. |

**Transport:** ZMM_RAPOR paketi / QA→Prod

---

## 6. Test Senaryolari

| Senaryo | Giriş | Beklenen Çıktı |
|---|---|---|
| T1: KRİTİK | LABST=0, SiparişYok | Kategori=K, Rapor dahil |
| T2: UYARI | LABST=5, MINBE=10, PO_Gelecek | Kategori=W, Rapor dışı (PO var) |
| T3: Gecikmeli | LABST=2, MINBE=10, PO_Geçmiş | Kategori=W, po_flag=G, "GECİKMİŞ" notu |
| T4: MINBE=0 | MINBE=0 | Atlanır (kapsam dışı) |
| T5: Batch | 07:30, İş Günü | E-posta gönderilir + LOG |
| T6: Batch | 07:30, Hafta Sonu | E-posta gönderilmez |

---

## Ekler

**Çözülen Bulgular:**
1. ✅ Sorgu WHERE kaldırıldı; tüm açık PO yüklendi, gecikmeli kontrol kategorilendirme öncesi yapılır
2. ✅ E-posta: Alıcı (Customizing), Excel formatı, FM, LOG mekanizması belirtildi
3. ✅ İş günü: HOLIDAYS_GET + FABKA='DESA' FM tanımlandı
4. ✅ MINBE=0: Kapsam dışı (CONTINUE)
5. ✅ Seçim ekranı: p_date, p_werks, p_matnr, p_cat detaylı