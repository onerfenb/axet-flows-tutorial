# 10. Sonucu Teslim Etmek

Dokuz derstir her akış aynı yerde bitiyor: **kimsenin okumadığı bir dosyada.**
Ders 9'un birinci alıştırması bunu zaten itiraf ediyordu.

Bu ders o döngüyü kapatıyor. Üç hedef var:

| Hedef | Ne için | Düğüm |
|---|---|---|
| **Excel** | İnsanın açıp bakacağı biçim | `json-to-excel` |
| **Koşu geçmişi** | "Bu rapor dün de böyle miydi?" | `file` + `file in` |
| **E-posta** | Kullanıcının ayağına gitmek | `ms-graph-mail-send` |

Ve raporun ne olacağını **kendimiz uydurmuyoruz.** Ders 8'de ajanların
yazdığı fonksiyonel şartname şunu söylüyordu:

> *"Karar: **hem SAP raporu hem e-posta.** Rapor ALV olacak, e-posta her
> sabah 07:30'da Excel ekiyle gidecek. E-posta listesi konfigürasyondan
> okunacak, koda gömülmeyecek."*

Bu derste o şartnamenin aXet tarafına düşen kısmını uyguluyoruz.

> Bu ders Ders 4 (`file`, zamanlayıcı) ve Ders 7 (`catch`) üzerine kurulur.

## 10.1 Excel: veri şekli her şeyi belirler

`json-to-excel` düğümünün tek bir sözleşmesi var ve tamamı `msg.payload.data`
içinde:

```javascript
msg.payload = {
  data: {
    "Sayfa Adi": [
      { "Sutun A": "deger", "Sutun B": 42 },
      { "Sutun A": "deger", "Sutun B": 7  }
    ]
  }
}
```

Kurallar sade:

- **Nesnenin her anahtarı bir sayfa olur.** Anahtar sayfanın adıdır.
- **Sayfa bir dizidir; her eleman bir satırdır.**
- **Satırın anahtarları sütun olur.** Sütun kümesi, o sayfadaki tüm
  satırların anahtarlarının birleşimidir.
- Başlık satırını siz yazmazsınız; anahtarlardan üretilir.

Çıktı `msg.payload` içinde bir **Buffer**'dır. Doğrudan `file` düğümüne
verip `.xlsx` yazabilirsiniz — `Encoding` alanını **`none`** yapmayı
unutmayın, yoksa buffer metne çevrilip dosya bozulur.

### Hücre dört şeyden biri olabilir

| Tip | Örnek | Not |
|---|---|---|
| Metin | `"M-1001"` | — |
| Sayı | `42` | — |
| Tarih | `new Date(...)` | Varsayılan biçim `dd/MM/yyyy` |
| **Formül** | `() => "=D2-E2"` | Parametresiz fonksiyon, **İngilizce** formül |
| **Stilli** | `{ value: ..., style: {...} }` | Aşağıda |

**Formül neden fonksiyon?** Çünkü düğüm, metin ile formülü ayırt etmek
zorunda. `"=D2-E2"` yazsanız hücreye o metin girerdi.

Bunun önemli bir sonucu var: **tabloyu bir `function` düğümünde kurmak
zorundasınız.** JSON bir fonksiyon taşıyamaz, dolayısıyla formüllü bir
tabloyu akış dosyasına sabit veri olarak gömemezsiniz.

### Stiller: kütüphane `xlsx-populate`

Stil anahtarları düğümün kendisinden değil, altındaki `xlsx-populate`
kütüphanesinden gelir. En sık kullanılanlar:

```javascript
{
  value: "KRITIK",
  style: {
    bold: true,
    fontColor: "9C0006",     // yazi rengi, # YOK
    fill: "FFC7CE",          // ARKA PLAN
    numberFormat: "dd.MM.yyyy"
  }
}
```

> **Tuzak:** arka plan anahtarı `backgroundColor` **değil**, `fill`.
> İyi haber: yanlış anahtar verdiğinizde düğüm sessiz kalmıyor.
>
> ```
> _Style.style: 'backgroundColor' is not a valid style
> ```
>
> Bir stil anahtarından emin değilseniz deneyin; hata size söyler.

### Uygulama

Tam kaynak:
[`kaynaklar/ders10-stok-tablosu.js`](kaynaklar/ders10-stok-tablosu.js)

Şartnamedeki üç seviye:

```javascript
const IZLE_CARPANI = 1.5;

function seviye(stok, min) {
  if (stok === 0)              return "KRITIK";
  if (stok < min)              return "UYARI";
  if (stok < min * IZLE_CARPANI) return "IZLE";
  return null;   // raporda yeri yok
}
```

Satır kurulumu — formül, stil ve tarih bir arada:

```javascript
const satirNo = satirlar.length + 2;   // 1 baslik + o ana kadar eklenenler

satirlar.push({
  "Malzeme": m.kod,
  "Stok": m.stok,
  "Minimum": m.min,
  "Fark": () => "=D" + satirNo + "-E" + satirNo,
  "Durum": {
    value: s,
    style: { bold: true, fontColor: RENK[s].yazi, fill: RENK[s].zemin }
  },
  "Son siparis": {
    value: new Date(m.sonSiparis),
    style: { numberFormat: "dd.MM.yyyy" }
  }
});
```

`satirNo`'ya dikkat: formül **Excel'in satır numarasını** bilmek zorunda,
dizinin indeksini değil. Başlık satırı 1'i işgal ettiği için `+2`.

### Doğrulama

Üretilen dosyayı Excel'de açmadan da kontrol edebilirsiniz — `.xlsx`
aslında bir zip:

```bash
python -c "import zipfile,re; z=zipfile.ZipFile('rapor.xlsx'); print(re.findall(r'<f>([^<]+)</f>', z.read('xl/worksheets/sheet1.xml').decode()))"
```

Bizim koşumuzda çıkan sonuç:

| Kontrol | Sonuç |
|---|---|
| Sayfalar | `Kritik Stok`, `Ozet` |
| Satır | 4 (beşinci malzeme filtreyle **elendi**) |
| Formüller | `=D2-E2` … `=D5-E5` |
| Sayı biçimleri | `dd.MM.yyyy`, `dd.MM.yyyy HH:mm` |
| Dolgu renkleri | `FFC7CE`, `FFEB9C`, `C6EFCE` |
| Yazı renkleri | `9C0006`, `9C6500`, `006100` |

Örnek veriye bilerek bol stoklu bir malzeme koyduk (`62 > 30 × 1,5`).
**Filtrenin çalıştığını görmenin en kolay yolu, elenmesi gereken bir
satırı veriye koymaktır.**

Çıktı depoda:
[`kaynaklar/demo-cikti-rapor/`](kaynaklar/demo-cikti-rapor/)

## 10.2 Koşu geçmişi: JSONL

"Bu rapor dün de böyle miydi?" sorusunun cevabı bir yerde durmalı.

Her koşu, tek satırlık bir JSON olarak bir dosyaya eklenir — **JSONL**
biçimi. Tek kuralı vardır: **satırda yeni satır olmayacak.**

```javascript
msg.payload = JSON.stringify({           // girintisiz -- kural bu
  tarih: tarih,
  kaynak: msg.kaynak || "elle",
  kritik: s.KRITIK,
  uyari: s.UYARI,
  izle: s.IZLE,
  satir: msg.satirSayisi || 0
});
msg.filename = "/internal-storage-files/rapor/kosu-gecmisi.jsonl";
```

`file` düğümünde **Action = "append to file"** ve **Add newline** açık.
Yol Ders 9'daki kalıcı dizin — konteyner silinse de kalır.

Dosya böyle birikir:

```
{"tarih":"2026-08-29 23:48","kaynak":"elle","kritik":1,"uyari":2,"izle":1,"satir":4}
{"tarih":"2026-08-29 23:49","kaynak":"elle","kritik":1,"uyari":2,"izle":1,"satir":4}
{"tarih":"2026-08-29 23:51","kaynak":"elle","kritik":1,"uyari":2,"izle":1,"satir":4}
```

Geri okurken `file in` dosyanın **tamamını tek metin** olarak verir;
bölüp tek tek çözersiniz:

```javascript
const kayitlar = ham
  .split(NL)
  .map(s => s.trim())
  .filter(Boolean)
  .map(s => { try { return JSON.parse(s); } catch (e) { return null; } })
  .filter(Boolean);
```

`try/catch` süs değil: konteyner yazma ortasında kapanırsa **son satır
yarım kalır.** JSONL'in en büyük avantajı da budur — bozuk bir satır
sadece kendini kaybettirir, dosyanın geri kalanı okunur. Tek bir dev JSON
dizisi olsaydı dosyanın tamamı çöp olurdu.

Gerçek çıktı:

```json
{
 "toplamKosu": 5,
 "ilk": "2026-08-29 23:48",
 "son": "2026-08-29 23:53",
 "toplamKritikBulgu": 5,
 "son10": [ ... ]
}
```

### Peki `sql-query` neden yok?

aXet'te bir `sql-query` düğümü var ve yardım metni cazip:

> *"Her akışın kendine ait, yalnızca o akıştan erişilebilen, hiçbir ek
> yapılandırma gerektirmeyen bir bulut veritabanı vardır."*

Düğüm tarafında gerçekten hiçbir ayar yok — sadece sorguyu yazıyorsunuz.
Ama denediğimizde şu çıktı:

```
No database password found for flowId: 25708 in environment: dev.
Check Key Vault secret 'flow-context-database-sql-dev-25708'
```

Yani **veritabanının platform tarafında açılmış olması gerekiyor.** Bu
düğüm ayarıyla çözülmez; platform ekibinden istenir. Sizde açıksa
`sql-query` düğümü koşu kaydı için doğal seçimdir — JSONL yerine
`INSERT` yazarsınız, akışın geri kalanı hiç değişmez.

> **Mustache uyarısı.** `sql-query` sorguyu Mustache ile işler:
> `'{{payload.ad}}'` yazarsanız `msg.payload.ad` ile değiştirilir.
> Bu **parametre bağlama değil, metin birleştirmedir.** Kullanıcıdan
> gelen bir değeri doğrudan koyarsanız SQL enjeksiyonuna açıksınız.
> Sayıları `parseInt` ile, metinleri tek tırnak ikileyerek geçirin.

## 10.3 E-posta: base64 bu kez dışarı

Ders 9'da dosya **içeri** base64 olarak geliyordu. MS Graph eki de aynı
biçimde **dışarı** gider — simetri hoş bir tesadüf değil, base64'ün
JSON içinde ikili veri taşımanın standart yolu olmasının sonucu.

`ms-graph-mail-send` düğümü her şeyi `msg.payload` içinde bekler:

```javascript
msg.payload = {
  subject: "Kritik stok raporu -- 29.08.2026",
  toRecipients: [{ emailAddress: { address: "biri@kurum.com" } }],
  importance: "high",                      // low | normal | high
  body: { contentType: "html", content: govde },
  attachments: [{
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: "kritik-stok-20260829.xlsx",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    contentBytes: buf.toString("base64")   // Excel buffer'i
  }]
};
```

Tam kaynak:
[`kaynaklar/ders10-eposta-hazirla.js`](kaynaklar/ders10-eposta-hazirla.js)

Küçük ama işe yarar iki ayrıntı:

**Önem seviyesi veriye bağlansın.** KRİTİK varsa e-posta yüksek önemle
gitsin; yoksa normal. Tek satır:

```javascript
importance: s.KRITIK > 0 ? "high" : "normal"
```

**Dosya adına tarih koyun.** Yoksa gelen kutusunda aynı adlı otuz dosya
birikir.

### Alıcılar koda gömülmesin: `secret` düğümü

Şartname "e-posta listesi konfigürasyondan okunacak, koda gömülmeyecek"
diyordu. `secret` düğümü tam bunun içindir: verdiğiniz değeri seçtiğiniz
özelliğe yazar, ama değeri **`flows.json`'a koymaz.**

| Alan | Değer |
|---|---|
| Property | `alicilar` |
| Property type | `msg` |
| Value | alıcı adresleri (virgülle) |

Akışı dışa aktarıp git'e koyduğunuzda adresler dosyada olmaz. Köprü
kodu virgülle ayrılmış listeyi bekler:

```javascript
toRecipients: String(msg.alicilar || "")
  .split(",").map(a => a.trim()).filter(Boolean)
  .map(a => ({ emailAddress: { address: a } }))
```

> **Sınır.** `secret`, değeri Node-RED'in credentials deposunda tutar —
> yani export ve git temiz kalır. Ama editör oturumu olan biri değeri
> okuyabilir. Bu "sırrı git'ten uzak tutma" aracıdır, tam bir kasa değil.

### Yapılandırma: `ms-graph-mail-config`

`ms-graph-mail-send` tek başına çalışmaz, bir yapılandırma düğümü ister.
İki kimlik modu var:

| Mod | Ne gerekir |
|---|---|
| **DELEGATED** | Azure AD app kaydı **gerekmez** — oturum kimliğinizle gönderir |
| MANUAL | `clientId` + `tenantId` + `clientSecret` (Azure AD app kaydı) |

DELEGATED'in zorunlu alanları:

| Alan | Not |
|---|---|
| `Auth type` | `DELEGATED` |
| `Optional scopes` | `no` |
| `From mail` | Gönderen adres — **boş bırakılırsa düğüm sessizce geçersiz kalır** |
| `Tenant` | Açılır liste; dinamik dolar |

`From mail` tuzağı sinsidir: düğüm listede `defaults` içinde zorunlu
görünmez ama boşken hem config hem `send` düğümü `valid: false` olur ve
tuvalde uyarı üçgeni çıkar.

`Tenant` alanı da öyle — `defaults`'ta zorunlu değil, ama boşken düğüm
çalışma anında şunu der:

```
Please select the tenant within your config node in flows before
proceeding with the authentication process.
```

### Bu adım bizim ortamımızda tamamlanamadı

Dürüst olmak gerekirse: **e-posta gönderimini doğrulayamadık.**

Yapılandırma geçerli hale geldi (config ve send düğümleri `valid`),
üç tenant seçeneğinin de üçünü denedik, hepsinde aynı sonuç:

```
An error occurred trying to retrieve the token.
```

Konteyner günlüğü isteğin başladığını gösteriyor —

```
[ms-graph-mail-config:delegated posta] Setting up MS Graph - Mail client for <adres>
```

— ama token üretimi tarafında ayrıntı bırakmıyor. Yorumumuz: DELEGATED
modu, hesabın **platform tarafında MS Graph Mail iznine sahip olmasını**
gerektiriyor ve bu izin bizim hesapta yoktu.

**Sizde ne yapmalı:**

1. Önce DELEGATED'i deneyin — çalışıyorsa hiçbir kurulum gerekmez.
2. `An error occurred trying to retrieve the token.` alıyorsanız
   platform/IT ekibine sorun: hesabınıza MS Graph Mail izni tanımlı mı?
3. Alternatif: Azure AD app kaydınız varsa MANUAL moda geçip
   `clientId` / `tenantId` / `clientSecret` girin.
4. Hiçbiri olmuyorsa `email-output` kategorisindeki düz **SMTP** `e-mail`
   düğümü var; kurumsal relay adresi ve kimlik ister.

Akışın geri kalanı bu adıma bağlı değil: Excel üretimi, arşivleme ve
koşu geçmişi e-posta olmadan da çalışır. Zaten `catch` düğümü sayesinde
posta hatası zinciri durdurmaz — sadece günlüğe düşer.

## 10.4 Zamanlayıcı: her iş günü 07:30

Şartname "her sabah 07:30" diyordu. `inject` düğümünün **Repeat** alanı
`at a specific time` seçildiğinde cron ifadesi kabul eder:

```
30 7 * * 1-5
```

Sırasıyla: dakika, saat, ayın günü, ay, haftanın günü. `1-5` =
Pazartesi–Cuma. Şartnamedeki "hafta sonu gelmesin" kuralı bu kadar.

Akışta **iki tetikleyici** var ve ikisi de aynı yere bağlanır:

| Tetikleyici | `msg.kaynak` |
|---|---|
| `elle calistir` | `"elle"` |
| `her is gunu 07:30` | `"zamanlayici"` |

`kaynak` koşu geçmişine yazılır. Böylece "bu rapor elle mi tetiklendi,
otomatik mi geldi" sorusu sonradan cevaplanabilir. `inject` düğümünün
**props** listesine ek alan koyarak bunu yapıyoruz — payload'a
dokunmadan.

## 10.5 Hata yönetimi: üç dal, tek günlük

Bu akışta üç ayrı şey yanlış gidebilir: Excel üretimi, dosya yazma,
e-posta. Ders 7'nin `catch` düğümü üçünü de tek yerde toplar.

```javascript
const e = msg.error || {};
const s = e.source || {};
msg.payload = new Date().toISOString() + " | " + (s.name || s.type) + " | " + e.message;
msg.filename = "/internal-storage-files/rapor/hatalar.log";
```

Gerçek bir koşuda günlük tam da bunu yakaladı:

```
2026-08-29T20:48:10.755Z | gonder | Please select the tenant within your config node...
```

`e.source.name` sayesinde hangi düğümün patladığı görünüyor. Bu, üç dallı
bir akışta hata ayıklamanın en hızlı yoludur.

Dikkat edin: **e-posta patladı ama Excel yazıldı ve koşu geçmişine kayıt
düştü.** Dallar birbirinden bağımsız; biri düşünce diğerleri devam eder.
Bu bir tesadüf değil, `stok tablosu` düğümünün iki çıkışa birden
bağlanmasının sonucudur.

## 10.6 Sık karşılaşılan hatalar

### `_Style.style: '<ad>' is not a valid style`

Stil anahtarı `xlsx-populate` sözlüğünde yok. Arka plan için
`backgroundColor` değil **`fill`** kullanın.

### Excel dosyası bozuk açılıyor

`file` düğümünün **Encoding** alanı `none` olmalı. Başka bir değerde
buffer metne çevrilir ve dosya bozulur.

### Formül hücrede metin olarak görünüyor

Formülü metin olarak verdiniz. Parametresiz bir **fonksiyon** olmalı:
`() => "=D2-E2"`. Ayrıca formül adları İngilizce, ayraç virgül,
ondalık nokta olmalı.

### Formül yanlış satıra bakıyor

Excel satır numarası 1'den başlar ve başlık satırı 1'i işgal eder.
Dizinin `i`. elemanı Excel'in `i + 2`. satırıdır.

### `Request failed with status code 401` (SQL veya AI)

Tasarımcı konteyneri uzun süredir ayakta ve platform kimlikleri
bayatlamış. `/credentials/activate.html` bunu **çözmez** — "zaten aktif"
deyip Okta'ya hiç gitmeden `done.html`'e yönlendirir.

Çözüm konteyneri yenilemektir:

1. Tasarımcıda **Save in Cloud** (yoksa çalışmanızı kaybedersiniz)
2. Docker Dashboard → In Design → kill instance
3. Catalog → flow → **New Version → Regular Deployment**

Yeni tasarımcıda aktivasyon gerekmez; sayfa bunu açıkça söyler:
*"It is not necessary to activate the nodes in design mode."*

### `No database password found for flowId: ...`

`sql-query` düğümünün beklediği veritabanı bu akış için açılmamış.
Platform ekibinden istenir — bkz. 10.2.

### `Please select the tenant within your config node...`

`ms-graph-mail-config` düğümünde **Tenant** seçilmemiş. Liste dinamik
dolar; düğümü açıp seçenekler yüklendikten sonra seçin.

### `An error occurred trying to retrieve the token.`

DELEGATED modda platform, MS Graph token'ı üretmiyor. Hesabınızda
MS Graph Mail izni olup olmadığını sorun — bkz. 10.3.

## 10.7 Hazır akışı import etmek

1. **☰ menü → Import** →
   [`kaynaklar/ornek-10-teslim.json`](kaynaklar/ornek-10-teslim.json)
2. `ms-graph-mail-config` düğümünü açıp **From mail** = kendi adresiniz,
   **Tenant** = listeden seçin
3. `alicilar` adlı `secret` düğümünü açıp alıcı adres(ler)ini yazın
4. **Deploy**
5. `elle calistir` düğümünün butonuna basın
6. Çıktıları görün: `/internal-storage-files/rapor/` altında
   `kritik-stok-<tarih>.xlsx` ve `kosu-gecmisi.jsonl`

Bu yolun makinenizde nereye düştüğünü **Docker Dashboard → Internal
files Path** söyler (Ders 9.6).

## 10.8 Alıştırmalar

1. **Kendi sütununuzu ekleyin.** Ders 8'in şartnamesi "gecikmiş sipariş"
   notu istiyordu. `Son siparis` tarihi bugünden eskiyse o hücreyi
   kırmızıya boyayın. İpucu: stil nesnesini koşullu kurun.

2. **Boş raporu göndermeyin.** Hiçbir malzeme kritik değilse e-posta
   göndermenin anlamı yok. Araya bir `switch` koyup `msg.satirSayisi`
   sıfırsa zinciri durdurun — ama koşu geçmişine yine de yazın.
   "Bugün sorun yoktu" da bir bilgidir.

3. **Geçmişi Excel'e çevirin.** `kosu-gecmisi.jsonl` zaten satır satır
   nesne; `json-to-excel` tam da bunu bekliyor. Haftalık bir trend
   sayfası üretin.

4. **Elenen satırları ikinci sayfaya koyun.** Şu an filtreye takılan
   malzemeler tamamen kayboluyor. `Kapsam Disi` adlı bir sayfa ekleyip
   oraya yazın — "neden bu malzeme raporda yok?" sorusu sık gelir.

5. **Şablon kullanın.** `json-to-excel` düğümünün **Write into** alanı
   `Existing workbook` seçeneğini de kabul eder: `file in` ile hazır bir
   `.xlsx` okuyup üstüne yazarsınız. Kurumsal başlıklı bir şablona
   veri basmayı deneyin.

6. **Teslimi ikiye ayırın.** E-posta çalışmıyorsa SharePoint deneyin:
   `ms-graph-shp-upload-file` düğümü aynı Excel buffer'ını bir kütüphaneye
   yükler, `ms-graph-shp-create-shareable-link` de paylaşım linki üretir.
   Aynı çıktı, farklı kapı.

---

**Önceki:** [9. Form Arayüzü](09-form-arayuzu.md) ·
**Takıldınız mı?** → [Sorun Giderme](SORUN-GIDERME.md)
