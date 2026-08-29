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
| Portal | `<axet-portal-adresiniz>/flows` — katalog, versiyon ve dağıtım yönetimi |
| Kimlik | Okta (NTT kurumsal hesabı) |
| Yetenekler | SikuliX (görsel GUI otomasyonu), Tesseract OCR, PDFBox, SSH/SFTP |

**Önemli:** Portal sadece arayüzdür. Akışlar **senin bilgisayarındaki** Docker
konteynerinde tasarlanır ve çalışır. Docker çalışmıyorsa portal de iş göremez.

## İçindekiler

Her dersin tasarımcıda karşılık gelen bir akış sekmesi vardır:

| # | Doküman | Süre | Tasarımcıdaki sekme | Öğrenilen |
|---|---|---|---|---|
| 1 | [Kurulum](01-kurulum.md) | ~30 dk | `Ders 1 - Kurulum Dogrulama` | WSL, Docker, portal, sandbox |
| 2 | [İlk Akış](02-ilk-akis.md) | ~20 dk | `Ders 2 - Ilk Akis` | `msg` nesnesi, function, deploy |
| 3 | [HTTP ve Dallanma](03-http-dallanma.md) | ~25 dk | `Ders 3 - HTTP` | `http request`, JSON tipi, `switch` |
| 4 | [Zamanlayıcı ve Dosya](04-zamanlayici-dosya.md) | ~20 dk | `Ders 4 - Zamanlayici` | Zamanlayıcı, `file`, context, volume |
| 5 | [aXet AI Ajanı](05-axet-ai.md) | ~30 dk | `Ders 5 - aXet AI` | AI ajanı, model seçimi, **yapılandırılmış çıktı**, hata dalı |
| 6 | [Versiyon ve Canlıya Alma](06-versiyon-ve-canliya-alma.md) | ~30 dk | (portal) | Versiyon kaydetme, Production mode, kalıcılık |
| 7 | [Hata Yönetimi](07-hata-yonetimi.md) | ~25 dk | `Ders 7 - Hata Yonetimi` | `catch`, `status`, yeniden deneme, hata günlüğü |
| 8 | [Ajan Zinciri](08-ajan-zinciri.md) | ~40 dk | `Ders 8 - Ajan Zinciri` | Çok ajanlı akış, denetim döngüsü, geçit sınırları |
| 9 | [Form Arayüzü](09-form-arayuzu.md) | ~45 dk | `Ders 9 - Formlu Zincir` | Web uygulaması, dosya eki, ajan aktivasyonu, kalıcı dosya, özel CSS |
| — | [Sorun Giderme](SORUN-GIDERME.md) | başvuru | — | Hata → çözüm tablosu |

Dersler birbirinin üstüne kurulur; sırayla ilerleyin. Yedisi bittiğinde şunu
kurabilir hale gelirsiniz: *"her sabah 8'de API'den siparişleri çek,
bekleyenleri ayır, bir AI ajanına özetlet, dosyaya yaz"* — ve bunu **canlıda**,
sizden bağımsız, **hata verdiğinde kendini toparlayarak** çalışır halde
bırakabilirsiniz.

Ders 8 bunun üstüne bir katman koyar: **birbirini denetleyen ajanlardan
oluşan bir zincir.** Bir ajanın ürettiğini bir başkası denetler, eksik
bulursa geri gönderir, düzelmezse insana devreder.

Ders 9 zinciri **kullanılabilir** hale getirir: iş arkadaşınız tarayıcıdan
toplantı notlarını dosya olarak yükler, zincir çalışır. Arayüzün görünümünü
de kendi kurumunuza uydurursunuz.

> 💡 **Ders 6'yı atlamayın.** Akışlarınız tasarımcı konteynerinde yaşar;
> versiyon kaydetmezseniz konteynerle birlikte kaybolurlar.

## Adres yer tutucusu hakkında

Dokümanlarda geçen `<axet-portal-adresiniz>` ifadesini **kendi kurumunuzun
aXet.flows portal adresiyle** değiştirin. Adresi bilmiyorsanız aXet.flows
Desktop uygulamasını açın veya kurumunuzun IT/platform ekibine sorun.

Aynı şekilde AI ajanı derslerindeki proje ve model seçimleri de kuruma
özgüdür; açılır menülerde kendi projelerinizi göreceksiniz.

## Ön koşullar

- Windows 10/11, NTT kurumsal makinesi
- aXet.flows Desktop kurulu (`C:\ProgramData\NTT\axetflows-desktop\`)
- Okta hesabı ve aXet Platform erişimi
- **Yönetici hakkı gerekmez** — bkz. [Kurulum](01-kurulum.md)
- Yaklaşık **3 GB** disk alanı (Docker imajları) + WSL sanal diski

## Hızlı yol (kurulum zaten tamamsa)

```
1. aXet.flows Desktop uygulamasını başlat, hazır olmasını bekle
2. https://<axet-portal-adresiniz>/flows/frontend/ → Okta ile giriş
3. Catalog → flow seç → New Version → Regular Deployment
4. Docker imajı iner (ilk seferde ~2.2 GB), tasarımcı yeni sekmede açılır
5. kaynaklar/ornek-01-akis.json dosyasını import et
```

## Klasör içeriği

```
axet-flows-egitim/
├── README.md                          bu dosya
├── 01-kurulum.md                      kurulum, adım adım
├── 02-ilk-akis.md                     ilk çalışan akış
├── 03-http-dallanma.md                dış veri + koşullu dallanma
├── 04-zamanlayici-dosya.md            zamanlanmış akış + dosya yazma
├── 05-axet-ai.md                      AI ajanı çalıştırma
├── 06-versiyon-ve-canliya-alma.md     versiyon + Production mode
├── 07-hata-yonetimi.md                catch, yeniden deneme, hata günlüğü
├── 08-ajan-zinciri.md                 birbirini denetleyen dört ajan
├── 09-form-arayuzu.md                 web arayüzü, dosya eki, özel CSS
├── SORUN-GIDERME.md                   hata → çözüm tablosu
├── gorseller/                         ekran görüntüleri (14 adet)
└── kaynaklar/
    ├── ornek-01-kurulum-dogrulama.json  Ders 1 akışı (import edilebilir)
    ├── ornek-02-ilk-akis.json           Ders 2 akışı
    ├── ornek-03-http-dallanma.json      Ders 3 akışı
    ├── ornek-04-zamanlayici-dosya.json  Ders 4 akışı
    ├── ornek-05-axet-ai.json            Ders 5 akışı
    ├── ornek-07-hata-yonetimi.json      Ders 7 akışı
    ├── ornek-08-ajan-zinciri.json       Ders 8 akışı (4 ajan)
    ├── ornek-09-form-zincir.json        Ders 9 akışı (form + zincir + CSS)
    │
    ├── ders01-ortam-raporu.js           Ders 1 function kodu
    ├── zamani-formatla.js               Ders 2 function kodu
    ├── ders03-*.js                      Ders 3, iki dal
    ├── ders04-rapor-satiri.js           Ders 4 function kodu
    ├── ders07-*.js                      Ders 7, üç function
    ├── ders08-*.js                      Ders 8, dokuz function (prompt + karar)
    ├── ders09-formdan-dosya.js          Ders 9, dosya ekini çözen köprü
    ├── ders09-ozel.css                  Ders 9, uygulamanın özel CSS'i
    │
    ├── demo-girdi/                      Ders 8-9 girdisi: 3 çelişkili belge
    ├── demo-cikti/                      katı gözden geçiren → müdahale
    ├── demo-cikti-onayli/               onaylı dal → 710 satır ABAP
    ├── demo-cikti-formlu/               formdan metin ile tetiklenen koşu
    ├── demo-cikti-ekli/                 formdan dosya eki ile tetiklenen koşu
    └── demo-cikti-kalici/               kalıcı yol denemesinin çıktısı
```

> **Not:** Ekran görüntülerindeki kişisel bilgiler (kullanıcı adı, dosya
> yolları) maskelenmiştir.

## Katkı

Yeni bir tuzakla karşılaşırsan [Sorun Giderme](SORUN-GIDERME.md) dosyasına
satır ekleyip PR aç. Hata mesajının **tam metnini** yazmak en değerlisi —
insanlar Google'a onu yapıştırıyor.
