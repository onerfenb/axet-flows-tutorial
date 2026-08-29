# Teknik Sartname (Düzeltme v2)

**Belge No:** ZMM-TS-001-v2  
**Tarih:** 21.08.2026  
**Hazirlayan:** ABAP Gelistirme  
**Referans FS:** ZMM-FS-001  

---

## 1. Genel Bakis

**Program Adı:** `ZMM_R_STOK_KONTROL`  
**Türü:** Rapor (ALV + Excel + E-posta)  
**Kapsam:** Merkez depo (1000) ve üretim deposu (1200) kritik malzemeleri  
**Siklık:** Günlük, 07:30 (is günleri)  
**Cikti:** ALV 2-sekmeli + Excel (.xlsx) + E-posta  

---

## 2. Veri Kaynaklari

### 2.1 Temel Tablolar

| Tablo | Alan | Amaç |
|-------|------|------|
| `MARD` | MATNR, LGORT, LABST | Depo stok hareketi |
| `MARC` | MATNR, WERKS, MINBE | Minimum stok seviyesi |
| `MAKT` | MATNR, MAKTX, SPRAS | Malzeme tanimi (TR) |
| `EKPO` | EBELN, EBELP, MATNR | Satinalma siparisi baslik |
| `EKET` | EBELN, EBELP, EINDT, ELIKZ | Satinalma siparis tarih/durum |
| `T001L` | LGORT, LGOBE | Depo tanımı (validasyon) |

### 2.2 Konfigürasyon Tabloları

**ZMM_T_MAILCFG** (Tablo Türü: Transparent)  
```
Alanlar:
- MANDT (Anahtar)
- MAIL_TO (VARCHAR2, 255) – E-posta alici(lar), ; ile ayrilmis
- MAIL_CC (VARCHAR2, 255) – Kopyala alan, opsiyonel
- MAIL_SUBJECT (VARCHAR2, 128) – Baslik
- MAIL_BODY (VARCHAR2, 500) – Gövde şablonu
- ACTIVE (C, 1) – 'X' ise etkin
- CHANGED_BY (VARCHAR2, 12)
- CHANGED_AT (TIMESTAMP)
```

**ZMM_T_KRITMAT** (Tablo Türü: Transparent)  
```
Alanlar:
- MANDT (Anahtar)
- MATNR (Anahtar, CHAR 18) – Malzeme numarasi
- ENABLED (C, 1) – 'X' ise aktif
- CHANGED_BY (VARCHAR2, 12)
- CHANGED_AT (TIMESTAMP)
Indeks: MANDT + MATNR
```

**SM30 Görünümleri:** Her iki tablo için `ZMM_V_MAILCFG` ve `ZMM_V_KRITMAT` tanımlanacak.

### 2.3 Güncelleme Sorumluluğu

- **ZMM_T_KRITMAT:** Malzeme yönetimi (MM) ekibi; haftalik veya malzeme değişim anında  
- **ZMM_T_MAILCFG:** System Admin; talep üzerine  
- **Denetim:** Transaction SM34 veya `RSUSR002` raporunda audit  

---

## 3. Program Yapisi

### 3.1 Modüller

```
ZMM_R_STOK_KONTROL (Ana rapor - Selection Screen + ALV)
├─ FORM get_kritmat_list()           [ZMM_T_KRITMAT'tan malzeme listesi]
├─ FORM get_stok_durum()             [MARD/MARC sorgusu + stok hesap]
├─ FORM check_acik_siparis()         [EKPO/EKET açik siparis filtresi]
├─ FORM classify_status()            [KRİTİK/UYARI/İZLE sınıflandırma]
├─ FORM build_alv_output()           [2-sekmeli ALV hazırlama]
├─ FORM export_to_excel()            [XLSX oluşturma]
└─ FORM send_email()                 [E-posta gönderimi + ek]
```

### 3.2 Veri Yapilari

```ABAP
TYPES: BEGIN OF ty_kritmat,
  matnr     TYPE mard-matnr,
  maktx     TYPE makt-maktx,
  lgort     TYPE mard-lgort,
  labst     TYPE mard-labst,
  minbe     TYPE marc-minbe,
  status    TYPE c VALUE 'K',  "K=KRİTİK, U=UYARI, I=İZLE
  status_tx TYPE char20,
  gecikme   TYPE c VALUE '',   "X=Gecikmis Siparis
  acik_sip  TYPE c VALUE '',   "X=Açik siparis varsa uyariya girmez
END OF ty_kritmat.

TYPES: BEGIN OF ty_output,
  sekmeno   TYPE i,  "1=KRİTİK/UYARI, 2=İZLE
  matnr     TYPE mard-matnr,
  maktx     TYPE makt-maktx,
  lgort     TYPE mard-lgort,
  labst     TYPE mard-labst,
  minbe     TYPE marc-minbe,
  status_tx TYPE char20,
  gecikme   TYPE char30,
END OF ty_output.

DATA: gt_kritmat TYPE TABLE OF ty_kritmat,
      gt_output  TYPE TABLE OF ty_output,
      gs_mailcfg TYPE zmm_t_mailcfg.
```

---

## 4. Algoritma

### 4.1 Ana Süreç (START-OF-SELECTION)

1. **Validasyon:** `ZMM_T_KRITMAT.ACTIVE = 'X'` olup olmadığı kontrol; boşsa mesaj ve dur.
2. **Malzeme Listesi:** `CALL FORM get_kritmat_list()` → `gt_kritmat[]` doldur.
3. **Stok Sorgusu:** `MARD` (LGORT 1000/1200) + `MARC` + `MAKT` (SPRAS=TR) JOIN.
4. **Açik Siparis Kontrol:** Her malzeme için `EKPO/EKET` sorgusu:
   - `ELIKZ ≠ 'X'` ve `EINDT ≥ TRUNC(SY-DATUM)` → `acik_sip = 'X'` (uyarıya girmez)
   - `ELIKZ ≠ 'X'` ve `EINDT < TRUNC(SY-DATUM)` → `gecikme = 'X'` (uyarıya girer)
5. **Sınıflandırma:** `CALL FORM classify_status()`:
   - `LABST = 0` → KRİTİK (her zaman)
   - `LABST < MINBE` + `acik_sip ≠ 'X'` → UYARI (veya KRİTİK + gecikme)
   - `LABST < MINBE × 1.5` + `LABST ≥ MINBE` → İZLE
6. **ALV + Excel:** `CALL FORM build_alv_output()` + `CALL FORM export_to_excel()`.
7. **E-posta:** `ZMM_T_MAILCFG` okunur; `CALL FORM send_email()`.

### 4.2 Performance

- **Indeks:** `ZMM_T_KRITMAT(MANDT + MATNR)`, `MARD(WERKS + LGORT + MATNR)`, `MARC(WERKS + MATNR)`  
- **Sorgu:** SELECT... PACKAGE SIZE 1000  
- **Hedef:** < 30 saniye (200 malzeme × 2 depo = 400 satır sorgusu)  

---

## 5. Yetki ve Zamanlama

### 5.1 Yetki Nesnesi

```
Nesne: M_MATE_WRK
Aktivite: 03 (Görüntüleme)
Tanım: Malzeme deposu göz atma

Nesne: S_SYSTEM_ADMIN (Opsiyonel)
Background job çalıştırma (SM36)
```

### 5.2 Background Job (SM36)

```
Job Adı: ZMM_STOK_KONTROL_DAILY
Program: ZMM_R_STOK_KONTROL
Başlang. Zamanı: 07:30 (Pazartesi–Cuma)
Tekrar: Günlük
Kullanıcı: ZMMBATCH
Output: E-posta
```

---

## 6. Test Senaryolari

| # | Senaryo | Beklenen Çıkış |
|---|---------|---|
| 1 | LABST=0, acik_sip='X' | KRİTİK (açik siparis göz ardı) |
| 2 | LABST<MINBE, acik_sip='X' (EINDT<bugün) | UYARI + "Gecikmis Siparis" notu |
| 3 | LABST<1.5×MINBE, LABST≥MINBE | İZLE sekmesi |
| 4 | Kritik malzeme listesi boş | Info mesaj + dur |
| 5 | E-posta konfigürasyonu eksik | Rapor çıktı, e-posta gönderilmez + log uyarı |
| 6 | Hafta sonu job tetikleme | Job skip (sm36 rule) |

---

**Kabul Kriterleri:**
- ✅ Açik siparis mantığı: KRİTİK/UYARI sınıfındaki `acik_sip` ve `gecikme` flagleri tam tanımlanmış  
- ✅ Kolon listesi: ALV ve Excel için asgari 7 kolon sabitlendi  
- ✅ Kritik malzeme: `ZMM_T_KRITMAT` (SM30 + SM34 denetimi)  
- ✅ E-posta alici: `ZMM_T_MAILCFG` (koda gömülmedi)  
- ✅ Arsivleme: v3'te (Kapsam dışı)