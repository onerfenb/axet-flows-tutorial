# aXet.flows — Uygulamalı Başlangıç Rehberi

NTT DATA'nın **aXet.flows** otomasyon platformunda sıfırdan çalışan bir akış kurmayı
öğreten, uygulamalı bir eğitim. Kurulumdan ilk çalışan akışa kadar her adım,
gerçek bir kurulumda karşılaşılan hatalarla birlikte anlatılıyor.

## Bu eğitim kimin için?

- aXet.flows'u ilk kez kuracak / kullanacak olanlar
- Node-RED deneyimi olmayanlar (ön bilgi gerekmiyor)
- Kurulumda takılıp "neden çalışmıyor" diyenler

## aXet.flows nedir?

Departman düzeyindeki tekrarlayan işleri — ekran otomasyonu, dosya/PDF işleme,
sistemler arası veri taşıma — kod yazmadan *akış* olarak tanımlayıp çalıştırmaya
yarayan bir RPA / iş akışı otomasyon platformu.

Teknik olarak:

| Katman | Ne |
|---|---|
| Tasarımcı | Node-RED tabanlı görsel akış editörü |
| Çalışma ortamı | Docker konteyneri (senin makinende, WSL2 içinde) |
| Portal | `axet.nttdata.com/flows` — katalog, versiyon ve dağıtım yönetimi |
| Kimlik | Okta (NTT kurumsal hesabı) |
| Yetenekler | SikuliX (görsel GUI otomasyonu), Tesseract OCR, PDFBox, SSH/SFTP |

**Önemli:** Portal sadece arayüzdür. Akışlar **senin bilgisayarındaki** Docker
konteynerinde tasarlanır ve çalışır. Docker çalışmıyorsa portal de iş göremez.

## İçindekiler

| # | Doküman | Süre |
|---|---|---|
| 1 | [Kurulum](01-kurulum.md) | ~30 dk (indirme dahil) |
| 2 | [İlk Akış: timestamp → function → debug](02-ilk-akis.md) | ~20 dk |
| — | [Sorun Giderme](SORUN-GIDERME.md) | başvuru |

## Ön koşullar

- Windows 10/11, NTT kurumsal makinesi
- aXet.flows Desktop kurulu (`C:\ProgramData\NTT\axetflows-desktop\`)
- Okta hesabı ve aXet Platform erişimi
- **Yönetici hakkı gerekmez** — bkz. [Kurulum](01-kurulum.md)
- Yaklaşık **3 GB** disk alanı (Docker imajları) + WSL sanal diski

## Hızlı yol (kurulum zaten tamamsa)

```
1. aXet.flows Desktop uygulamasını başlat, hazır olmasını bekle
2. https://axet.nttdata.com/flows/frontend/ → Okta ile giriş
3. Catalog → flow seç → New Version → Regular Deployment
4. Docker imajı iner (ilk seferde ~2.2 GB), tasarımcı yeni sekmede açılır
5. kaynaklar/ornek-01-akis.json dosyasını import et
```

## Klasör içeriği

```
axet-flows-egitim/
├── README.md                     bu dosya
├── 01-kurulum.md                 kurulum, adım adım
├── 02-ilk-akis.md                ilk çalışan akış
├── SORUN-GIDERME.md              hata → çözüm tablosu
├── gorseller/                    ekran görüntüleri (8 adet)
└── kaynaklar/
    ├── ornek-01-akis.json        hazır akış (import edilebilir)
    └── zamani-formatla.js        function düğümünün kodu
```

> **Not:** Ekran görüntülerindeki kişisel bilgiler (kullanıcı adı, dosya
> yolları) maskelenmiştir.

## Katkı

Yeni bir tuzakla karşılaşırsan [Sorun Giderme](SORUN-GIDERME.md) dosyasına
satır ekleyip PR aç. Hata mesajının **tam metnini** yazmak en değerlisi —
insanlar Google'a onu yapıştırıyor.
