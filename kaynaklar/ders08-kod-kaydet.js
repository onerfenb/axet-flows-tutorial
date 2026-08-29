const kod = msg.payload.response || msg.payload;

msg.payload = kod;
msg.filename = "/data/cikti/03-kod.abap";

node.status({ fill: "green", shape: "dot", text: `kod yazildi (tur ${msg.tur})` });
return msg;
