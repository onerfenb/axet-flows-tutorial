// Form ekinden gelen dosyalari tek bir metne cevirir.
//
// Formio'nun "base64" depolama modunda her dosya soyle gelir:
//   {
//     storage:      "base64",
//     name:         "01-toplanti.md",
//     originalName: "01-toplanti.md",
//     type:         "text/markdown",
//     size:         1234,
//     url:          "data:text/markdown;base64,IyBUb3BsYW50..."
//   }
//
// Icerik dosyanin KENDISINDE (url alaninda) tasiniyor -- diske hicbir sey
// yazilmiyor, ayri bir depolama servisi gerekmiyor. Bedeli: dosya
// tarayicidan sunucuya base64 olarak gidiyor, yani ~%33 sismis halde.

const veri = (msg.payload && msg.payload.data) || {};
const dosyalar = veri.belgeler;

if (!Array.isArray(dosyalar) || dosyalar.length === 0) {
  node.status({ fill: "red", shape: "ring", text: "dosya yok" });
  node.error("Form dosya eklenmeden gonderildi", msg);
  return null;
}

const NL = String.fromCharCode(10);
const parcalar = [];

for (const d of dosyalar) {
  const url = d.url || "";
  const virgul = url.indexOf(",");

  // "data:<mime>;base64,<icerik>" bicimini bekliyoruz. Baska bir depolama
  // modu secilirse (s3, url, azure) burada url yerine bir HTTP adresi
  // gelir ve bu kontrol devreye girer.
  if (virgul < 0 || url.indexOf("base64") < 0) {
    node.error("Dosya base64 degil, depolama modunu kontrol edin: " + (d.name || "?"), msg);
    return null;
  }

  const metin = Buffer.from(url.slice(virgul + 1), "base64").toString("utf8");
  parcalar.push("### DOSYA: " + (d.originalName || d.name) + NL + metin);
}

msg.dosyaSayisi = dosyalar.length;
msg.dosyaAdlari = dosyalar.map(d => d.originalName || d.name);
msg.payload = parcalar.join(NL + NL);

node.status({
  fill: "blue",
  shape: "dot",
  text: msg.dosyaSayisi + " dosya / " + msg.payload.length + " karakter"
});

return msg;
