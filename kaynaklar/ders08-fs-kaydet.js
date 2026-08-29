// Ajan cevabi { response: "..." } yapisinda gelir (outputSchema yoksa).
// Metni hem dosyaya yazmak hem sonraki adimlara tasimak icin ayiriyoruz.

msg.fsMetni = msg.payload.response || msg.payload;
msg.payload = msg.fsMetni;   // file dugumu METIN bekler
msg.filename = "/internal-storage-files/cikti/01-FS.md";

node.status({ fill: "green", shape: "dot", text: "FS yazildi" });
return msg;
