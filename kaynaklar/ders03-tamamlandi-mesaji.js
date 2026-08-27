msg.topic = "TAMAMLANDI";
msg.payload = {
    durum: "tamamlandi",
    baslik: msg.payload.title,
    kayitNo: msg.payload.id
};
return msg;