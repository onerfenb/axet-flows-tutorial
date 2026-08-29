// Disaridan gelen her cagri bazen basarisiz olur: servis kapalidir,
// dosya kilitlidir, kota dolmustur. Bu dugum onu taklit eder.
//
// Deneme sayaci msg uzerinde tasinir, context'te DEGIL.
// Sebep: her tetikleme kendi sayacini tasimali. flow.set() kullansak
// bir onceki tetiklemenin sayaci yenisine sizardi.

msg.deneme = (msg.deneme || 0) + 1;

// Ilk iki deneme kasitli olarak patlar, ucuncusu gecer.
// Gercek hayatta bu kosul yerine bir API cagrisi olur.
const gecmesiGerekenDeneme = 3;

if (msg.deneme < gecmesiGerekenDeneme) {
  // node.status(): dugumun altindaki kucuk rozet. Sadece gorseldir,
  // akisa mesaj GONDERMEZ. status dugumu bunu yakalar.
  node.status({ fill: "red", shape: "ring", text: `deneme ${msg.deneme} basarisiz` });

  // KRITIK FARK:
  //   throw new Error(...)  -> akis durur, catch dugumu yakalar
  //   node.error(metin)     -> sadece log'a yazar, catch YAKALAMAZ
  //   node.error(metin, msg) -> catch YAKALAR (msg parametresi sart)
  //
  // Ikinci parametreyi unutmak en sik yapilan hatadir.
  node.error(`Servis yanit vermedi (deneme ${msg.deneme})`, msg);
  return null; // mesaji burada durdur; catch dali devrali
}

node.status({ fill: "green", shape: "dot", text: `deneme ${msg.deneme} OK` });

msg.payload = {
  sonuc: "islem tamamlandi",
  kacinciDenemede: msg.deneme
};

return msg;
