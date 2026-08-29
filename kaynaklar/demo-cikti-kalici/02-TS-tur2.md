# Teknik Sartname
## 1. Genel Bakis

**Program Adı:** `ZMM_R_CRITICAL_STOCK` (Raporlama programı, S4HANA uyumlu)  
**Tipi:** Batch + Interactive Report (ALV) + Scheduled Task  
**Hedef:** SAP S/4HANA 2023  
**Performans:** <30 sn (200 kalem)

**Açıklıklar (Duzeltme Tur 2):**
- Açık PO tespiti: EKPO-BSART = 'NB' ve EKET-EINDT >= SY-DATUM (sadece normal satın alma, geçmiş TT'leri hariç)
- E-posta alıcıları: BAdI `ZMM_BADI_STOCK_RECIPIENT` ile dinamik rol tabanlı belirleme (DL_LOGISTICS hardcoded default)
- Açık miktar: EKPO-MENGE - SUM(EKET-MENGE) hesaplaması; stok dışlama IF WEMNG = 0 AND offen_menge > 0
- İZLE (I) filtresi: Seçim ekranında opsiyonel; e-postaya **KRİTİK (K) + UYARI (W)** sadece gönderilir, İZLE raporda görünür
- Dil: MAKT okuma MARA-LAEDA (material creation language) kullan, fallback DE

---

## 2. Veri Kaynaklari

| Tablo | Alan | Amaç |
|---|---|---|
| MARD | MATNR, WERKS, LABST, SPERR | Depo stok, bloklama |
| MARC | MATNR, WERKS, MINBE | Minimum seviye |
| MAKT | MATNR, LAEDA, MAKTX | Malzeme adı (dil) |
| MARA | MATNR, LAEDA, MTART, MATKL | Başlık, dil, tip, grup |
| EKPO | EBELN, EBELP, MATNR, MENGE, BSART | Açık PO satırı **BSART='NB'** |
| EKET | EBELN, EBELP, EINDT, MENGE | PO teslim planı, teslim tarihi |
| T024E | WERKS, LGORT | Depo-raf veri |

**Filtre:** WERKS IN (1000, 1200), MARD-LABST >= 0, EKPO-BSART = 'NB'

---

## 3. Program Yapisi

### 3.1 Program Adi & Tipi
- **Program:** `ZMM_R_CRITICAL_STOCK` (Report)
- **Seçim Ekrani:** `ZMM_S_STOCK_SELECTION` (Structure)
- **FM Veri:** `Z_FM_STOCK_CHECK` (Function Module)
- **FM Mail:** `Z_FM_SEND_MAIL` (Function Module)
- **BAdI:** `ZMM_BADI_STOCK_RECIPIENT` (Rol tabanlı alıcı tanımı)

### 3.2 Tablo Yapilari

**ZMM_S_STOCK_SELECTION (Seçim ekranı):**
```
- WERKS_RNG (0..1000, 1200) [Opsiyonel]
- MATKL_RNG (Malzeme grubu) [Opsiyonel]
- CRIT_LEVEL (Char 3: 'K'=Kritik, 'W'=Uyarı, 'I'=İzle) [Multi-select, default K+W]
- SEND_EMAIL (Checkbox) [Default: ☐]
- LANG_CODE (Char 1: 'D'=DE, 'T'=TR, 'E'=EN) [Default: MARA-LAEDA]
```

**ZMM_T_STOCK_OUTPUT (Çıkış tablosu):**
```
- MATNR (Material)
- MAKTX (Malzeme Adı, MAKT-LAEDA'dan okunacak)
- WERKS (Depo)
- LABST (Fiili Stok)
- MINBE (Minimum Seviye)
- WEMNG (Stok dışlama miktarı)
- NETTO_STOK = LABST - WEMNG
- OFFEN_MENGE (EKPO toplam açık)
- EINDT_PAST (Geçmiş TT varsa evet)
- CRIT_LEVEL (K/W/I) [Hesaplanan]
- MATKL (Material Group)
- LAEDA (Dil)
```

### 3.3 Seçim Ekrani Alanlari

| Alan | Tip | Zorunlu | Açıklama |
|---|---|---|---|
| p_werks | Range | Hayır | Depo (1000, 1200 default) |
| p_matkl | Range | Hayır | Malzeme grubu |
| p_crit | Multi-select | Evet | K/W/I (Uyarı seviyeleri) |
| p_email | Checkbox | Hayır | E-posta gönder |
| p_lang | Dropdown | Hayır | Dil (DE/TR/EN) |

---

## 4. Algoritma

### 4.1 Ana Akis (ZMM_R_CRITICAL_STOCK)

```
1. SELECTion-screen validate
   - p_crit boş ise hata
   - p_werks boş ise default (1000, 1200)
   
2. CALL Z_FM_STOCK_CHECK
   - EKPO join EKET, EKPO-BSART='NB' filtresi
   - Açık TT geçtiyse (EKET-EINDT < SY-DATUM) → offen_menge=0
   - Açık PO var ve TT var ise skip (liste dışı)
   - NETTO_STOK = LABST - WEMNG
   
3. KRİTİKLİK HESAPLAMASı:
   IF NETTO_STOK = 0   → CRIT_LEVEL = 'K' (KRİTİK)
   ELSEIF NETTO_STOK < MINBE → CRIT_LEVEL = 'W' (UYARI)
   ELSEIF NETTO_STOK < (MINBE * 1.5) → CRIT_LEVEL = 'I' (İZLE)
   ELSE → Skip (dahil etme)
   
4. Sonucu ZMM_T_STOCK_OUTPUT'a koy
5. p_crit filtresini uygula (K/W/I seçim)
6. ALV output, renk kodlama:
   - K → Kırmızı
   - W → Sarı
   - I → Mavi
   
7. IF p_email = ☑ THEN CALL Z_FM_SEND_MAIL (K+W'yi, I'yi hariç)
```

### 4.2 Z_FM_STOCK_CHECK (Veri Hazirlama)

```
IMPORT:
  - it_werks_rng (Depo range)
  - it_matkl_rng (Malzeme grup range)
  - p_lang_code (Dil kodu)

EXPORT:
  - et_output (ZMM_T_STOCK_OUTPUT)

LOGIC:
1. MARD JOIN MARC ON MATNR, WERKS
2. LEFT JOIN MAKT ON MAKT-LAEDA = p_lang_code (fallback DE)
3. LEFT JOIN EKPO ON EKPO-BSART='NB', EKPO-MATNR=MARD-MATNR
4. LEFT JOIN EKET ON EKET-EBELN, EBELP; GÜP SUM(MENGE) ve MAX(EINDT)
5. IF EKET-EINDT < SY-DATUM → Ignore PO (offen_menge = 0)
6. NETTO_STOK = LABST - WEMNG hesapla
7. Kritilik seviyesi ata
8. Output tablosuna yaz
```

### 4.3 Z_FM_SEND_MAIL (E-posta & Excel)

```
IMPORT:
  - it_output (ZMM_T_STOCK_OUTPUT, K+W sadece)
  - p_recipient_override (Opsiyonel)

LOGIC:
1. CALL BAdI ZMM_BADI_STOCK_RECIPIENT
   - Role göre alıcı listesi al
   - Default DL_LOGISTICS (SU01'de tanımlı)
   
2. Excel oluştur (OLE/LibreOffice):
   - Sütun: MATNR, MAKTX, WERKS, LABST, MINBE, NETTO_STOK, OFFEN_MENGE, CRIT_LEVEL
   - Sıralama: CRIT_LEVEL DESC, LABST ASC
   
3. SO_NEW_DOCUMENT_ATT_SEND_API1 çağır
   - Recipient: BAdI çıktısı
   - Attachment: Excel file
   - Subject: "Kritik Stok Uyarısı - [Tarih]"
```

---

## 5. Yetki ve Zamanlama

**Yetki Objesi:**
- `ZMM_STOCK_REPORT` (S_REPORT-REPORT=ZMM_R_CRITICAL_STOCK)

**Zamanlama:**
- **Job:** RSBTCO (SM36) veya BTP Scheduler
- **Trigger:** Her iş günü 07:30 (TVARVC kullan)
- **Job Sınıfı:** B (Background)
- **Timeout:** 5 dakika

**Parametreler:**
```
p_werks = '1000,1200'
p_crit = 'KW' (kritik+uyarı sadece)
p_email = ☑
p_lang = MARA-LAEDA (dinamik)
```

---

## 6. Test Senaryolari

| # | Senaryo | Beklenen Sonuç | Not |
|---|---|---|---|
| T1 | LABST=0 (stok yok) | CRIT_LEVEL='K' | EKPO kontrol: açık varsa skip |
| T2 | LABST=10, MINBE=50 | CRIT_LEVEL='W' | Açık TT future → dahil |
| T2b | Ayni, EINDT<SY-DATUM | Dahil et (skip kalkıyor) | |
| T3 | LABST=70, MINBE=50 | CRIT_LEVEL='I' | p_crit='K' ile göster, p_crit='KW' ile gizle |
| T4 | p_lang='T' | MAKT-LAEDA='T' okunur | Fallback DE kontrol |
| T5 | E-posta gönder | BAdI alıcı + DL_LOGISTICS | SM59 testi |
| T6 | WERKS=9999 | Boş sonuç | |
| T7 | 200 kalem × 2 depo | Çalış < 30 sn | Performance index |

---

**Revizyon:** Tur 2 (Duzeltme: PO filtre, BAdI, dil, I seviyesi logic)  
**Onay:** Teknik  
**Tarih:** 19.08.2024