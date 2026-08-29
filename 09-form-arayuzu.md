# 9. Akışa Arayüz Eklemek

Şimdiye kadar akışları hep tasarımcıdan tetikledik: `inject` düğümünün
butonuna basarak. Bu ders, akışı **başkalarının kullanabileceği bir web
uygulamasına** dönüştürüyor.

Ders 8'in zincirini alıp başındaki `inject` + üç `file in` + `join`
üçlüsünü tek bir formla değiştireceğiz. Kullanıcı tarayıcıdan toplantı
notlarını ve dokümanları **dosya olarak ekleyecek**, zincir çalışacak.
Sonunda uygulamanın görünümünü de özel CSS ile kendimize uyduracağız.

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

Sürükle-bırak form tasarımcısı — altında **formio 4.8.1** çalışıyor.
Bileşenler beş kategoriye ayrılmış:

| Kategori | İçindekiler (seçme) |
|---|---|
| **Basic** | Text Field, Text Area, Number, Password, Checkbox, Select, Radio, Button |
| **Advanced** | Email, Url, Phone Number, Tags, Address, Date/Time, Currency, Signature |
| **Layout** | HTML Element, Content, Columns, Field Set, Panel, Table, Tabs |
| **Data** | Hidden, Data Grid, Edit Grid, Tree, Datatable, Charts, Gantt Diagram |
| **Premium** | reCAPTCHA, Resource, **File**, Nested Form, Custom |

Dosya yüklemesi için gereken `File` bileşeni **Premium** altındadır —
9.4'te oraya geleceğiz.

Her bileşenin **API** sekmesinde bir `Property Name` alanı vardır. Bu ad
iki yerde birden karşınıza çıkar: verinin akışa hangi anahtarla geleceğini
belirler (9.3) ve o alanı hedefleyen CSS sınıfının adı olur (9.9).

Form düğümünün **iki çıkışı** vardır; ilki Submit'tir.

## 9.3 Form verisi akışa nasıl gelir

Burada bir sürpriz var. `Property Name` alanına `belgeler` yazdıysanız,
veri **`msg.payload.belgeler`'de değildir.**

Gerçek yapı şudur:

```javascript
msg.payload = {
  data: { belgeler: [ /* ... */ ], submit: true },
  metadata: { timezone: "Europe/Istanbul", userAgent: "...", pathName: "/" },
  state: "submitted"
}
```

Doğru erişim yolu: **`msg.payload.data.belgeler`**

| Alan | İçerik |
|---|---|
| `payload.data` | Form alanları — `Property Name` burada anahtar olur |
| `payload.metadata` | Saat dilimi, tarayıcı, user agent, sayfa yolu |
| `payload.state` | `"submitted"` — hangi işlemin tetiklendiği |

`msg` üzerinde ayrıca `req` ve `res` alanları da gelir; HTTP isteğine
erişip yanıt döndürmek mümkündür.

## 9.4 Metin değil dosya: `File` bileşeni

Toplantı notlarını bir metin kutusuna yapıştırmak demoda çalışır ama
gerçekte kimse yapmaz. Notlar zaten dosyadır. Formu **ek alacak** hale
getirelim.

`File` bileşeni **Premium** kategorisindedir — Basic'te aramayın.

### Kritik ayar: Storage

`File` bileşenini forma ekleyince ilk sorulacak şey depolama modudur.
Bu tek ayar, dosyanın akışa **nasıl** ulaşacağını belirler:

| Mod | Arka uç gerekir mi | Dosya akışa nasıl gelir |
|---|---|---|
| **`base64`** | **Hayır** | İçerik `url` alanında data-URI olarak gömülü |
| `url` | Evet | Sadece bir HTTP adresi gelir, indirmek size kalır |
| `s3` / `azure` / `dropbox` | Evet + kimlik bilgisi | Adres gelir, içerik bulutta |
| `indexeddb` | Hayır ama | Dosya tarayıcıda kalır, sunucuya ulaşmaz |

Eğitimde **`base64`** kullanıyoruz: tek başına çalışan, kurulum
gerektirmeyen tek mod.

Ayarladığımız diğer alanlar:

| Alan | Değer | Neden |
|---|---|---|
| `Multiple` | açık | Üç belge birden yüklenecek |
| `File Pattern` | `.md,.txt` | Kabul edilecek türler |
| `File Max Size` | `2MB` | Aşağıdaki uyarıya bakın |
| `Required` | açık | Boş gönderimi tarayıcı engellesin |

> **base64'ün bedeli.** Dosya tarayıcıdan sunucuya, gövdenin içinde,
> ~%33 şişmiş halde gider. Birkaç yüz KB'lık metin belgesi için sorun
> değil; 50 MB'lık bir PDF için kötü bir fikirdir. `File Max Size`
> değerini bilerek küçük tutun.

### Gelen veri

Yükleme başarılı olduğunda `payload.data.belgeler` bir **dizidir** ve
her eleman şöyledir:

```javascript
{
  storage:      "base64",
  name:         "01-toplanti-2026-08-12.md",
  originalName: "01-toplanti-2026-08-12.md",
  type:         "text/markdown",
  size:         1417,
  url:          "data:text/markdown;base64,IyBUb3BsYW50xLEg..."
}
```

İçerik `url` alanının içindedir. Virgülden sonrası base64'tür.

### Köprü düğümü

Zincire bağlarken araya küçük bir `function` koyun — tam kaynak:
[`kaynaklar/ders09-formdan-dosya.js`](kaynaklar/ders09-formdan-dosya.js)

```javascript
const veri = (msg.payload && msg.payload.data) || {};
const dosyalar = veri.belgeler;

if (!Array.isArray(dosyalar) || dosyalar.length === 0) {
  node.error("Form dosya eklenmeden gonderildi", msg);   // Ders 7
  return null;
}

const NL = String.fromCharCode(10);
const parcalar = [];

for (const d of dosyalar) {
  const url = d.url || "";
  const virgul = url.indexOf(",");

  // Baska bir storage modu secilirse burada HTTP adresi gelir
  if (virgul < 0 || url.indexOf("base64") < 0) {
    node.error("Dosya base64 degil, depolama modunu kontrol edin", msg);
    return null;
  }

  const metin = Buffer.from(url.slice(virgul + 1), "base64").toString("utf8");
  parcalar.push("### DOSYA: " + (d.originalName || d.name) + NL + metin);
}

msg.payload = parcalar.join(NL + NL);   // zincirin bekledigi bicim
return msg;
```

İki ayrıntı önemli:

**`Buffer` kullanılabilir.** `function` düğümü Node.js içinde çalışır,
yani base64 çözümü için ek kütüphane gerekmez. `atob` kullanmayın —
UTF-8 Türkçe karakterleri bozar.

**Dosya adı prompt'a giriyor.** `### DOSYA: <ad>` başlığı süs değil.
Ajan hangi cümlenin hangi belgeden geldiğini ancak böyle bilir; Ders 8'de
çelişkileri tarih sırasına göre çözmesini istemiştik, bunu yapabilmesi
için belgeleri ayırt edebilmesi gerekiyor.

Bu köprü sayesinde Ders 8'in geri kalanı hiç değişmez — zincir yine
`msg.payload` içinde düz metin bekler. Değişen tek şey o metnin nereden
geldiği.

## 9.5 AI ajanları Production'da aktive edilmeli

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

## 9.6 Üretilen belgeler nereye yazılır

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

## 9.7 Import tuzağı: menü ve karşılama sayfası taşınmaz

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

### İkinci tuzak: menü etiketi form adıyla eşleşmeli

Formun adını `belgeleri yukle` yapıp menü etiketini `Belgeleri yukle`
bıraktığımızda uygulama şu uyarıyla açıldı:

```
The form 'Belgeleri yukle' does not exist between the flows of your
application. Reconfigure menu app!
```

Menü kaydında `pageId` **doğruydu**. Yani sayfa çözümlemesi `pageId`
üzerinden değil, **menü etiketi ile form düğümünün `Name` alanının
birebir eşleşmesi** üzerinden yapılıyor — ve büyük/küçük harfe duyarlı.

**Kural:** menü öğesinin metni ile `form` düğümünün adı **harfi harfine
aynı** olmalı. Formu yeniden adlandırdığınızda menüyü de güncelleyin.

## 9.8 Uçtan uca çalıştırma

Zinciri portalda çalıştırdık — bu kez tarayıcıdan, üç dosya ekleyerek.

| Adım | Sonuç |
|---|---|
| Tarayıcıda `http://localhost:<port>` açıldı | `Sartname Zinciri` uygulaması geldi |
| Üç `.md` dosyası sürüklendi (1,38 + 1,55 + 1,77 KB) | Listede ad ve boyutla göründü |
| **Submit** | Köprü: 3 dosya çözüldü, tek metin |
| FS Generator | `01-FS.md` |
| TS Generator tur 1 | `02-TS-tur1.md` |
| TS Reviewer | onay yok |
| TS Generator tur 2 | `02-TS-tur2.md` |
| TS Reviewer | onay yok, tur hakkı bitti |
| Sonuç | `MUDAHALE-GEREKLI.md` |

Üretilen FS'in başlığı, eklerin gerçekten okunduğunun kanıtı:

```
**Kaynak belgeler:** Toplantı 12.08.2026, 19.08.2026; Mevcut Durum 20.08.2026
```

Ajan yalnızca dosya adlarını değil **içeriklerini** almış: 19.08
toplantısını esas aldı (çelişki kuralı), KRİTİK / UYARI / İZLE
seviyelerini taşıdı, `1000` / `1200` depo kapsamını ve 30 saniyelik
performans kısıtını korudu.

Çıktılar depoda:
[`kaynaklar/demo-cikti-ekli/`](kaynaklar/demo-cikti-ekli/) — eklerden
üretilen bu koşu.
[`kaynaklar/demo-cikti-formlu/`](kaynaklar/demo-cikti-formlu/) — metin
kutusuyla yapılan önceki koşu.

İki koşu da aynı sonuca vardı. Girdi biçimi değişti, zincirin davranışı
değişmedi — köprü düğümünün işi tam olarak buydu.

## 9.9 Görünümü özelleştirmek: Custom CSS

Uygulama çalışıyor ama hazır şablon gibi duruyor. `application` düğümünün
**Style** sekmesinde üç ayar var:

| Ayar | Ne yapar |
|---|---|
| **Logo** | Üst banttaki logoyu değiştirir (sıfırla / temizle düğmeleriyle) |
| **Color Scheme** | Ayrı bir `axetflows-scheme-color` yapılandırma düğümü |
| **Custom CSS** | Monaco editörü; sayfaya gömülen serbest CSS |

Custom CSS kutusu varsayılan olarak tek satır içerir:

```css
/* Include your custom CSS styles */
```

### Neyi hedefleyeceğinizi bilmek

CSS yazmadan önce kabuğun ne olduğunu bilin. Üretilen sayfa
**Bootstrap 4 + SB Admin 2** şablonu, form kısmı ise **formio 4.8.1**.
Yani hazır bir şablonu eziyorsunuz — birçok kuralda `!important`
gerekiyor.

Denemede tespit ettiğimiz tutamaklar:

| Seçici | Nedir |
|---|---|
| `nav.navbar` | Üst bant |
| `#poweredByDeptapps` | Üst banttaki "powered by aXet.flows" logosu |
| `ul.sidebar` | Yan menü |
| `body#page-top` | Sayfa gövdesi |
| `footer.sticky-footer .copyright` | Alt bant telif satırı |
| `.formio-component-form` | Formun dış kabı |
| `.formio-component-<key>` | **Tek bir alan** — aşağıya bakın |
| `.fileSelector` | Dosya bırakma alanı |
| `.formio-component-button button.btn-primary` | Gönder düğmesi |

**En kullanışlı bulgu:** formio her bileşene `formio-component-<key>`
sınıfını ekliyor. Dosya alanımızın anahtarı `belgeler` olduğu için

```css
.formio-component-belgeler .fileSelector { ... }
```

yazdığınızda **sadece o alanın** bırakma kutusunu biçimlendirirsiniz;
formdaki diğer dosya alanları etkilenmez. Alan bazlı tasarımın anahtarı
budur.

### CSS metni değiştiremez — gizler ve yeniden yazar

İki yerde bu duvara çarptık.

**Üst bant.** Marka metni `<Uygulama adı> |` şeklinde geliyor; sondaki
ayraç, yanındaki "powered by" logosu için. Logoyu gizleyince ayraç boşta
kalıyor. CSS bir metin düğümünün **parçasını** silemez.

**Alt bant.** Telif satırının tamamı tek bir `<span>` içinde:

```
Sartname Zinciri Powered by aXet.flows © 2026 NTT Data. All Rights Reserved
```

Sadece "Powered by aXet.flows" kısmını kaldırmak mümkün değil.

Her ikisinde de çözüm aynı: **gizle, `::after` ile yeniden yaz.**

```css
footer.sticky-footer .copyright span { display: none; }

footer.sticky-footer .copyright:after {
  content: "Sartname Zinciri -- ic kullanim";
  color: #8a9aa8;
  font-size: .86rem;
}
```

### Denemenin sonucu

Tam CSS depoda:
[`kaynaklar/ders09-ozel.css`](kaynaklar/ders09-ozel.css) — yorumlu,
yedi bölüm hâlinde. Değiştirdikleri:

1. Üst bant kurumsal lacivert, "powered by" logosu gizli
2. Yan menü beyaz, aktif sayfada turkuaz kenar çizgisi
3. Form beyaz bir kart içinde, ortalanmış
4. Dosya bırakma alanı kesikli çerçeve + bulut simgesi + hover tepkisi
5. Yüklenen dosya listesinin başlığı koyu, satırlar hover'da vurgulu
6. Gönder düğmesi turkuaz, pasifken gri
7. Alt bant kendi metnimizle

Yükleme yolu: CSS'i **Style → Custom CSS** kutusuna yapıştırın →
**Deploy** → **Save in Cloud** → portalda **Run Flow**.

> **Sınır.** Custom CSS kabuğu **yeniden düzenleyemez.** Üst bant, yan
> menü, alt bant hep vardır; yerleri sabittir. Tam kontrol istiyorsanız
> iki çıkış yolu var: `spa app` düğümü, ya da `http in` + `template` +
> `http response` üçlüsüyle sayfayı baştan yazmak. İkincisinde `form`
> düğümünün getirdiği her şeyi (doğrulama, dosya yükleme, oturum) kendiniz
> yazarsınız.

### Denemeyi hızlandıran yol

Her CSS denemesi için Deploy → Save in Cloud → Run Flow döngüsünü
çevirmek dakikalar alır. Bunun yerine: uygulamayı tarayıcıda açın,
geliştirici araçlarında (F12) kuralları canlı deneyin, sonucu beğenince
Custom CSS kutusuna yapıştırın. Biz de böyle yaptık.

## 9.10 Sık karşılaşılan hatalar

### Uygulama açılmıyor, tasarımcı portunda 404

Arayüz Production mode'da yayınlanır. Bkz. 9.1.

### `OKTA token not returned from ai-config endpoint`

Ajanlar aktive edilmemiş. `/credentials/activate.html` adresini açın —
bkz. 9.5.

### Form gönderiliyor ama akış boş veri alıyor

`msg.payload.<alan>` değil, **`msg.payload.data.<alan>`** — bkz. 9.3.

### Uygulama açılıyor ama form görünmüyor

`welcomePage` ve `menu` ayarları import'ta kaybolmuş — bkz. 9.7.

### `The form '<ad>' does not exist between the flows of your application`

Menü etiketi ile `form` düğümünün adı birebir aynı değil. Büyük/küçük
harf dahil eşleştirin — bkz. 9.7.

### Dosya yüklendi ama köprü "base64 degil" hatası veriyor

`File` bileşeninin **Storage** ayarı `base64` dışında bir şey. O zaman
`url` alanında içerik değil bir HTTP adresi gelir — bkz. 9.4.

### `Buffer is not defined`

`function` düğümünde değil, tarayıcı tarafında bir yerde çalıştırıyorsunuz.
`Buffer` sadece Node.js tarafında vardır.

### Custom CSS yazdım ama hiçbir şey değişmedi

Üç olası sebep, bu sırayla kontrol edin:

1. **Deploy + Save in Cloud + Run Flow** üçlüsünü tamamlamadınız —
   çalışan production konteyneri hâlâ eski sürüm.
2. Bootstrap kuralınızı eziyor. F12 → Elements → Computed'da hangi
   kuralın kazandığına bakın, gerekiyorsa `!important` ekleyin.
3. Seçici tutmuyor. `formio-component-<key>` sınıfındaki `<key>`,
   bileşenin `Property Name` değeridir — etiketi değil.

### Portal'ın "Kill instance" düğmesi çalışmıyor

Bazen konteyner durmaz ve eski sürüm çalışmaya devam eder. Kesin çözüm:

```powershell
wsl.exe -d aXet-flows_WSL -- docker stop $(wsl.exe -d aXet-flows_WSL -- docker ps -qf "name=runner")
```

Sonra portaldan **Run Flow** ile yeni sürümü başlatın. Konteyner ID'sinin
değiştiğini doğrulayın — değişmediyse eski sürüm hâlâ ayaktadır.

## 9.11 Hazır akışı import etmek

1. **☰ menü → Import** →
   [`kaynaklar/ornek-09-form-zincir.json`](kaynaklar/ornek-09-form-zincir.json)
2. Dört ajan düğümünü açıp **kendi projenizi ve modelinizi** seçin (Ders 5.4)
3. `application` düğümünü açıp **Welcome Page** = form sayfanız yapın (9.7)
4. Menü etiketinin `form` düğümünün adıyla aynı olduğunu doğrulayın (9.7)
5. **Deploy** → **Save in Cloud** → portalda **Run Flow**
6. Production URL'sini alın, `/credentials/activate.html` ile ajanları
   aktive edin (9.5)
7. Uygulamayı açıp
   [`kaynaklar/demo-girdi/`](kaynaklar/demo-girdi/) altındaki üç `.md`
   dosyasını sürükleyin → **Submit**

Akış `/internal-storage-files/cikti/` altına yazar; bu yolun makinenizde
nereye düştüğünü **Docker Dashboard → Internal files Path** söyler (9.6).

## 9.12 Alıştırmalar

1. **Sonucu ekranda gösterin.** Şu an zincir sadece dosyaya yazıyor;
   kullanıcı sonucu göremiyor. `msg.res` alanını kullanarak ya da ikinci
   bir form sayfasıyla üretilen FS'i ekrana basın.

2. **Auth'u açın.** `application` düğümünde `Auth = Okta` yapıp uygulamayı
   yeniden yayınlayın. Giriş ekranı geliyor mu? Ardından `Roles` sekmesinden
   bir rol tanımlayıp forma erişimi o rolle sınırlayın.

3. **Girdi doğrulaması ekleyin.** `File` bileşeninin `File Pattern`
   değerini `.md` yapıp bir `.txt` yüklemeyi deneyin. Tarayıcı mı
   engelliyor, yoksa dosya akışa ulaşıp köprüde mi eleniyor? Fark
   önemlidir: birincisi kullanıcıya anında geri bildirim, ikincisi
   sessiz bir hata.

4. **Kaybı kendiniz yaşayın.** Çıktı yolunu `/data/cikti/` yapıp zinciri
   çalıştırın, sonra production'ı durdurun. Belgeler gitti mi? 9.6'daki
   kalıcı yol denemesinin tersini görmek, kuralı kalıcı olarak
   öğretir — çünkü bunu gerçek bir işte yaşamak pahalıdır.

5. **Dosya adını göstermeyi deneyin.** Köprü düğümü `msg.dosyaAdlari`
   dizisini de dolduruyor ama kimse kullanmıyor. Bunu `MUDAHALE-GEREKLI.md`
   içine "bu belge şu dosyalardan üretildi" satırı olarak ekleyin.
   İzlenebilirlik, AI üretimi belgelerde en çok eksik kalan şeydir.

6. **CSS'i kendi kurumunuza uydurun.**
   [`kaynaklar/ders09-ozel.css`](kaynaklar/ders09-ozel.css) dosyasındaki
   `:root` değişkenlerini değiştirmek yeterli mi, yoksa başka yerlere de
   dokunmanız gerekiyor mu? Değişkenleri baştan tanımlamanın karşılığını
   burada görürsünüz.

7. **Kabuğun sınırını görün.** Custom CSS ile yan menüyü tamamen
   kaldırmayı deneyin (`ul.sidebar { display: none }`). İçerik alanı
   boşluğu dolduruyor mu, yoksa sol tarafta boş bir şerit mi kalıyor?
   Bu, 9.9'daki "kabuk yeniden düzenlenemez" uyarısının somut hâlidir.

---

**Önceki:** [8. Ajan Zinciri](08-ajan-zinciri.md) ·
**Takıldınız mı?** → [Sorun Giderme](SORUN-GIDERME.md)
