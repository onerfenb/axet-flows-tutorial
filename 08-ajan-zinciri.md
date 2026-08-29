# 8. Ajan Zinciri: Birbirini Denetleyen Ajanlar

Ders 5'te tek bir ajana soru sorduk. Bu derste **dört ajanı arka arkaya
bağlayıp** aralarına bir denetim döngüsü koyuyoruz.

Senaryo gerçek bir iş akışı: toplantı notlarından fonksiyonel şartname
üretmek, ondan teknik şartname çıkarmak, teknik şartnameyi bir başka ajana
denetletmek ve ancak onay çıkarsa kod yazdırmak.

> Bu ders Ders 5 (ajan, `outputSchema`) ve Ders 7 (döngü, sayaç, `catch`)
> üzerine kurulur. İkisini yapmadan buraya gelmeyin.

## 8.1 Zincirin haritası

```
/data/girdi/*.md  (toplanti notlari, mevcut durum belgesi)
        |
   [file in x3] -> [join] -> tek metin
        |
   +----v-------------+
   | 1. FS Generator  | -> /data/cikti/01-FS.md
   +----+-------------+
        |
   +----v-------------+<--------------------+
   | 2. TS Generator  |                     | duzeltme turu
   +----+-------------+ -> 02-TS-turN.md    | (bulgular ile)
        |                                   |
   +----v-------------+                     |
   | 3. TS Reviewer   | -> {onay, bulgular} |
   +----+-------------+                     |
        |                                   |
   [switch: karar]                          |
     +-- "duzelt"    (tur < 2) -------------+
     +-- "mudahale"  (tur = 2) -> MUDAHALE-GEREKLI.md
     +-- "gelistir"            -> 4. Developer -> 03-kod.abap
```

Dikkat: **Reviewer → TS Generator geri dönüşü**, Ders 7'deki yeniden deneme
döngüsünün aynısıdır. Orada "servis yanıt vermedi → tekrar dene" vardı,
burada "şartname eksik → yeniden üret" var. Aynı desen, farklı içerik.

## 8.2 Zinciri ayakta tutan üç kural

Bunlar Ders 7'den taşınır ve burada daha da kritiktir — çünkü her tur
**para harcar.**

**1. Tur sayacı `msg` üzerinde.**

```javascript
msg.tur = (msg.tur || 0) + 1;
```

**2. Üst sınır var.** Bu derste 2 tur. Reviewer ikinci turda da onay
vermezse zincir durur ve insana devreder.

**3. Ajanlar arası sözleşme şemayla kurulur.** Reviewer serbest metin
dönseydi `switch` düğümü metin içinde "onay" kelimesi arardı. Bunun yerine
Ders 5.7'deki `outputSchema` kullanılır:

```json
{
  "type": "object",
  "properties": {
    "onay": { "type": "boolean" },
    "bulgular": {
      "type": "array",
      "items": { "type": "object", "properties": {
        "madde": { "type": "string" }, "onem": { "type": "string" } } }
    },
    "ozet": { "type": "string" }
  },
  "required": ["onay", "ozet"]
}
```

Artık karar düğümü tek satırdır:

```javascript
msg.onay = r.onay === true;
```

## 8.3 Ajanların rolleri

Dördü de **geçici ajan** kipinde (Ders 5.4) — her biri kendi `Instructions`
alanıyla tanımlı. Rol tanımı, çıktının karakterini doğrudan belirler.

| Ajan | Rolü | Model |
|---|---|---|
| 1. FS Generator | "Deneyimli SAP iş analisti. Belgede olmayanı uydurmaz, eksikleri açık soru olarak işaretler." | Sonnet 4.6 |
| 2. TS Generator | "Kıdemli ABAP geliştirici. Naming convention'a harfiyen uyar." | Haiku 4.5 |
| 3. TS Reviewer | "Titiz teknik lider. Eksik varsa onay vermez." | Haiku 4.5 |
| 4. Developer | "Çalışır ve yorumlu kod yazar, sözde kod yazmaz." | Sonnet 4.6 |

> **Model seçimi hız/kalite dengesidir.** Uzun belge üreten ajanlar için
> hızlı model seçmek zorunda kaldık — sebebi 8.6'da.

## 8.4 Çalıştırma ve gerçek sonuç

Zinciri portalda çalıştırdık. Girdi: üç Markdown belgesi (iki toplantı
notu + bir mevcut durum notu, toplam ~4,8 KB), içlerinde **kasten
belirsizlikler** bırakılmış.

| Adım | Süre | Çıktı |
|---|---|---|
| FS Generator | ~1 dk | `01-FS.md` (3,6 KB) |
| TS Generator tur 1 | ~1 dk | `02-TS-tur1.md` (4,7 KB) |
| TS Reviewer tur 1 | ~40 sn | **onay yok** — 5 bulgu |
| TS Generator tur 2 | ~1 dk | `02-TS-tur2.md` (5,8 KB) |
| TS Reviewer tur 2 | ~40 sn | **onay yok** — tur hakkı bitti |
| Sonuç | — | `MUDAHALE-GEREKLI.md` |

**Zincir kod üretmedi — ve bu doğru davranıştır.** Belgelerdeki
belirsizlikler giderilmeden geliştirmeye başlanamayacağına karar verdi.

Reviewer'ın bulduğu ilk madde, girdideki gerçek bir çelişkiydi:

> *"Açık sipariş mantığında çelişki: FS'de 'açık satınalma siparişi olan
> malzemeler uyarıya girmez' deniliyor, ancak TS'de gecikmiş sipariş
> durumunda 'uyarıya girer' deniyor. Hangi koşulda tam olarak uyarıya
> girecek/girmeyecek net değil."*

Bu çelişki toplantı notlarına bilerek konmuştu (12.08 toplantısında
tartışılıp 19.08'de kısmen çözülmüştü). Ajan onu buldu.

Diğer bulgular da gerçek eksiklere işaret etti: kolon listesinin hiç
gelmemiş olması, kritik malzeme tablosunu kimin dolduracağının
belirsizliği, e-posta hata yönetiminin tanımsızlığı.

### Aynı zincir, gevşetilmiş denetçiyle

Reviewer'ın `Instructions` alanını tek cümleyle değiştirdik:

```
MUKEMMELLIK ARAMA: belge genel yapisiyla makul duzeydeyse ve gelistirici
koda baslayabilecekse ONAY VER. Sadece koda baslamayi gercekten IMKANSIZ
kilan eksiklerde onay verme.
```

Sonuç tamamen değişti:

| Tur | Katı denetçi | Gevşek denetçi |
|---|---|---|
| 1 | 5 bulgu, onay yok | 5 bulgu, onay yok |
| 2 | onay yok → **müdahale** | **onaylandı** → Developer |
| Çıktı | `MUDAHALE-GEREKLI.md` | `03-kod.abap` (22 KB, 710 satır) |

İkinci senaryoda üretilen kod, teknik şartnameye uygun çıktı: program adı
`ZMM_R_STOK_KRITIK`, doğru tablolar (`MARD`, `MARC`, `MAKT`, `EKET`),
üç uyarı seviyesi, ALV ve e-posta blokları.

> **Buradaki asıl ders teknik değil.** Zincirin çıktısını belirleyen şey
> düğüm bağlantıları değil, **denetçinin ne kadar titiz olacağına dair
> verdiğiniz talimattı.** Aynı akış, aynı girdi, tek cümle fark — biri
> insana devretti, diğeri kod üretti.
>
> Çok ajanlı sistemlerde kalite eşiğini siz belirlersiniz. Eşiği yüksek
> tutarsanız zincir sık sık insana döner; düşük tutarsanız eksik belgeyle
> kod yazılır. Doğru ayar işin riskine bağlıdır.

## 8.5 Ara çıktıları saklamak neden önemli

Her tur ayrı dosyaya yazılır: `02-TS-tur1.md`, `02-TS-tur2.md`. Böylece
"ikinci turda ne değişti?" sorusu somut olarak cevaplanabilir — tur 2
belgesi tur 1'den 1,1 KB daha uzundu ve bulguların bir kısmını kapatmıştı.

Zincir bir kutu değil, **izlenebilir bir süreç** olmalıdır. Ara çıktı
yazmayan bir zincir hata ayıklanamaz.

## 8.6 Gerçek sınır: platform geçidi zaman aşımı

İlk denememiz ikinci turda çöktü. Konteyner log'unda (Ders 5.8'deki
teşhis komutu) sebep göründü:

```
Error Info: OriginTimeout
x-azure-ref ID: 20260829T111922Z-...
```

**Ajan düğümünün kendi `timeout` ayarı (5 dk) burada geçersizdir.**
Platformun önündeki Azure geçidi kendi zaman aşımını uygular ve uzun
süren çağrıyı keser.

Sebep, düzeltme turunda girdinin şişmesiydi: FS (7 KB) + önceki TS
(19 KB) + 15 bulgu birlikte gönderiliyordu.

**Üç düzeltme sorunu çözdü:**

| Düzeltme | Nasıl |
|---|---|
| Belgeleri kısalt | Prompt'a "en fazla 120/180 satır" kuralı |
| Bulguları sınırla | Reviewer'a "en fazla 5 kritik bulgu" |
| Geri beslemeyi hafiflet | Düzeltme turunda önceki TS'in **tamamı değil, sadece başlıkları** gönderilir |

Üçüncüsü en etkilisiydi:

```javascript
const basliklar = oncekiTs
  .split(NL)
  .filter(l => l.charAt(0) === "#")
  .join(NL);
```

> **Zincir tasarımının altın kuralı:** Her tur girdiyi büyütüyorsa, zincir
> er geç bir duvara çarpar. Geri beslemede **tam metin değil, özet**
> taşıyın.

## 8.7 Ajan hataları her zaman kalıcı değil

Bir çalıştırmada FS Generator şu hatayı verdi:

```
Error: Cannot read properties of undefined (reading 'length')
  source: { type: "axet-agents-execute", name: "1. FS Generator" }
```

Hata ajan düğümünün **kendi içinden** geldi. Hiçbir şey değiştirmeden
tekrar çalıştırdığımızda sorunsuz geçti — yani **geçici** bir hataydı.

Ders 7'nin sınıflandırma mantığı burada da geçerlidir: ajan çağrıları
geçici olarak başarısız olabilir. Üretim zincirlerinde ajan düğümlerini
`catch` + sınırlı yeniden deneme ile sarmalayın.

## 8.8 Maliyet ve kapsam uyarısı

Bu zincir tek çalıştırmada **6 ajan çağrısı** yaptı (1 FS + 2 TS +
2 review + 0 developer). Onay çıksaydı 7 olacaktı.

| Değişken | Etkisi |
|---|---|
| Tur sınırı | Her tur 2 çağrı ekler (TS + review) |
| Belge uzunluğu | Girdi ve çıktı token'ı doğrudan artar |
| Model seçimi | Sonnet ↔ Haiku arasında kayda değer fark |

İlk denemeleri **küçük belgelerle ve 2 tur sınırıyla** yapın. Ders 5.8'deki
`Budget exhausted` hatası, bütçesi kapalı bir projede bu zinciri
çalıştırmanın ilk adımda duracağını gösterir.

## 8.9 Hazır akışı import etmek

1. Girdi belgelerini konteynere kopyalayın:

```powershell
$k = wsl.exe -d aXet-flows_WSL -- docker ps -q
wsl.exe -d aXet-flows_WSL -- docker exec $k mkdir -p /data/girdi /data/cikti
wsl.exe -d aXet-flows_WSL -- docker cp "<yol>/01-toplanti-2026-08-12.md" "${k}:/data/girdi/"
```

2. **☰ menü → Import** →
   [`kaynaklar/ornek-08-ajan-zinciri.json`](kaynaklar/ornek-08-ajan-zinciri.json)
3. **Dört ajan düğümünü tek tek açıp kendi projenizi ve modelinizi seçin**
   (Ders 5.4 — proje ve model ayrı iki zorunlu alandır)
4. **Deploy** → `zinciri baslat` düğümüne basın

Örnek girdi ve çıktılar depoda:

| Klasör | İçerik |
|---|---|
| [`kaynaklar/demo-girdi/`](kaynaklar/demo-girdi/) | Üç kaynak belge |
| [`kaynaklar/demo-cikti/`](kaynaklar/demo-cikti/) | Katı denetçi — müdahale ile biten çalıştırma |
| [`kaynaklar/demo-cikti-onayli/`](kaynaklar/demo-cikti-onayli/) | Gevşek denetçi — kod üretilen çalıştırma |

## 8.10 Alıştırmalar

1. **Denetçi eşiğini kendiniz ayarlayın.** 8.4'teki iki senaryoyu kendi
   belgelerinizle tekrarlayın. Sizin işinizde hangi eşik doğru — zincir ne
   zaman insana dönmeli, ne zaman ilerlemeli? Bu sorunun cevabı akışın
   değil, işin özelliğidir.

2. **Tur sınırını değiştirin.** `karari oku` düğümündeki `ENUST_TUR`
   değerini 3 yapın. Üçüncü turda bulgu sayısı azalıyor mu, yoksa ajan
   aynı itirazları mı tekrarlıyor? (İkincisi olursa döngü değer üretmiyor
   demektir — sınırı artırmak çözüm değildir.)

3. **Girdiyi bozun.** `03-mevcut-durum.md` dosyasını kaldırıp zinciri
   çalıştırın. FS Generator naming convention ve tablo bilgisi olmadan ne
   üretiyor? Açık sorular listesi uzuyor mu?

4. **Beşinci ajan ekleyin.** Developer'dan sonra bir "Kod Reviewer" ekleyip
   aynı döngü desenini kurun. İpucu: `outputSchema` ve tur sayacı aynı
   şekilde çalışır; tek fark döngünün nereye geri döndüğüdür.

---

**Önceki:** [7. Hata Yönetimi](07-hata-yonetimi.md) ·
**Sonraki:** [9. Form Arayüzü](09-form-arayuzu.md) — bu zinciri bir web
uygulamasına bağlıyoruz ·
**Takıldınız mı?** → [Sorun Giderme](SORUN-GIDERME.md)
