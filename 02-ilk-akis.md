# 2. İlk Akış: timestamp → function → debug

Bu bölümde çalışan bir akış kuracaksınız: bir tetikleyici mesaj üretecek,
bir JavaScript düğümü onu dönüştürecek, sonuç debug panelinde görünecek.

Basit görünüyor ama **her aXet.flows akışının iskeleti budur.**

## 2.1 Temel kavram: `msg` nesnesi

Node-RED'de düğümler birbirine veri değil, **mesaj** geçirir. Mesaj bir
JavaScript nesnesidir:

```javascript
msg = {
  payload: "asıl veri buraya",   // taşınan içerik
  topic:   "etiket",              // meta bilgi, ayırt etmek için
  _msgid:  "otomatik"             // sistem üretir
}
```

Kural basit: **bir düğüm `msg`'i alır, değiştirir, çıkışına verir.**
Veri neredeyse her zaman `msg.payload` içindedir.

## 2.2 Akışın üç parçası

Her akış bu üç rolden oluşur — bazıları birden fazla, bazıları hiç olabilir:

| Rol | Bu örnekte | Gerçek hayatta |
|---|---|---|
| **Tetikleyici** | `inject` (timestamp) | zamanlayıcı, HTTP çağrısı, dosya izleme, e-posta |
| **İşlem** | `function` | filtrele, hesapla, API çağır, OCR yap, PDF oku |
| **Çıktı** | `debug` | dosya yaz, e-posta gönder, veritabanı, API'ye POST |

## 2.3 Adım adım kurulum

### Adım 1 — inject düğümü

1. Sol paletteki arama kutusuna `inject` yazın
2. Çıkan düğümü tuvale sürükleyin
3. Tuvalde **`timestamp`** adıyla görünür

`inject`, akışı elle tetiklemenizi sağlar — sol tarafındaki küçük butona
basınca mesaj üretir. Varsayılan olarak `msg.payload`'a o anki zaman
damgasını (Unix milisaniye) koyar.

### Adım 2 — debug düğümü

1. Aramaya `debug` yazın
2. Tuvale sürükleyin, `timestamp`'in sağına bırakın
3. **`debug 1`** adıyla görünür

`debug`, `msg.payload`'ı sağ paneldeki debug sekmesine yazar. Akış
geliştirirken en çok kullanacağınız düğüm budur.

### Adım 3 — bağlayın

`timestamp` düğümünün **sağ kenarındaki küçük noktadan**, `debug 1`
düğümünün **sol kenarındaki noktaya** sürükleyin. Aralarında bir kablo
çizilir.

> ⚠️ **Buraya dikkat.** Node-RED'de bir düğümü mevcut bir kablonun
> *üzerine* bırakırsanız teorik olarak araya girer. Pratikte bu davranış
> sık sık tetiklenmez ve düğüm **görsel olarak arada görünmesine rağmen
> bağlantısız kalır.** Hata vermez — sadece çalışmaz.
>
> **Kabloları elle çizin.** Bu, aracın en sinsi tuzağıdır ve bu eğitimi
> hazırlarken tam olarak bu hataya düştük.

### Adım 4 — Deploy

**Alt ortadaki ▷ butonuna** basın.

> Deploy butonu **alt orta** bardadır, sağ üstteki değil. Sağ üstteki
> benzer görünümlü buton başka iş yapar.

Deploy etmeden hiçbir değişiklik çalışan motora geçmez. Deploy etmeden
tetiklerseniz şu uyarıyı görürsünüz:

> **Warning:** node has undeployed changes

### Adım 5 — Debug panelini açın ve test edin

1. Sağ üstteki **böcek (🐞) simgesine** tıklayın → *Debug messages* paneli
2. `timestamp` düğümünün **solundaki butona** tıklayın

Debug panelinde şunu görmelisiniz:

```
27.08.2026 15:06:20   node: debug 1
msg.payload : number
1787832380279
```

**İlk akışınız çalıştı.** Ham bir zaman damgası, uçtan uca aktı.

## 2.4 Anlamlı hale getirme: function düğümü

Ham `1787832380279` kimseye bir şey ifade etmiyor. Araya bir `function`
düğümü koyup mesajı dönüştürelim.

### Adım 6 — function düğümünü ekleyin

1. Aramaya `function` yazın (`high performance function` değil, düz olan)
2. Tuvale sürükleyin — kablonun **üzerine değil**, altına/boşluğa bırakın
3. Mevcut `timestamp → debug 1` kablosuna tıklayın (turuncu olur), **Delete**
4. `timestamp` çıkışı → `function` girişi sürükleyin
5. `function` çıkışı → `debug 1` girişi sürükleyin

Sonuç: `timestamp → function → debug 1`

### Adım 7 — kodu yazın

`function` düğümüne **çift tıklayın**. Editör açılır. Üç sekme vardır:

| Sekme | Ne zaman çalışır |
|---|---|
| **On Start** | akış başlatıldığında bir kez |
| **On Message** | her mesaj geldiğinde ← kodumuz buraya |
| **On Stop** | akış durdurulduğunda |

**On Message** sekmesindeki hazır içeriği silin (Ctrl+A) ve şunu yazın:

```javascript
// Gelen zaman damgasini okunabilir parcalara ayir
const gelenZamanDamgasi = msg.payload;
const tarih = new Date(gelenZamanDamgasi);

// Etiket: debug panelinde mesajlari ayirt etmeye yarar
msg.topic = "akis-testi";

// Payload'i nesne olarak yeniden yaz.
// Nesne sectik ki sonraki dugumler tek alana erisebilsin:
//   msg.payload.saat  ->  "15:06:20"
msg.payload = {
    mesaj: "aXet.flows akisi calisti",
    tarih: tarih.toLocaleDateString("tr-TR"),
    saat: tarih.toLocaleTimeString("tr-TR"),
    hamDamga: gelenZamanDamgasi
};

return msg;
```

(Aynı kod: [`kaynaklar/zamani-formatla.js`](kaynaklar/zamani-formatla.js))

**Name** alanına `zamani formatla` yazın — isimsiz düğümler büyük
akışlarda okunmaz hale gelir. Sonra **Done**.

### `return msg;` neden kritik?

`function` düğümü, döndürdüğünüz mesajı çıkışına verir. `return msg;`
yazmazsanız **mesaj o düğümde ölür**, sonraki düğüme hiçbir şey ulaşmaz.
Hata da vermez. Yeni başlayanların bir numaralı hatası budur.

### Neden nesne döndürdük, düz metin değil?

Düz metin döndürebilirdik:

```javascript
msg.payload = "Akis 27.08.2026 15:06:20 tarihinde calisti";
```

Okunur, ama çıkmaz sokaktır. Sonraki düğüm sadece saati isterse metni
ayrıştırmak zorunda kalır. Nesne döndürünce `msg.payload.saat` diye tek
alana erişilir.

**Kural: metin akışın sonundaysa iyi, ortasındaysa bir sonraki adımı kör eder.**

### Adım 8 — Deploy ve test

Alt ortadaki **▷** ile deploy edin, `timestamp` düğümünün butonuna basın.

Debug panelinde:

```
27.08.2026 16:02:02   node: debug 1
akis-testi : msg.payload : Object
▸ { mesaj: "aXet.flows akisi calisti",
    tarih: "27.08.2026", saat: "16:02:02",
    hamDamga: 1787835722616 }
```

Üç fark dikkat çekiyor:

1. `msg.payload : number` yerine **`msg.payload : Object`**
2. Solda **`akis-testi`** etiketi → `msg.topic` bunun için var
3. **▸ oku** ile nesne alanlarını tek tek açabilirsiniz

## 2.5 Hazır akışı import etmek

Bu akışı sıfırdan kurmak yerine hazır alabilirsiniz:

1. Tasarımcıda sağ üst **☰ menü → Import**
2. [`kaynaklar/ornek-01-akis.json`](kaynaklar/ornek-01-akis.json) dosyasının
   içeriğini yapıştırın
3. **Import** → **Deploy**

## 2.6 Çalışmıyorsa: motorun gerçeğine bakın

Tuvalde doğru görünen şey motorda yanlış olabilir. Node-RED'in admin
API'si size **gerçek** akış tanımını verir:

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:<PORT>/flows' |
  Where-Object { $_.type -in 'inject','function','debug' } |
  Select-Object type, name, wires
```

`wires` alanı bağlantıları gösterir. Şöyle olmalı:

```
inject            wires: [['<function-id>']]
zamani formatla   wires: [['<debug-id>']]
debug 1           wires: []
```

`function` düğümünün `wires` alanı `[[]]` ise **bağlantısızdır** — 2.3
Adım 3'teki tuzağa düşmüşsünüz demektir.

> Bu eğitimi hazırlarken tam olarak bu oldu: ekran "çalışıyor" diyordu,
> API gerçeği söyledi. **Otomasyon araçlarında hata ararken motorun
> tanımına bakın, tuvale değil.**

## 2.7 Alıştırmalar

Öğrendiğinizi pekiştirmek için:

1. **Kolay** — `msg.payload`'a bir alan daha ekleyin: haftanın günü
   (`tarih.toLocaleDateString("tr-TR", { weekday: "long" })`)
2. **Orta** — `inject` düğümünü çift tıklayıp **Repeat** ayarını
   "interval / every 10 seconds" yapın. Akış artık kendi kendine çalışır.
   (Test bitince kapatmayı unutmayın!)
3. **Zor** — İkinci bir `debug` düğümü ekleyin ve `function`'ın çıkışını
   **iki** debug düğümüne birden bağlayın. Bir çıkış birden fazla yere
   bağlanabilir mi? Deneyin ve gözlemleyin.

---

**Takıldınız mı?** → [Sorun Giderme](SORUN-GIDERME.md)
