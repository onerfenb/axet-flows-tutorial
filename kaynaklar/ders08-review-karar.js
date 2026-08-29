// Reviewer ciktisini oku ve karari msg'ye yaz.
// switch dugumu bundan sonra sadece msg.karar alanina bakar.

const r = msg.payload;           // outputSchema sayesinde nesne
const ENUST_TUR = 2;             // duzeltme turu ust siniri

msg.onay = r.onay === true;
msg.bulgular = r.bulgular || [];
msg.ozet = r.ozet || "";

if (msg.onay) {
  msg.karar = "gelistir";
  node.status({ fill: "green", shape: "dot", text: `onaylandi (tur ${msg.tur})` });
} else if (msg.tur < ENUST_TUR) {
  msg.karar = "duzelt";
  node.status({ fill: "yellow", shape: "ring",
                text: `duzeltme (${msg.bulgular.length} bulgu)` });
} else {
  msg.karar = "mudahale";
  node.status({ fill: "red", shape: "dot", text: "tur hakki bitti" });
}

return msg;
