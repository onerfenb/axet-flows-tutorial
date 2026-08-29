// catch dugumu, yakaladigi hatayi msg.error icine koyar.
// Sozlesme (Node-RED standardi):
//   msg.error.message      -> hata metni
//   msg.error.source.id    -> hatayi ureten dugumun ID'si
//   msg.error.source.type  -> dugum tipi (function, http request, file...)
//   msg.error.source.name  -> dugumun adi
//
// Orijinal msg'nin diger alanlari KORUNUR. msg.deneme bu yuzden
// hala elimizde -- yeniden deneme sayacini oradan okuyabiliyoruz.

const hata = msg.error || {};
const kaynak = hata.source || {};

const ENUST_DENEME = 3;
const deneme = msg.deneme || 0;

// Her hata yeniden denenmeye degmez. Kalici hatalari (yetki, gecersiz
// veri) tekrar denemek sadece zaman kaybidir; sadece gecici olanlari
// yeniden deneyin.
const metin = String(hata.message || "");
const geciciMi = /timeout|ECONNREFUSED|yanit vermedi|503|502|429/i.test(metin);

msg.hataOzeti = {
  mesaj: metin,
  dugum: kaynak.name || kaynak.type || "bilinmiyor",
  dugumTipi: kaynak.type || "-",
  deneme: deneme,
  gecici: geciciMi
};

if (geciciMi && deneme < ENUST_DENEME) {
  msg.karar = "yeniden-dene";
  node.status({ fill: "yellow", shape: "ring", text: `yeniden deneniyor (${deneme}/${ENUST_DENEME})` });
} else {
  msg.karar = "vazgec";
  node.status({ fill: "red", shape: "dot", text: geciciMi ? "deneme hakki bitti" : "kalici hata" });
}

return msg;
