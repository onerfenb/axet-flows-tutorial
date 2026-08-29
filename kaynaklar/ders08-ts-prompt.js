// Bu dugum iki yoldan gecilir:
//   1. Ilk gelis  -> FS'ten gelir, msg.tur = 0
//   2. Geri donus -> Reviewer'dan gelir, msg.tur artmistir ve
//                    msg.bulgular doludur
//
// Ders 7'deki retry dongusunun aynisi: sayac msg uzerinde, ust sinir var.

msg.tur = (msg.tur || 0) + 1;

const NL = String.fromCharCode(10);   // kacis sorunu yasamamak icin
const fs = msg.fsMetni;
const oncekiTs = msg.tsMetni || "";
const bulgular = msg.bulgular || [];

let duzeltmeBolumu = "";
if (bulgular.length > 0) {
  const liste = bulgular
    .map(b => "- [" + (b.onem || "orta") + "] " + b.madde)
    .join(NL);

  // ONEMLI: onceki TS'in TAMAMINI geri gondermiyoruz.
  // Ilk denemede gonderdik ve platform gecidi zaman asimina ugradi
  // (OriginTimeout). Sadece bolum basliklarini gonderiyoruz; yapi
  // korunuyor ama girdi kucuk kaliyor.
  const basliklar = oncekiTs
    .split(NL)
    .filter(l => l.charAt(0) === "#")
    .join(NL);

  duzeltmeBolumu = [
    "",
    "BU BIR DUZELTME TURU (tur " + msg.tur + ").",
    "Asagidaki bulgulari giderecek sekilde belgeyi YENIDEN uret.",
    "",
    "BULGULAR:",
    liste,
    "",
    "ONCEKI BELGENIN YAPISI (sadece basliklar -- bu yapiyi koru):",
    "---",
    basliklar,
    "---",
    ""
  ].join(NL);
}

msg.payload = [
  "Asagidaki fonksiyonel sartnameden bir TEKNIK SARTNAME (TS) uret.",
  duzeltmeBolumu,
  "Kurallar:",
  "",
  "1. ABAP / SAP S4HANA hedefle.",
  "2. Kullanilacak tablolari ve alanlari acikca yaz.",
  "3. Program adi, tablo tipi, yapi adlarini naming convention'a uydur.",
  "4. Performans kisitini goz ardi etme.",
  "5. KISA TUT: en fazla 180 satir. Uzun belge uretme -- platform gecidi",
  "   uzun cevaplarda zaman asimina ugruyor.",
  "6. Ciktiyi Markdown olarak ver. Baslik yapisi:",
  "   # Teknik Sartname",
  "   ## 1. Genel Bakis",
  "   ## 2. Veri Kaynaklari",
  "   ## 3. Program Yapisi",
  "   ## 4. Algoritma",
  "   ## 5. Yetki ve Zamanlama",
  "   ## 6. Test Senaryolari",
  "",
  "FONKSIYONEL SARTNAME:",
  "---",
  fs,
  "---"
].join(NL);

node.status({ fill: "blue", shape: "dot", text: "TS uretiliyor (tur " + msg.tur + ")" });
return msg;
