# Teknik Sartname
**Program:** ZMM_R_CRITICAL_STOCK | **Paket:** ZMM_RAPOR | **Platform:** SAP S/4HANA 2023

---

## 1. Genel Bakis

**Amaç:** Depolardaki kritik stok seviyelerini raporlamak, ALV gösterimi ve e-posta bildirimi sağlamak.

**Kapsam:** Depolar 1000, 1200 | ~200 malzeme | Çalışma süresi < 30 sn.

**Kritiklik Seviyesi:**
- 🔴 KRİTİK: Stok = 0
- 🟡 UYARI: 0 < Stok < MINBE
- 🟢 İZLE: MINBE ≤ Stok < 1,5 × MINBE

---

## 2. Veri Kaynaklari

| Tablo | Alan | Kullanım |
|---|---|---|
| **MARC** | MATNR, WERKS, MINBE | Minimum stok seviyesi |
| **MARD** | MATNR, WERKS, LABST | Mevcut stok miktarı |
| **MAKT** | MATNR, SPRAS, MAKTX | Malzeme kısa metni (DE) |
| **EKPO** | MATNR, WERKS, BSART, MENGE | Açık satın alma siparişi |
| **EKET** | EBELN, EBELP, EINDT, WEMNG | Sipariş teslim tarihi & miktar |

**Filtreler:**
- MARC-WERKS IN (1000, 1200)
- MARD-LABST veya MARC-MINBE boş değil
- Açık siparişi geçmiş teslim tarihi olan malzemeler dahil edilir

---

## 3. Program Yapisi

### 3.1 Program Adı & Tipi
- **Report:** `ZMM_R_CRITICAL_STOCK` (Executable program, Z paket)
- **Function Module:** `Z_FM_STOCK_CHECK` (Veri işleme)
- **Seçim Ekranı Yapısı:** `ZMM_S_CRITICAL_STOCK`

### 3.2 Tablo Yapilari

```
TYPES: BEGIN OF ty_material,
  matnr    TYPE mara-matnr,
  werks    TYPE marc-werks,
  maktx    TYPE makt-maktx,
  minbe    TYPE marc-minbe,
  labst    TYPE mard-labst,
  criticality TYPE c,          "K=KRİTİK, W=UYARI, I=İZLE
  open_po  TYPE ekpo-menge,    "Açık sipariş miktarı
  po_date  TYPE eket-eindt,    "Teslim tarihi
  status   TYPE c,             "O=Açık, D=Vadesi Geçmiş
END OF ty_material.

TYPES: ty_material_tab TYPE STANDARD TABLE OF ty_material WITH KEY matnr werks.
```

### 3.3 Seçim Ekranı Alanlari

```ABAP
SELECTION-SCREEN BEGIN OF BLOCK b01.
SELECT-OPTIONS: s_werks FOR marc-werks DEFAULT '1000' TO '1200',
                s_matgr FOR marc-matkl.
PARAMETERS: p_crit TYPE c DEFAULT 'K' "K/W/I filtresi
           ,p_email TYPE xubname DEFAULT 'STOCK_ALERTS'.
SELECTION-SCREEN END OF BLOCK b01.
```

---

## 4. Algoritma

### 4.1 Ana Akis (ZMM_R_CRITICAL_STOCK)

1. **Seçim Ekranı:** Depo, malzeme grubu, kritiklik seviyesi al
2. **FM Çağır:** `Z_FM_STOCK_CHECK` → ty_material_tab doldur
3. **ALV Göster:** Renk kodlaması (KRİTİK=kırmızı, UYARI=sarı, İZLE=yeşil)
4. **Kullanıcı Aksiyonu:** "Gönder" tuşu → `Z_FM_SEND_MAIL` çağır

### 4.2 Z_FM_STOCK_CHECK (Veri Hazirlama)

```
1. MARC + MARD JOIN → Stok & MINBE
2. EKPO + EKET JOIN → Açık PO kontrol
   - IF (PO açık ve teslim tarihi < SY-DATUM) THEN açık sayıl
3. FOR EACH malzeme:
   - Criticality belirle:
     - labst = 0 → 'K' (KRİTİK)
     - labst < minbe → 'W' (UYARI)
     - labst ≥ minbe AND labst < 1.5*minbe → 'I' (İZLE)
4. Açık PO miktarını ayrı sütunda göster
5. Seçim kriterlerine göre filtrele
```

### 4.3 Z_FM_SEND_MAIL (E-posta & Excel)

```
1. Raporlanacak satırlar (sadece K ve W) seç
2. Excel dosya oluştur (cl_fexcel sınıfı)
   - Başlıklar: Malzeme, Depo, Stok, Min.Seviye, Durum, Açık PO, Teslim Tarihi
3. E-posta gövdesi: "Kritik stok uyarı - {tarih} - {detay_sayisi} malzeme"
4. Alıcı: p_email (parametre) veya role tabanlı (BAdI_RECIPIENT)
5. SO_NEW_DOCUMENT_ATT_SEND_API1 → E-posta gönder
```

---

## 5. Yetki ve Zamanlama

| Parametre | Değer |
|---|---|
| **Yetki Nesnesi** | S_TABU_CLI (MARD, MARC, EKPO) / MM taşı |
| **Zamanlama** | Manual (ALV) + Otomatik (SM36 Job, 07:30 hergün) |
| **Job Adı** | `ZMM_STOCK_ALERT_DAILY` |
| **Variant Adı** | `ZMM_CRITICAL_STOCK_DAILY` (p_email='DL_LOGISTICS') |

---

## 6. Test Senaryolari

| # | Senaryo | Beklenen Sonuç | Durum |
|---|---------|---|---|
| TS-01 | Stok=0, MINBE>0 → KRİTİK | Kırmızı renkli, "K" seviyesi | ☐ |
| TS-02 | 0<Stok<MINBE, Açık PO geçmiş | "W" seviyesi, PO miktarı göster | ☐ |
| TS-03 | MINBE≤Stok<1.5×MINBE | "I" seviyesi, yeşil | ☐ |
| TS-04 | Depolar 1000+1200 | Her iki depo sonuçları birleşik | ☐ |
| TS-05 | Malzeme grubu filtresi | Sadece seçilen grup göster | ☐ |
| TS-06 | E-posta gönderimi | Excel ek, alıcı doğru, format OK | ☐ |
| TS-07 | 200 kayıt işlem süresi | < 30 saniye | ☐ |
| TS-08 | Açık PO (teslim tarihi>bugün) | Uyarı listesine dahil DEĞİL | ☐ |