# 5. aXet AI Ajanı

Bu ders, aXet.flows'u sıradan bir Node-RED kurulumundan ayıran kısma giriyor:
akışın içinden bir **yapay zekâ ajanı** çalıştırmak.

Kuracağımız akış:

```
inject ──► soruyu hazırla ──► aXet AI ajanı ──┬──► yanıtı incele ──► debug
                               (2 çıkışlı)     │
                                               └──► hatayı yakala ──► debug
```

## 5.1 aXet.flows'un AI tarafı iki yönlüdür

Platformda iki ayrı yaklaşım var; karıştırmayın:

| Yön | Düğüm | Ne yapar |
|---|---|---|
| **Akıştan AI'ya** | `Flows AI Agent` (`axet-agents-execute`) | Akışınız bir modele soru sorar, yanıtı akışta kullanır |
| **AI'dan akışa** | `capability in` / `capability out` | Akışınızı, AI ajanlarının çağırabileceği bir **araç** olarak yayınlar |

Bu ders birincisini anlatıyor. İkincisi için portaldaki **AI Capabilities**
menüsüne bakın — orada `add`, `subtract`, `multiply` gibi hazır MCP araçları
ve her birinin sözleşmesi (girdi/çıktı şeması, endpoint) listelenir.

> **MCP nedir?** Model Context Protocol. Bir dil modeli tek başına sadece
> metin üretir; MCP araçlarıyla hesap yapabilir, veritabanı sorgulayabilir,
> bir kurumsal kaydı okuyabilir. aXet.flows, yazdığınız akışı bu protokolle
> tüm AI ajanlarına açmanızı sağlar.

## 5.2 Düğümün sözleşmesi

`Flows AI Agent` düğümü paletin **aXet AI** kategorisindedir.

| | |
|---|---|
| **Girdi** | `msg.payload` (string veya object) — ajana verilen görev |
| **Çıktı 1 (success)** | `msg.payload` — yanıt, `response` anahtarında |
| **Çıktı 2 (error)** | `msg.error` — `{ message, code, details }` |

**İki çıkışlı olması kritik:** dış servis çağıran her düğümde hata dalını
bağlamak alışkanlık olmalı. Ağ kopar, kota dolar, token süresi geçer.

> ⚠️ Palette **`aXet Agent`** adında ikinci bir düğüm daha var — o
> **"Deprecated nodes"** kategorisinde, kullanmayın. Doğrusu
> `Flows AI Agent`.

## 5.3 Adım 1 — Akışı kurun

Yeni bir sekme açın ve şu düğümleri ekleyin:

1. `inject` — tetikleyici
2. `function` — soruyu hazırlar:

```javascript
// Ajana verilecek gorev.
// Ne kadar net ve detayli olursa sonuc o kadar iyi olur.
msg.payload = "aXet.flows nedir? Bir cumleyle, Turkce acikla.";
msg.topic   = "ai-soru";
return msg;
```

3. `Flows AI Agent` — ajan
4. İki `function` + iki `debug` — biri success çıkışına, biri error çıkışına

Hata dalı için:

```javascript
// 2. cikis: ajan hata verdiginde buraya duser.
msg.topic = "ai-HATA";
node.warn(["AJAN HATASI:", msg.error || msg.payload]);
return msg;
```

## 5.4 Adım 2 — Ajanı yapılandırın

Ajan düğümüne çift tıklayın. Dört sekme görürsünüz:
**Agent / Tools / Input-Output / Advanced**

### Agent sekmesi

| Alan | Açıklama |
|---|---|
| **Project** | aXet projeniz — model erişimi ve **bütçe** buna bağlı |
| Agent ID / Name | Kayıtlı bir ajan kullanacaksanız |
| Description | Ajanın ne yaptığı |
| **Instructions** | Sistem talimatı — ajanın kişiliği ve kuralları |
| **Model** | Proje seçilince liste dolar |

Bu ders için:

```
Instructions: Sen yardimci bir asistansin. Kisa ve net Turkce cevap ver.
Model:        (projenizde açık olan bir model)
```

### İki ajan kipi: geçici ve kayıtlı

`Agent ID` alanını boş bırakırsanız düğüm **geçici ajan** (*ephemeral
agent*) kipinde çalışır: ajan, o anda düğümdeki `Instructions` + `Model`
ile tanımlanır ve çağrı bitince kaybolur. Bu ders bu kipi kullanıyor.

`Agent ID` doldurulursa portalda kayıtlı bir ajan çağrılır. Aynı ajanı
birden çok akışta kullanacaksanız ikinci kip daha uygundur.

### ⚠️ Model seçmek zorunludur

Geçici ajan kipinde `Model` boş bırakılamaz. Boşsa ajan **hiç çalışmaz**:

```
Mastra API error 400: Request validation failed - Invalid ephemeral agent config:
  "message": "Model is required and cannot be empty", "path": ["model"]
```

Proje seçilmiş olması yetmez — proje ve model **ayrı iki zorunlu alandır.**

### Model havuzu

Proje seçtiğinizde NTT'nin model havuzu listelenir. Test ettiğimiz
ortamda **on model** vardı, iki sağlayıcıdan:

| Sağlayıcı | Modeller |
|---|---|
| `ntt/` | GPT-5.6 Terra · GPT-5.6 Luna · GPT-5.4 · GPT-5.4-mini · GPT-5.4-nano · GPT-5.3 Codex · GPT-5.2 Thinking |
| `aws-anthropic/` | Claude Sonnet 5 · Claude Sonnet 4.6 · Claude Haiku 4.5 |

Model adları `saglayici/model-adi` biçiminde saklanır:

```
ntt/gpt-5.4-mini
aws-anthropic/eu.anthropic.claude-sonnet-5
```

> **Sağlayıcı, bütçe hatası aldığınızda önemli hale gelir.** Bütçe
> sağlayıcı bazında ayrı tanımlanmış olabilir — `ntt/` modelinde kotanız
> dolmuşsa `aws-anthropic/` bir modelle deneyin (veya tersi).

### ⚠️ Açılır menüleri fareyle seçin

Bu düğümde **klavyeyle** (ok tuşları + Enter) yapılan seçim kaydedilmiyor —
ekranda değişmiş görünse bile `projectId` boş kalıyor. **Fareyle** seçin ve
**Done** → **Deploy** yapın.

Doğrulamak için düğümü tekrar açın; seçtiğiniz proje ve model duruyor mu bakın.

## 5.5 Adım 3 — Çalıştırın

Deploy edip `inject`'e basın. Yanıt birkaç saniye sürer.

Başarılı çıktı:

```
[cikti: yanit]
{
  response: '"aXet.flows" bana tanıdık gelen bilinen bir yazılım, kütüphane
             veya kavram değil; bu isimle ilgili güvenilir bir bilgim yok...'
}
```

![Ders 5 - AI ajanı ve yanıtı](gorseller/11-ders5-ai-ajani.png)

Ajan düğümünün altında yeşil **`done`** rozeti belirir — düğüm durumunu
tuvalde gösterir. Hata olsaydı kırmızı `validation_error` / `server_error`
yazardı.

### Bu yanıt neden "başarılı"?

Model soruyu bilmediğini söyledi — ve bu **doğru davranış.** aXet.flows
kurum içi bir ürün; genel bir dil modelinin onu bilmesi beklenmez. Model
uydurmak yerine bilmediğini söylüyor.

Buradan çıkan ders: **modele kurum içi bilgi gerektiren soru soracaksanız,
bilgiyi ona siz vermelisiniz.** Yolları:

| Yöntem | Nasıl |
|---|---|
| Bağlamı prompt'a koymak | `msg.payload`'a ilgili metni de ekleyin |
| **RAG** | Ajanın Tools sekmesinden aXet RAG aracını bağlayın |
| **MCP araçları** | Kurumsal veriyi okuyan bir akışı araç olarak açın |

## 5.6 Yanıtı akışta kullanmak

Çıktı bir **nesne** olarak gelir; metni almak için:

```javascript
const metin = msg.payload.response;
```

Buradan sonrası artık bildiğiniz şeyler: Ders 3'teki `switch` ile yanıta göre
dallanabilir, Ders 4'teki `file` düğümüyle diske yazabilirsiniz.

## 5.7 Yapılandırılmış çıktı (Output Schema)

Şimdiye kadar ajan serbest metin döndürdü. Yanıtı **akışın karar vermesi
için** kullanacaksanız bu yeterli değildir: `switch` düğümü metin içinde
"onaylıyorum" mu yazıyor diye aramak zorunda kalır ve er geç yanılır.

Çözüm ajan düğümünün **Input/Output** sekmesindedir: `Output Schema`.

| Mod | Ne zaman |
|---|---|
| **Simple** | Alanları tablodan tek tek eklemek (Name / Type / Req / Description) |
| **Advanced (JSON)** | Hazır bir JSON Schema yapıştırmak |
| **Validate** | Şemanın geçerliliğini kontrol eder — kaydetmeden önce basın |

Örnek şema:

```json
{
  "type": "object",
  "properties": {
    "onay":  { "type": "boolean", "description": "Iddia dogru mu" },
    "sebep": { "type": "string",  "description": "Tek cumlelik gerekce" }
  },
  "required": ["onay", "sebep"]
}
```

**Validate** basıldığında yeşil `outputSchema: Schema is valid.` bildirimi
çıkar. Deploy edip çalıştırdığınızda çıktının yapısı değişir:

| | `msg.payload` |
|---|---|
| Şemasız | `{ response: "aXet.flows, blockchain tabanlı…" }` |
| Şemalı | `{ onay: false, sebep: "aXet.flows hakkında bilgi sahi…" }` |

Artık `switch` düğümü doğrudan `payload.onay` alanına bakabilir. Ajanın
kararı akışın kararı haline gelir.

> **Bu, çok ajanlı akışların temelidir.** Bir ajanın çıktısını başka bir
> ajana veya bir `switch`'e güvenle bağlamak istiyorsanız, aradaki
> sözleşmeyi şema kurar — serbest metin değil.

## 5.8 Sık karşılaşılan hatalar

### `Project ID not configured` (`VALIDATION_ERROR`)

Proje seçilmemiş. Ajan düğümünü açıp **Project** seçin. Klavyeyle seçtiyseniz
kaydedilmemiş olabilir — 5.4'e bakın.

Akışı **import ettiyseniz veya bir versiyondan geri yüklediyseniz** bu hata
beklenendir: `projectId` alanı taşınmamıştır. Ayrıntı için 5.9'a bakın.

### `Invalid ephemeral agent config` (`VALIDATION_ERROR`, 400)

`Model` alanı boş. Mesajın içinde tam sebep yazar:

```
"message": "Model is required and cannot be empty", "path": ["model"]
```

Ajan düğümünü açıp **Model** seçin — 5.4'e bakın.

### `Budget exhausted or billing disabled for this project` (500)

**Bu bir kod hatası değil, bütçe/yetki sorunudur.** Seçtiğiniz projenin AI
kredisi kapalı. Mesaj hangi model grubunun reddedildiğini de söyler:

```
Budget exhausted or billing disabled for this project.
Received Model Group=openai/gpt-5.4-mini
Available Model Group Fallbacks=None
```

`Fallbacks=None` satırı önemli: platform sizin için otomatik olarak başka
bir modele geçmez, çağrı doğrudan düşer.

**Çözüm sırası:**

1. **Başka bir proje deneyin.** Bütçe proje bazındadır — eğitimi hazırlarken
   bir projede kapalı, diğerinde açıktı.
2. **Başka bir sağlayıcı deneyin.** `ntt/` kapalıysa `aws-anthropic/` bir
   model açık olabilir.
3. Hepsi kapalıysa proje sahibinden veya IT'den AI bütçesi talep edin.

Hata mesajının tam zinciri mimariyi de gösterir:

```
Mastra API error 500  ->  litellm.APIError  ->  OpenAIException
   (ajan katmani)          (model yonlendirici)     (saglayici)
```

Kurumsal AI platformları modeli doğrudan çağırmaz; araya **bütçe, kota ve
model yönlendirme** katmanları koyar. Bu hata o katmandan gelir.

### Hata mesajı yarıda kesiliyor — tam metni nasıl görürsünüz

Debug paneli uzun hataları kırpar. Şunu görürsünüz:

```
message: "Mastra API error 400: {"error":"Request validation failed - Invalid ephemeral ag..."
```

Asıl sebep tam da kesilen yerdedir. **Tam metin konteyner log'undadır:**

```powershell
wsl.exe -d aXet-flows_WSL -- docker logs --tail 40 $(wsl.exe -d aXet-flows_WSL -- docker ps -q)
```

Bu komut eğitimi hazırlarken iki hatanın da sebebini ortaya çıkardı; debug
paneline bakarak ikisini de bulmak mümkün değildi.

> **Alışkanlık edinin:** Ajan hatası aldığınızda önce log'a bakın. Ajan
> katmanı (Mastra), model yönlendirici (litellm) ve sağlayıcı ayrı ayrı
> mesaj üretir — hangisinin konuştuğunu ancak tam metin söyler.

### Yanıt çok uzun sürüyor / zaman aşımı

**Advanced** sekmesinden `timeout` (varsayılan 300000 ms = 5 dk) ve
`maxSteps` (15) ayarlarına bakın. Ajan araç kullanıyorsa birden fazla adım
atar, süre uzar.

## 5.9 Hazır akışı import etmek

1. **☰ menü → Import**
2. [`kaynaklar/ornek-05-axet-ai.json`](kaynaklar/ornek-05-axet-ai.json)
   içeriğini yapıştırın
3. **Import** → ajan düğümünü açıp **kendi projenizi ve modelinizi seçin**
   → **Deploy**

> Dosyadaki `projectId` ve `model` alanları **bilerek boş** bırakılmıştır.
> Paylaşılan akışlardan kurum içi kimlik bilgilerini temizlemek şarttır.

**Versiyon, `projectId` alanını taşır.** Bu deneyle doğrulandı: proje seçili
haldeyken versiyon kaydedildi, konteyner tamamen silindi, tasarımcı o
versiyondan sıfırdan açıldı — proje seçimi yerindeydi.

Yani bir versiyondan geri yüklediğinizde `Project` boş geliyorsa, sebebi
şudur: **o versiyon kaydedilirken zaten boştu.** Versiyon, kaydedildiği
andaki son deploy'un birebir kopyasıdır.

> ⚠️ **Açılır listeler geç dolar — boş sanmayın.** Düğümü açtığınızda
> `Project` alanı birkaç saniye **boş görünür**; liste arka planda yüklenir
> ("Downloading options...") ve ancak sonra seçili değer belirir.
>
> Bu aralıkta "seçim kaybolmuş" sanıp yeniden seçmeyin. Emin olmak için
> birkaç saniye bekleyin. Alan gerçekten boşsa, akış çalıştırıldığında
> `Project ID not configured` hatası verir — asıl kanıt budur.

## 5.10 Alıştırmalar

1. **Kolay** — `Instructions` alanını değiştirin: "Sadece madde madde cevap
   ver" deyin ve farkı gözleyin. Sistem talimatının gücünü görün.
2. **Orta** — Soruyu sabit yazmak yerine `inject` düğümünün payload'ından
   alın (`msg.payload` string olarak gelir). Aynı akışla farklı sorular sorun.
3. **Zor** — Ajanın yanıtını Ders 4'teki `file` düğümüyle diske yazın.
   Her soruyu ve yanıtı bir log dosyasında biriktirin. İpucu:
   `msg.payload.response` metnini `file` düğümüne vermeden önce
   `msg.payload` içine almalısınız.

---

**Takıldınız mı?** → [Sorun Giderme](SORUN-GIDERME.md)
