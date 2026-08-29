// Her tur ayri dosyaya yazilir: 02-TS-tur1.md, 02-TS-tur2.md ...
// Boylece "ikinci turda ne degisti?" sorusu somut olarak cevaplanabilir.

msg.tsMetni = msg.payload.response || msg.payload;
msg.payload = msg.tsMetni;
msg.filename = `/data/cikti/02-TS-tur${msg.tur}.md`;

node.status({ fill: "green", shape: "dot", text: `TS tur ${msg.tur} yazildi` });
return msg;
