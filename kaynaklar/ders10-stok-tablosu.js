// Ders 8'de ajanlarin yazdigi sartnamenin tarif ettigi raporu uretir.
//
// Gercek hayatta bu veri SAP'tan gelir (MARD.LABST, MARC.MINBE, MAKT).
// Burada onu temsil eden sabit bir liste var; amac Excel'in
// sozlesmesini ogrenmek, SAP baglantisi kurmak degil.

const BUGUN = new Date(msg.zaman || Date.now());

const ham = [
  { kod: "M-1001", tanim: "Rulman 6204-2RS", depo: "1000", stok: 0,  min: 20, sonSiparis: "2026-08-11" },
  { kod: "M-1002", tanim: "Conta NBR 40mm",  depo: "1000", stok: 8,  min: 15, sonSiparis: "2026-08-24" },
  { kod: "M-1003", tanim: "V-Kayis A-90",    depo: "1200", stok: 18, min: 15, sonSiparis: "2026-08-02" },
  { kod: "M-1004", tanim: "Hidrolik yag 20L",depo: "1200", stok: 3,  min: 12, sonSiparis: "2026-08-27" },
  { kod: "M-1005", tanim: "Filtre elemani",  depo: "1000", stok: 62, min: 30, sonSiparis: "2026-07-19" }
];
// M-1005 bilerek bol stoklu: 62 > 30 x 1,5 = 45. Rapora GIRMEMELI.
// Filtrenin calistigini gormenin en kolay yolu, elenmesi gereken
// bir satiri veriye koymaktir.

// Sartnamedeki uc seviye:
//   KRITIK  stok = 0
//   UYARI   stok < min
//   IZLE    stok < min * 1,5
const IZLE_CARPANI = 1.5;

function seviye(stok, min) {
  if (stok === 0) return "KRITIK";
  if (stok < min) return "UYARI";
  if (stok < min * IZLE_CARPANI) return "IZLE";
  return null;   // raporda yeri yok
}

// Stil anahtarlari xlsx-populate kutuphanesinden gelir.
// Arka plan "backgroundColor" DEGIL, "fill" adini tasir --
// yanlis anahtar verdiginizde dugum net soyluyor:
//   _Style.style: 'backgroundColor' is not a valid style
const RENK = {
  KRITIK: { yazi: "9C0006", zemin: "FFC7CE" },
  UYARI:  { yazi: "9C6500", zemin: "FFEB9C" },
  IZLE:   { yazi: "006100", zemin: "C6EFCE" }
};

const satirlar = [];
const sayac = { KRITIK: 0, UYARI: 0, IZLE: 0 };

ham.forEach((m, i) => {
  const s = seviye(m.stok, m.min);
  if (!s) return;
  sayac[s]++;

  // Excel satir numarasi: 1 baslik + o ana kadar eklenen satirlar
  const satirNo = satirlar.length + 2;

  satirlar.push({
    "Malzeme": m.kod,
    "Tanim": m.tanim,
    "Depo": m.depo,
    "Stok": m.stok,
    "Minimum": m.min,

    // FORMUL: parametresiz bir fonksiyon, Ingilizce formul metni dondurur.
    // Bu yuzden tabloyu bir function dugumunde kurmak zorundasiniz --
    // JSON bir fonksiyon tasiyamaz.
    "Fark": () => "=D" + satirNo + "-E" + satirNo,

    // Hucreye stil vermek icin duz deger yerine {value, style} nesnesi
    "Durum": {
      value: s,
      style: { bold: true, fontColor: RENK[s].yazi, fill: RENK[s].zemin }
    },

    "Son siparis": {
      value: new Date(m.sonSiparis),
      style: { numberFormat: "dd.MM.yyyy" }
    }
  });
});

msg.payload = {
  data: {
    "Kritik Stok": satirlar,
    "Ozet": [
      { "Olcut": "Rapor tarihi", "Deger": { value: BUGUN, style: { numberFormat: "dd.MM.yyyy HH:mm" } } },
      { "Olcut": "Taranan malzeme", "Deger": ham.length },
      { "Olcut": "KRITIK", "Deger": sayac.KRITIK },
      { "Olcut": "UYARI",  "Deger": sayac.UYARI },
      { "Olcut": "IZLE",   "Deger": sayac.IZLE }
    ]
  }
};

msg.ozet = sayac;
msg.satirSayisi = satirlar.length;

node.status({
  fill: sayac.KRITIK > 0 ? "red" : "yellow",
  shape: "dot",
  text: satirlar.length + " satir / " + sayac.KRITIK + " kritik"
});

return msg;
