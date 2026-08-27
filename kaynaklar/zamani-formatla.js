// Gelen zaman damgasini okunabilir parcalara ayir
const gelenZamanDamgasi = msg.payload;
const tarih = new Date(gelenZamanDamgasi);

// Etiket: debug panelinde mesajlari ayirt etmeye yarar
msg.topic = "akis-testi";

// Payload'i nesne olarak yeniden yaz.
// Nesne sectik ki sonraki dugumler tek alana erisebilsin:
//   msg.payload.saat  ->  "15:06:20"
msg.payload = {
    mesaj: "aXet.flows akisi calisti",
    tarih: tarih.toLocaleDateString("tr-TR"),
    gun:   tarih.toLocaleDateString("tr-TR", { weekday: "long" }),   // Alistirma 1
    saat:  tarih.toLocaleTimeString("tr-TR"),
    hamDamga: gelenZamanDamgasi
};

return msg;