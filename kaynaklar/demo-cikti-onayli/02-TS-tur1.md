# Teknik Sartname
**Belge No:** TS-ZMM-STOK-001  
**Kaynak FS:** FS-ZMM-STOK-001  
**Tarih:** 20.08.2026

---

## 1. Genel Bakış

**Amaç:** Kritik malzeme stok seviyeleri minimum eşiğin altına düştüğünde otomatik bilgilendirme.

**Program Adı:** `ZMM_R_STOCK_ALERT`  
**Tür:** Batch + Interaktif ALV Raporu  
**Hedef Sistem:** SAP S/4HANA 2023 (on-prem), Paket: `ZMM_RAPOR`  
**Zamanlanmış Çalışma:** Her iş günü 07:30 (SM36 + RSPC event)  
**Çıktı:** ALV (interaktif) + XLSX e-posta (`SO_NEW_DOCUMENT_ATT_SEND_API1`)

---

## 2. Veri Kaynakları

### 2.1 Tablolar

| Tablo | Alan | Amaç | Join Anahtarı |
|---|---|---|---|
| **MARD** | MATNR, LGORT, LABST | Kullanılabilir stok | MATNR + LGORT |
| **MARC** | MATNR, MINBE | Minimum seviye | MATNR |
| **MAKT** | MATNR, MAKTX (SPRAS='TR') | Malzeme tanımı | MATNR |
| **EKPO** | MATNR, EBELN, EBELP | Açık PO başlık | MATNR |
| **EKKO** | EBELN, BUKRS, BSART | PO ana verileri | EBELN |
| **EKET** | EBELN, EBELP, EINDT | PO teslim tarihi | EBELN + EBELP |
| **ZMM_T_CRITIC** | MATNR, FLAG_CRITICAL | Kritik malzeme listesi* | MATNR |
| **ZMM_T_EMAIL** | LGORT, EMAIL_ADDR, ACTIVE | E-posta alıcıları* | LGORT |

*Z tabloları: Açık Soru #3, #5 çözüldükten sonra tanımlanacak.

### 2.2 Depo Filtresi
- **Dahil:** 1000 (Merkez), 1200 (Üretim)
- **Hariç:** Diğer tüm LGORT

---

## 3. Program Yapısı

### 3.1 Modül Organizasyonu

```
ZMM_R_STOCK_ALERT (Ana Program)
├── ZMMF_STOCK_ALERT (Function Module - Lojik İşleme)
├── ZMM_C_STOCK (Veri Yapısı - Ekran)
├── ZMM_C_STOCK_INTERNAL (İç Tablo Tipi)
└── ZMM_SELECTION_SCREEN (Parametre Ekranı - Batch için)

E-posta Göndericisi:
└── ZMM_EMAIL_DISPATCH (Subroutine)
```

### 3.2 Tablo Tipleri (TYPES)

```abap
TYPES: BEGIN OF ty_stock_alert,
  matnr      TYPE mard-matnr,
  lgort      TYPE mard-lgort,
  maktx      TYPE makt-maktx,
  labst      TYPE mard-labst,
  minbe      TYPE marc-minbe,
  alert_lvl  TYPE c,  "K=KRİTİK, U=UYARI, I=İZLE
  open_po    TYPE char1,  "X=Var
  eindt      TYPE eket-eindt,
  po_status  TYPE string,  "Gecikmiş Sipariş vb.
  created_on TYPE sy-datum,
END OF ty_stock_alert.

TYPES: t_stock_alert TYPE STANDARD TABLE OF ty_stock_alert
       WITH KEY matnr lgort.
```

### 3.3 Seçim Ekranı (SE80)

```abap
PARAMETERS:
  p_lgort TYPE mard-lgort DEFAULT '1000' OBLIGATORY.
  p_date  TYPE sy-datum DEFAULT sy-datum.
  p_send_mail TYPE c DEFAULT 'X'.  "Y/N
```

---

## 4. Algoritma

### 4.1 Ana İşlem Akışı

1. **Veri Okuması:**
   - `ZMM_T_CRITIC` tablosundan kritik malzeme listesini oku
   - Seçili depo(lar) için MARD'dan LABST ve LGORT oku
   - MARC'dan MINBE oku
   - MAKT'dan MAKTX oku (SPRAS='TR')

2. **Açık Sipariş Kontrolü (Her malzeme için):**
   - EKPO → EKKO → EKET join: MATNR adasında açık PO var mı?
   - Varsa: EKET.EINDT ile SY-DATUM karşılaştır
     - `EINDT >= SY-DATUM` → Uyarı listesine **ALME**
     - `EINDT < SY-DATUM` → Uyarı listesine **AL** + `po_status = "Gecikmiş Sipariş"`

3. **Uyarı Seviyesi Hesapla:**
   - `LABST = 0` → alert_lvl = 'K' (KRİTİK)
   - `LABST < MINBE AND LABST > 0` → alert_lvl = 'U' (UYARI)
   - `LABST >= MINBE AND LABST < (MINBE × 1.5)` → alert_lvl = 'İ' (İZLE)

4. **Filtreleme:**
   - alert_lvl ∈ {K, U, İ} olan kayıtları tut
   - Açık sipariş şartı sağlanırsa filtreleme yap (adım 2)

5. **Sekmelendirme:**
   - Ana sekme: alert_lvl ∈ {K, U}
   - İkinci sekme: alert_lvl = 'İ'

### 4.2 Performans Optimizasyonu

- **Kritik malzeme sayısı ~200:** Sadece bu malzemeler taranır
- **Single-pass JOIN:** MARD-MARC-MAKT for all-at-once
- **Open PO kontrolü:** Indexed EKPO-EKKO-EKET (MATNR index kullanı, WHERE koşulu BSART='ZB' vb. tanımlanabilir)
- **Hedef:** < 30 saniye

---

## 5. Yetki ve Zamanlama

### 5.1 Yetki Nesnesi
- **ZMM_STOK_ALERT** (Zeynep/Öner teyit etmeli; fallback: M_MATE_WRK)

### 5.2 Zamanlama (SM36 + RSPC Event)

| Parametre | Değer |
|---|---|
| **Adı** | `ZMM_STOCK_ALERT_DAILY` |
| **Program** | `ZMM_R_STOCK_ALERT` |
| **Saat** | 07:30 (iş günleri; hafta sonu çalışmaz) |
| **Frekans** | RSPC: Hafta İçi (Pazartesi-Cuma) |
| **p_send_mail** | 'X' (otomatik gönder) |

### 5.3 E-posta Parametreleri

- **Alıcı listesi:** ZMM_T_EMAIL tablosundan (LGORT bazlı)
- **Kimden:** Sistem hesabı (SMLG, SO_USER_FULL config)
- **Ek tipi:** XLSX
- **Başlık:** "Stok Uyarısı - [Tarih]"
- **Gövde:** Konfigüre edilecek (z-tablo ZMM_T_EMAIL_TEMPLATE)

---

## 6. Test Senaryoları

| Sn. | Senaryo | Beklenen Sonuç | Durum |
|---|---|---|---|
| T1 | LABST=0, MINBE=100 | KRİTİK listesinde görünsün | □ |
| T2 | LABST=50, MINBE=100, açık PO var (EINDT>=SY-DATE) | Uyarı listesine ALINMAsin | □ |
| T3 | LABST=50, MINBE=100, açık PO var (EINDT<SY-DATE) | Uyarı listesinde + "Gecikmiş Sipariş" | □ |
| T4 | LABST=150, MINBE=100 (1.5×MINBE=150) | İZLE sekmesinde görünsün | □ |
| T5 | Depo 3000 kaydı | Filtrelenmeli (Dahil değil) | □ |
| T6 | Kritik malzeme DEĞİL | Taranmamali | □ |
| T7 | E-posta gönderimi (batch çalıştırıldığında) | XLSX ile ilgili mail alinan adres listesine gitsin | □ |
| T8 | ALV interaktif: sütun sıralama, filtre | Excel export çalişsin | □ |

---

**Açık Sorular Çözümü Beklentisi:**
- #1 (Excel kolon): Zeynep → Uygulanacak
- #3 (ZMM_T_CRITIC tablo tasarımı): Öner + Ayşe → Geliştirme başlamadan
- #5 (Email config Z-tablo): Öner → TS kabul öncesi

**İmza:** _______________  
**Tarih:** _______________