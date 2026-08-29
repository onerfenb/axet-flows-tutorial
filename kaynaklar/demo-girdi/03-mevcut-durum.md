# Mevcut Durum Notu — IT (Öner), 20.08.2026

## Sistem

- SAP S/4HANA 2023, on-premise
- ABAP geliştirme paketi: `ZMM_RAPOR`
- Transport sınıfı: geliştirme → test → canlı, haftalık taşıma

## İlgili tablolar

| Tablo | İçerik | Not |
|---|---|---|
| `MARD` | Depo bazlı stok | `LABST` = kullanılabilir stok |
| `MARC` | Tesis bazlı malzeme verisi | `MINBE` = minimum stok seviyesi |
| `MAKT` | Malzeme tanımı | Dil bazlı, `SPRAS = 'TR'` filtrelenmeli |
| `EKPO` | Satınalma sipariş kalemi | Açık sipariş kontrolü için |
| `EKKO` | Satınalma sipariş başlığı | Teslim tarihi burada değil, `EKET`'te |
| `EKET` | Sipariş teslim planı | `EINDT` = teslim tarihi |

## Mevcut raporlar

**MB52** — depo stok listesi var ama minimum seviye kıyaslaması yok.
**MD04** — stok/ihtiyaç listesi, malzeme bazında tek tek bakılıyor, toplu değil.

İkisi de mevcut ihtiyacı karşılamıyor.

## Teknik kısıtlar

- Toplam malzeme sayısı ~45.000, ama kritik liste ~200 kalem
- Performans: rapor 30 saniyenin altında dönmeli
- Arka plan işi (background job) SM36 üzerinden planlanacak
- E-posta gönderimi için `SO_NEW_DOCUMENT_ATT_SEND_API1` kullanılıyor
  (başka projelerde çalışıyor)
- Excel eki için `XLSX` üretimi: `cl_salv_export_xlsx` mevcut

## Naming convention

- Program: `ZMM_R_<isim>`
- Tablo tipi: `ZMM_TT_<isim>`
- Yapı: `ZMM_S_<isim>`
- Fonksiyon grubu: `ZMM_FG_<isim>`

## Dikkat

Geçen sene benzer bir rapor yazılmıştı (`ZMM_R_STOK_ESKI`), sonra
kullanılmadı. Sebebi: her çalıştırmada tüm malzemeleri tarıyordu,
5 dakika sürüyordu. Bu sefer kritik liste ile sınırlı tutulmalı.

Kritik malzeme listesi nerede tutulacak, karar verilmedi. Öneri: özel bir
Z tablosu veya malzeme ana verisinde bir sınıflandırma alanı.
