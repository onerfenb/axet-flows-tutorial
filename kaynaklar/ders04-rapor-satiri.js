const t = new Date();

// Sayac: flow context akis yeniden baslayana kadar yasar
let sayac = flow.get("calismaSayisi") || 0;
sayac = sayac + 1;
flow.set("calismaSayisi", sayac);

const zaman = t.toLocaleString("tr-TR");

// file dugumu msg.payload icindeki METNI yazar
msg.payload = `${zaman} | calisma #${sayac} | durum: OK`;
msg.topic = "rapor-satiri";

return msg;