# Sorun Giderme

Kurulum ve ilk kullanımda karşılaşılan hatalar, sebepleri ve çözümleri.
Hepsi gerçek bir kurulumda yaşandı.

## Hızlı teşhis komutu

Bir şey çalışmıyorsa önce bunu çalıştırın — zincirin hangi halkasının
koptuğunu gösterir:

```powershell
Write-Host "1. Masaustu ajani:" -NoNewline
if (Get-Process 'aXet.flows-Desktop' -ErrorAction SilentlyContinue) { " CALISIYOR" } else { " KAPALI" }

Write-Host "2. WSL dagitimi:"
wsl.exe -l -v

Write-Host "3. Docker:"
wsl.exe -d aXet-flows_WSL -- docker version --format '{{.Server.Version}}'

Write-Host "4. Yerel ajan (401 = normal):"
(Invoke-WebRequest 'https://localhost:65430/api/health' -SkipCertificateCheck -SkipHttpErrorCheck).StatusCode

Write-Host "5. SSH proxy:"
netstat -ano | Select-String ':2222'

Write-Host "6. Konteynerler:"
wsl.exe -d aXet-flows_WSL -- docker ps
```

---

## Kurulum sorunları

### "Starting SSH proxy for mirrored networking mode..." ekranında takıldı

**Belirti:** aXet.flows Desktop açılış ekranında bu mesajla donuyor,
dakikalarca (bizde yarım saat) ilerlemiyor.

**Sebep:** SSH proxy adımı, WSL dağıtımının ilk kurulumuyla yarışıyor.
Altyapı aslında hazır oluyor ama uygulama sinyali kaçırıyor.

**Kontrol:** Gerçekten hazır mı?

```powershell
netstat -ano | Select-String ':2222'          # ESTABLISHED satiri var mi?
(Invoke-WebRequest 'http://127.0.0.1:2375/version' -UseBasicParsing).StatusCode   # 200 mu?
```

İkisi de olumluysa altyapı hazır, sadece uygulama takılmış.

**Çözüm:** Uygulamayı kapatıp yeniden açın.

```powershell
Stop-Process -Name 'aXet.flows-Desktop' -Force -ErrorAction SilentlyContinue
Stop-Process -Name 'win-sshproxy' -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 4
Start-Process 'C:\ProgramData\NTT\axetflows-desktop\axetflows-desktop-win-prod\aXet.flows-Desktop.exe'
```

---

### "Internal server error — Docker container connection error"

**Tam metin:**
> Internal server error
> Docker container connection error. Please ensure that the container runtime is running.

**Nerede:** Portalda, genellikle Docker Dashboard'a girerken.

**Sebep:** Portal, yerel makinenizdeki Docker'a ulaşamıyor. Portal sadece
arayüzdür; konteyner sizin makinenizde çalışır.

**Çözüm sırası:**

1. aXet.flows Desktop çalışıyor mu? → Başlat Menüsü'nden açın
2. WSL dağıtımı ayakta mı? → `wsl.exe -l -v` → `Running` olmalı
3. Docker cevap veriyor mu? → `wsl.exe -d aXet-flows_WSL -- docker ps`
4. Hâlâ olmuyorsa → uygulamayı kapat-aç

---

### "Error trying to open the axet flow designer!"

**Belirti:** New Version → Regular Deployment sonrası bu hata.

**Sebep (en yaygın):** Docker hazır değil veya imaj henüz inmemiş.

**Kontrol:**

```powershell
wsl.exe -d aXet-flows_WSL -- docker images
```

`axet-flows/flows:latest-prod` (yaklaşık 2.18 GB) listede olmalı.
Yoksa imaj inmemiştir.

**Çözüm:** Docker'ın ayakta olduğundan emin olup **New Version** işlemini
tekrarlayın. İlk indirme 5-15 dakika sürer, sabırlı olun — portaldaki
ilerleme çubuğunu izleyin.

---

### Company Portal'da / Programlar listesinde aXet.flows yok

**Bu normaldir.** aXet.flows Desktop klasik MSI kurulumu değildir,
`C:\ProgramData\NTT\axetflows-desktop\` altına dağıtılır. Kontrol:

```powershell
Test-Path 'C:\ProgramData\NTT\axetflows-desktop\axetflows-desktop-win-prod\aXet.flows-Desktop.exe'
```

Kaldırmak için klasörü silmek gerekir; kaldırma sihirbazı yoktur.

---

### "Docker Desktop kurmam gerekiyor mu?"

**Hayır.** Uygulama kendi WSL dağıtımını kurar ve Docker'ı içinde çalıştırır.
Docker Desktop kurmayın — çakışma yaratabilir.

WSL platformu zaten etkinse (`wsl.exe --version` çalışıyorsa) **yönetici
hakkı olmadan** tüm kurulum tamamlanır. Yönetici hakkı sadece WSL'in
kendisi hiç kurulu değilse gerekir.

---

## Tasarımcı sorunları

### Düğüm tuvalde bağlı görünüyor ama akış çalışmıyor

**Belirti:** `A → B → C` şeklinde dizilmiş düğümler, ama ortadaki düğüm
hiç çalışmıyor. Hata mesajı yok.

**Sebep:** Düğümü mevcut bir kablonun *üzerine* bıraktınız ve Node-RED'in
"araya gir" davranışı tetiklenmedi. Kablo düğümün üzerinden geçiyor gibi
görünüyor ama bağlantı hâlâ eski haliyle duruyor.

**Kontrol (kesin yöntem):**

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:<PORT>/flows' |
  Where-Object { $_.type -in 'inject','function','debug' } |
  Select-Object type, name, wires
```

Ortadaki düğümün `wires` alanı `[[]]` ise bağlantısızdır.

**Çözüm:** Eski kabloyu silin (üzerine tıkla → Delete), kabloları elle
çizin.

---

### "Warning: node has undeployed changes"

**Sebep:** Değişikliği deploy etmediniz. Tuvaldeki her şey taslaktır.

**Çözüm:** **Alt ortadaki ▷** butonuna basın. (Sağ üstteki benzer buton
değil.)

---

### function düğümü çalışıyor ama sonraki düğüme bir şey gitmiyor

**Sebep:** Kodun sonunda `return msg;` yok.

`function` düğümü, döndürdüğünüz mesajı çıkışına verir. Döndürmezseniz
mesaj orada ölür ve **hata da vermez**.

**Çözüm:** Kodun sonuna `return msg;` ekleyin.

---

### Debug panelinde hiçbir şey görünmüyor

Sırayla kontrol edin:

1. Debug paneli açık mı? → Sağ üstteki 🐞 simgesi → *Debug messages*
2. Akış deploy edildi mi? → Alt ortadaki ▷
3. `debug` düğümü etkin mi? → Düğümün sağındaki küçük kare butona bakın
4. Bağlantılar doğru mu? → Yukarıdaki `wires` kontrolü

---

### Flow'u başkası düzenleyemiyor / "flow is blocked"

**Sebep:** Biri **New Version** yaptı ve kilidi bırakmadı.

**Çözüm:** Kilidi alan kişi: **Catalog** → flow kartının `…` menüsü →
**Unblock Flow**.

Kartta asma kilit simgesi ve kilidi tutan kişinin adı görünür.

---

## Tasarımcı portunu bulma

Tasarımcı konteyneri her açılışta **farklı bir port** kullanır.

**En kolay yol — portaldan:** **Docker Dashboard** → *In Design* kutusu →
**"Flows designer port"** satırı adresi doğrudan verir.

![Docker Dashboard - designer port](gorseller/07-docker-dashboard.png)

**Komut satırından:**

```powershell
wsl.exe -d aXet-flows_WSL -- docker ps --format "{{.Names}} {{.Ports}}"
```

Çıktıda `172.17.0.1:<PORT>->1880/tcp` görürsünüz. Tasarımcı adresi:
`http://127.0.0.1:<PORT>`

---

## Katkı

Yeni bir hatayla karşılaştıysanız bu dosyaya şu şablonla ekleyin:

```markdown
### <Hatanın tam metni veya kısa belirti>

**Belirti:** ne görüyorsunuz
**Sebep:** neden oluyor
**Kontrol:** doğrulama komutu
**Çözüm:** adımlar
```

Hata mesajının **tam metnini** yazmak en değerlisidir — insanlar arama
motoruna onu yapıştırıyor.
