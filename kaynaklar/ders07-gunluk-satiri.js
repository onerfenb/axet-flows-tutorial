// Production mode'da editor kapalidir: debug panelini goremezsiniz.
// Hatanin tek kalici izi bu dosyadir. Ders 4'teki file dugumunun
// gercek bir ise yaradigi yer burasi.

const o = msg.hataOzeti || {};
const zaman = new Date().toLocaleString("tr-TR");

// Tek satir, ayrilmis alanlar: sonradan grep/Excel ile okunabilsin.
msg.payload = [
  zaman,
  o.gecici ? "GECICI" : "KALICI",
  `deneme=${o.deneme}`,
  `dugum=${o.dugum}`,
  `mesaj=${o.mesaj}`
].join(" | ");

msg.topic = "hata-gunlugu";

return msg;
