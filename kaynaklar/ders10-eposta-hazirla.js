// Excel buffer'ini e-posta ekine cevirir.
//
// json-to-excel dugumu msg.payload'a bir Buffer birakir. MS Graph ise
// eki BASE64 metin olarak ister. Ders 9'da base64 formdan ICERI
// geliyordu; burada aynı bicim DISARI gidiyor.

const buf = msg.payload;

if (!Buffer.isBuffer(buf)) {
  node.error("Beklenen Excel buffer'i gelmedi, gelen tip: " + typeof buf, msg);
  return null;
}

const s = msg.ozet || { KRITIK: 0, UYARI: 0, IZLE: 0 };
const NL = String.fromCharCode(10);

// Dosya adina tarih koymak, gelen kutusunda ayni adli 30 dosya
// birikmesini onler.
const g = new Date();
const iki = n => (n < 10 ? "0" : "") + n;
const damga = g.getFullYear() + iki(g.getMonth() + 1) + iki(g.getDate());
const dosyaAdi = "kritik-stok-" + damga + ".xlsx";

const govde = [
  "<p>Gunluk kritik stok raporu ektedir.</p>",
  "<table cellpadding='6' style='border-collapse:collapse'>",
  "<tr><td style='background:#FFC7CE'><b>KRITIK</b></td><td><b>" + s.KRITIK + "</b></td></tr>",
  "<tr><td style='background:#FFEB9C'><b>UYARI</b></td><td><b>" + s.UYARI + "</b></td></tr>",
  "<tr><td style='background:#C6EFCE'><b>IZLE</b></td><td><b>" + s.IZLE + "</b></td></tr>",
  "</table>",
  "<p style='color:#888;font-size:12px'>Bu ileti aXet.flows tarafindan otomatik uretildi.</p>"
].join(NL);

msg.payload = {
  subject: "Kritik stok raporu -- " + iki(g.getDate()) + "." + iki(g.getMonth() + 1) + "." + g.getFullYear(),

  // Alicilar koda GOMULU DEGIL: secret dugumu msg.alicilar'i dolduruyor.
  // Ders 8'in sartnamesi de "e-posta listesi konfigurasyondan okunacak,
  // koda gomulmeyecek" diyordu -- burada onu uyguluyoruz.
  // secret tek bir metin tasidigi icin virgulle ayrilmis liste kabul ediyoruz.
  toRecipients: String(msg.alicilar || "")
    .split(",")
    .map(a => a.trim())
    .filter(Boolean)
    .map(a => ({ emailAddress: { address: a } })),

  // KRITIK varsa e-posta yuksek onemle gitsin
  importance: s.KRITIK > 0 ? "high" : "normal",

  body: { contentType: "html", content: govde },

  attachments: [{
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: dosyaAdi,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    contentBytes: buf.toString("base64")
  }]
};

node.status({
  fill: "blue", shape: "dot",
  text: dosyaAdi + " / " + Math.round(buf.length / 1024) + " KB"
});

return msg;
