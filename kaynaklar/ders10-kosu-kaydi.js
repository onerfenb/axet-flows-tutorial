// Her kosuyu tek satirlik bir JSON olarak gecmis dosyasina ekler.
//
// Neden veritabani degil: aXet'te sql-query dugumu var ve akis basina
// bir veritabani vaat ediyor, ama o veritabaninin platform tarafinda
// ACILMIS olmasi gerekiyor. Acilmamissa dugum sunu der:
//
//   No database password found for flowId: <id> in environment: dev.
//   Check Key Vault secret 'flow-context-database-sql-dev-<id>'
//
// Bu, dugum ayariyla cozulmez -- platform ekibinden istenir. Veritabani
// olmadan da kosu gecmisi tutulabilir: JSONL (her satir bir JSON).
// Sonradan veritabanina gecmek isterseniz bu dugumun yerine sql-query
// koymaniz yeter; akisin geri kalani degismez.

const s = msg.ozet || { KRITIK: 0, UYARI: 0, IZLE: 0 };

const g = new Date();
const iki = n => (n < 10 ? "0" : "") + n;
const tarih = g.getFullYear() + "-" + iki(g.getMonth() + 1) + "-" + iki(g.getDate())
            + " " + iki(g.getHours()) + ":" + iki(g.getMinutes());

// JSONL'in tek kurali var: satirda YENI SATIR OLMAYACAK.
// JSON.stringify'i girintisiz cagirmak bunu garanti eder.
msg.payload = JSON.stringify({
  tarih: tarih,
  kaynak: msg.kaynak || "elle",
  kritik: s.KRITIK,
  uyari: s.UYARI,
  izle: s.IZLE,
  satir: msg.satirSayisi || 0
});

msg.filename = "/internal-storage-files/rapor/kosu-gecmisi.jsonl";

node.status({ fill: "grey", shape: "dot", text: tarih });
return msg;
