// Ortamin calistigini kanitlayan en kucuk akis.
// Ders 1 (kurulum) burada somutlasiyor: bu akis cikti
// uretiyorsa WSL + Docker + tasarimci zinciri saglamdir.
//
// NOT: function dugumu bir guvenlik sandbox'inda calisir.
// process, require, fs gibi Node.js ic yapilari KAPALIDIR.
// (Denerseniz: "ReferenceError: process is not defined")
// Ortam bilgisine env.get() ile ulasilir.

const simdi = new Date();

// Sayac: kurulumu kac kez dogruladigimiz
let kontrolSayisi = flow.get("kontrolSayisi") || 0;
kontrolSayisi = kontrolSayisi + 1;
flow.set("kontrolSayisi", kontrolSayisi);

msg.topic = "KURULUM-OK";
msg.payload = {
    kontrol:      "aXet.flows ortam dogrulama",
    sonuc:        "BASARILI - akis motoru calisiyor",
    zaman:        simdi.toLocaleString("tr-TR"),
    kontrolNo:    kontrolSayisi,
    // env.get ile ortam degiskeni okunur (varsa)
    calismaModu:  env.get("NODE_ENV") || "belirtilmemis"
};

// node.warn debug paneline sari uyari olarak duser
node.warn("Kurulum dogrulama #" + kontrolSayisi + " tamamlandi");

return msg;