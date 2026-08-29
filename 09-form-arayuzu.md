# 9. Akışa Arayüz Eklemek

Şimdiye kadar akışları hep tasarımcıdan tetikledik: `inject` düğümünün
butonuna basarak. Bu ders, akışı **başkalarının kullanabileceği bir web
uygulamasına** dönüştürüyor.

Ders 8'in zincirini alıp başındaki `inject` + üç `file in` + `join`
üçlüsünü tek bir formla değiştireceğiz. Kullanıcı tarayıcıdan toplantı
notlarını yapıştıracak, zincir çalışacak.

> Bu ders Ders 6 (Production mode) ve Ders 8 (ajan zinciri) üzerine
> kurulur.

## 9.1 En önemli kural: arayüz sadece Production'da yayınlanır

Bunu bilmeden saatlerce arayabilirsiniz — biz aradık.

Tasarımcıya bir `form` düğümü koyup deploy ettiğinizde ortada bir arayüz
**yoktur.** Tasarımcı portundaki hiçbir yol size formu göstermez:

```
/app  /ui  /application  /form  /web  /page  ...   → hepsi 404
```

Sebep, tasarımcı konteynerinin `settings.js` dosyasında görünür:

```
httpAdminRoot: NODE_RED_DISABLE_EDITOR === 'true' ? false : undefined
```

Tasarımcı modunda kök yol **editöre** aittir. Uygulama ancak editörün
kapandığı yerde — yani **Production mode**'da — kök yola yerleşir.

| Mod | Port | Kök yol (`/`) |
|---|---|---|
| Designer | tasarımcı portu | Editör |
| **Production (runner)** | ayrı port | **Uygulamanız** |

### URL'yi nereden bulacaksınız

Tahmin etmeye gerek yok, portal söylüyor:

**Docker Dashboard → Production mode → Local access URL**

```
http://localhost:<production-portu>
```

> **Port her çalıştırmada değişir.** Production'ı durdurup yeniden
> başlattığınızda yeni bir port atanır — Ders 1'deki tasarımcı portu
> davranışının aynısı.

## 9.2 İki düğüm: `application` ve `form`

Palette'teki `ui` kategorisinde ikisi birlikte çalışır.

### `application` — uygulamanın kabuğu

Beş sekmesi var ve bu bir "form aracı"ndan çok daha fazlasıdır:

| Sekme | İçerik |
|---|---|
| **App** | Uygulama adı, karşılama sayfası |
| **Menu** | Site haritası — bölümler, sayfalar, sol/üst yerleşim |
| **Style** | Tema, logo, özel CSS |
| **Auth** | **None / Okta / Basic Internal** |
| **Roles** | Özel roller (hazır gelenler: `ROLE_ADMIN`, `ROLE_USER`) |

`Auth = Okta` seçeneği kurumsal kullanım için belirleyicidir: uygulamayı
portala girdiğiniz kimlikle korursunuz, roller de üstüne biner.

### `form` — sayfanın kendisi

Sürükle-bırak form tasarımcısı. Bileşenler: Text Field, **Text Area**,
Number, Password, Checkbox, Select, Radio, Color picker, Button, Paginator
— ayrıca Advanced / Layout / Data / Premium kategorileri.

Her bileşenin **API** sekmesinde bir `Property Name` alanı vardır. Bu ad,
verinin akışa hangi anahtarla geleceğini belirler — birazdan kritik olacak.

Form düğümünün **iki çıkışı** vardır; ilki Submit'tir.

## 9.3 Form verisi akışa nasıl gelir

Burada bir sürpriz var. `Property Name` alanına `notlar` yazdıysanız,
veri **`msg.payload.notlar`'da değildir.**

Gerçek yapı şudur:

```javascript
msg.payload = {
  data: { notlar: "kullanicinin yazdigi metin", submit: true },
  metadata: { timezone: "Europe/Istanbul", userAgent: "...", pathName: "/" },
  state: "submitted"
}
```

Doğru erişim yolu: **`msg.payload.data.notlar`**

| Alan | İçerik |
|---|---|
| `payload.data` | Form alanları — `Property Name` burada anahtar olur |
| `payload.metadata` | Saat dilimi, tarayıcı, user agent, sayfa yolu |
| `payload.state` | `"submitted"` — hangi işlemin tetiklendiği |

`msg` üzerinde ayrıca `req` ve `res` alanları da gelir; HTTP isteğine
erişip yanıt döndürmek mümkündür.

### Köprü düğümü

Zincire bağlarken araya küçük bir `function` koyun:

```javascript
const veri = (msg.payload && msg.payload.data) || {};
const notlar = (veri.notlar || "").trim();

if (!notlar) {
  node.error("Form bos gonderildi", msg);   // Ders 7: msg ikinci parametre
  return null;
}

msg.payload = notlar;   // zincirin bekledigi bicim
return msg;
```

Bu köprü sayesinde Ders 8'in geri kalanı hiç değişmez — zincir yine
`msg.payload` içinde düz metin bekler.

## 9.4 AI ajanları Production'da aktive edilmeli

**Bu dersin en kritik bulgusu.** Zinciri formdan ilk tetiklediğimizde
şu hatayla çöktü:

```
Error: OKTA token not returned from ai-config endpoint
  at AxetAgentsExecuteNode  ·  name: '1. FS Generator'
```

Sebep basit ama sonucu ağır: **tasarımcıda sizin oturumunuz vardır,
production konteynerinde yoktur.** Ajan düğümü kimlik doğrulayamaz.

Çözüm, Ders 5'te ajan düğümünün yardım metninde yazan ama o zaman anlamı
belirsiz kalan adımdır:

```
http://localhost:<production-portu>/credentials/activate.html
```

Bu sayfa sırayla:

1. Okta ile kimliğinizi doğrular
2. Bir model seçtirir
3. *"AXET.Core nodes have been activated successfully"* der

Bundan sonra zincir sorunsuz çalışır.

> ⚠️ **Dağıtım açısından gerçek bir kısıt:** Canlıya alınan her AI akışı,
> ilk çalıştırmadan önce **bir insan tarafından tarayıcıdan** aktive
> edilmelidir. Tamamen insansız bir AI akışı bu haliyle mümkün değildir.
> Production'ı her yeniden başlattığınızda aktivasyon tekrarlanır.

## 9.5 Üretilen belgeler nereye yazılır

Ders 8'in zinciri çıktılarını `/data/cikti/` altına yazıyordu. Arayüzle
birlikte bu yol bir soruna dönüşür: **kullanıcı ürettiği belgeye
ulaşamaz.**

Konteynerin üç farklı klasörü vardır ve yalnızca ikisi kalıcıdır:

| Konteyner yolu | Windows karşılığı | Kalıcı mı |
|---|---|---|
| `/data/` | Docker volume | ❌ Konteyner silinince gider |
| `/internal-storage-files/` | `AppData\Local\axet-flows\.deptapps-instances\<id>\` | ✅ |
| `/external-repository-files/` | `AppData\Local\axet-flows\.deptapps-desktop\repository-files\` | ✅ |

Bağlantıları kendiniz görmek için:

```powershell
wsl.exe -d aXet-flows_WSL -- docker inspect <konteyner> --format '{{range .Mounts}}{{.Destination}} <= {{.Source}}{{println}}{{end}}'
```

**Kullanıcının açabileceği çıktı üretiyorsanız kalıcı yola yazın:**

```javascript
msg.filename = "/internal-storage-files/cikti/01-FS.md";
```

### Bu deneyle doğrulandı

Zinciri kalıcı yolla çalıştırdık, sonra production konteynerini
**tamamen sildik** (`docker stop` + `docker rm`):

| Adım | Sonuç |
|---|---|
| Formdan tetiklendi | FS + iki TS turu + müdahale notu üretildi |
| Windows'ta kontrol | Dört dosya `\.deptapps-instances\25708\cikti\` altında |
| Konteyner **silindi** | `runner TAMAMEN SILINDI` |
| Dosyalar tekrar kontrol | **Dördü de yerinde** |

```
01-FS.md              2.710 bayt
02-TS-tur1.md         4.350 bayt
02-TS-tur2.md         6.035 bayt
MUDAHALE-GEREKLI.md   2.059 bayt
```

Aynı deneyi `/data/cikti/` ile yaparsanız dosyalar konteynerle birlikte
yok olur — bu oturumda üç kez yaşandı.

> **Ders 6'nın uyarısı burada da geçerli.** `/data` altına yazılan her şey
> "Kill instance" ile silinir. Bu eğitimi hazırlarken üç kez production
> yeniden başlatıldı ve her seferinde üretilmiş şartnameler kayboldu.

### Verinin nereye gittiği

Belgeler makinenizde kalır. Ancak **form içeriği AI'ya gider:**

```
makineniz → <axet-portal-adresiniz> → Mastra → litellm → model saglayicisi
```

Gerçek müşteri verisiyle çalışacaksanız bu yolu bilerek kullanın.

## 9.6 Import tuzağı: menü ve karşılama sayfası taşınmaz

Akışı JSON olarak dışa aktarıp geri aldığınızda `application` düğümünün
şu iki ayarı **boş gelir**:

- `welcomePage` — hangi sayfanın açılışta görüneceği
- `menu` — site haritasındaki sayfa bağlantıları

Sonuç: uygulama açılır ama sadece logo görünür, form hiçbir menüde yoktur.

Düzeltmek için `application` düğümünü açıp **Welcome Page** listesinden
form sayfanızı seçin, gerekirse **Menu** sekmesinden bölüme ekleyin,
sonra Deploy edin.

Bu, Ders 5'teki `projectId` durumuyla aynı ailedendir: **düğümler taşınır,
bazı ayarlar taşınmaz.**

## 9.7 Uçtan uca çalıştırma

Zinciri portalda çalıştırdık — bu kez tarayıcıdan.

| Adım | Sonuç |
|---|---|
| Tarayıcıda `http://localhost:<port>` açıldı | `Sartname Zinciri` uygulaması geldi |
| Toplantı notları yapıştırıldı → **Submit** | — |
| FS Generator | `01-FS.md` (3,6 KB) |
| TS Generator tur 1 | `02-TS-tur1.md` (6,2 KB) |
| TS Reviewer | onay yok |
| TS Generator tur 2 | `02-TS-tur2.md` (6,1 KB) |
| TS Reviewer | onay yok, tur hakkı bitti |
| Sonuç | `MUDAHALE-GEREKLI.md` |

Üretilen FS, formdan gelen metni doğru işledi: 19.08 toplantısını esas
aldı (çelişki kuralı), KRİTİK / UYARI / İZLE seviyelerini taşıdı,
`ZMM_R_STOK_UYARI` adlandırmasını kullandı.

Çıktılar depoda:
[`kaynaklar/demo-cikti-formlu/`](kaynaklar/demo-cikti-formlu/)

## 9.8 Sık karşılaşılan hatalar

### Uygulama açılmıyor, tasarımcı portunda 404

Arayüz Production mode'da yayınlanır. Bkz. 9.1.

### `OKTA token not returned from ai-config endpoint`

Ajanlar aktive edilmemiş. `/credentials/activate.html` adresini açın —
bkz. 9.4.

### Form gönderiliyor ama akış boş veri alıyor

`msg.payload.<alan>` değil, **`msg.payload.data.<alan>`** — bkz. 9.3.

### Uygulama açılıyor ama form görünmüyor

`welcomePage` ve `menu` ayarları import'ta kaybolmuş — bkz. 9.6.

### Portal'ın "Kill instance" düğmesi çalışmıyor

Bazen konteyner durmaz ve eski sürüm çalışmaya devam eder. Kesin çözüm:

```powershell
wsl.exe -d aXet-flows_WSL -- docker stop $(wsl.exe -d aXet-flows_WSL -- docker ps -qf "name=runner")
```

Sonra portaldan **Run Flow** ile yeni sürümü başlatın. Konteyner ID'sinin
değiştiğini doğrulayın — değişmediyse eski sürüm hâlâ ayaktadır.

## 9.9 Hazır akışı import etmek

1. **☰ menü → Import** →
   [`kaynaklar/ornek-09-form-zincir.json`](kaynaklar/ornek-09-form-zincir.json)
2. Dört ajan düğümünü açıp **kendi projenizi ve modelinizi** seçin (Ders 5.4)
3. `application` düğümünü açıp **Welcome Page** = form sayfanız yapın (9.6)
4. **Deploy** → **Save in Cloud** → portalda **Run Flow**
5. Production URL'sini alın, `/credentials/activate.html` ile ajanları
   aktive edin (9.4)
6. Uygulamayı açıp formu doldurun

## 9.10 Alıştırmalar

1. **Sonucu ekranda gösterin.** Şu an zincir sadece dosyaya yazıyor;
   kullanıcı sonucu göremiyor. `msg.res` alanını kullanarak ya da ikinci
   bir form sayfasıyla üretilen FS'i ekrana basın.

2. **Auth'u açın.** `application` düğümünde `Auth = Okta` yapıp uygulamayı
   yeniden yayınlayın. Giriş ekranı geliyor mu? Ardından `Roles` sekmesinden
   bir rol tanımlayıp forma erişimi o rolle sınırlayın.

3. **Girdi doğrulaması ekleyin.** Text Area bileşeninin **Validation**
   sekmesinden en az 200 karakter zorunluluğu koyun. Kullanıcı yetersiz
   metin girdiğinde ne oluyor — akış hiç tetikleniyor mu?

4. **Kaybı kendiniz yaşayın.** Çıktı yolunu `/data/cikti/` yapıp zinciri
   çalıştırın, sonra production'ı durdurun. Belgeler gitti mi? 9.5'teki
   kalıcı yol denemesinin tersini görmek, kuralı kalıcı olarak
   öğretir — çünkü bunu gerçek bir işte yaşamak pahalıdır.

---

**Önceki:** [8. Ajan Zinciri](08-ajan-zinciri.md) ·
**Takıldınız mı?** → [Sorun Giderme](SORUN-GIDERME.md)
