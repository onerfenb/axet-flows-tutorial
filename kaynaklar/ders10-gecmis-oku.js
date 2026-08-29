// Kosu gecmisini okur ve ozetler.
//
// Onceki dugum (file in) dosyanin TAMAMINI tek metin olarak veriyor.
// JSONL'de her satir ayri bir kayit; bolup tek tek cozuyoruz.

const NL = String.fromCharCode(10);
const ham = (msg.payload || "").toString();

const kayitlar = ham
  .split(NL)
  .map(satir => satir.trim())
  .filter(Boolean)
  .map(satir => {
    // Bozuk bir satir tum raporu dusurmesin -- dosyaya yazma yarida
    // kesilirse (konteyner kapanmasi) son satir eksik kalabilir.
    try { return JSON.parse(satir); } catch (e) { return null; }
  })
  .filter(Boolean);

if (kayitlar.length === 0) {
  node.status({ fill: "yellow", shape: "ring", text: "gecmis bos" });
  msg.payload = { kosu: 0, mesaj: "Henuz kayit yok" };
  return msg;
}

const son10 = kayitlar.slice(-10).reverse();
const toplamKritik = kayitlar.reduce((t, k) => t + (k.kritik || 0), 0);

msg.payload = {
  toplamKosu: kayitlar.length,
  ilk: kayitlar[0].tarih,
  son: kayitlar[kayitlar.length - 1].tarih,
  toplamKritikBulgu: toplamKritik,
  son10: son10
};

node.status({ fill: "green", shape: "dot", text: kayitlar.length + " kosu" });
return msg;
