msg.topic = "BEKLEMEDE";
// Ayni alan adlarini kullaniyoruz ki iki dal ileride birlesebilsin
msg.payload = {
    durum:   "beklemede",
    baslik:  msg.payload.title,
    kayitNo: msg.payload.id
};
return msg;