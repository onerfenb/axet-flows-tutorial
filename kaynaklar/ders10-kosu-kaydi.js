// Koşu kaydini SQL'e yazacak sorguyu hazirlar.
//
// sql-query dugumu sorguyu Mustache ile isler: '{{payload.x}}' yazarsaniz
// msg.payload.x degeriyle degistirir. Bu KOLAY ama TEHLIKELIDIR --
// parametre baglama degil, metin birlestirmedir. Kullanicidan gelen bir
// degeri dogrudan koyarsaniz SQL enjeksiyonuna acik olursunuz.
//
// Bu yuzden degerleri burada temizleyip msg.query'yi kendimiz kuruyoruz.

const s = msg.ozet || { KRITIK: 0, UYARI: 0, IZLE: 0 };

// Sayilari sayi oldugundan emin olarak gecirmek en ucuz savunma
const sayi = n => {
  const v = parseInt(n, 10);
  return Number.isFinite(v) ? v : 0;
};

// Metin icin: tek tirnaklari ikile ve uzunlugu sinirla
const metin = t => "'" + String(t || "").replace(/'/g, "''").slice(0, 200) + "'";

const g = new Date();
const iki = n => (n < 10 ? "0" : "") + n;
const tarih = g.getFullYear() + "-" + iki(g.getMonth() + 1) + "-" + iki(g.getDate())
            + " " + iki(g.getHours()) + ":" + iki(g.getMinutes());

msg.query = "INSERT INTO stok_kosu (tarih, kritik, uyari, izle, satir, kaynak) VALUES ("
  + metin(tarih) + ", "
  + sayi(s.KRITIK) + ", "
  + sayi(s.UYARI) + ", "
  + sayi(s.IZLE) + ", "
  + sayi(msg.satirSayisi) + ", "
  + metin(msg.kaynak || "elle")
  + ")";

node.status({ fill: "grey", shape: "dot", text: "kayit: " + tarih });
return msg;
