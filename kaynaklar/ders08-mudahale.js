// Ust sinira ulasildi: zincir kendini toparlayamadi.
// Ders 7'nin "vazgec" dali ile ayni felsefe -- sessizce durma, iz birak.

const satirlar = [
  "# Insan mudahalesi gerekli",
  "",
  `Zincir ${msg.tur} turda onay alamadi.`,
  "",
  "## Reviewer ozeti",
  msg.ozet || "(ozet yok)",
  "",
  "## Kalan bulgular",
  ...(msg.bulgular || []).map(b => `- [${b.onem || "orta"}] ${b.madde}`),
  "",
  `Son teknik sartname: /data/cikti/02-TS-tur${msg.tur}.md`
];

msg.payload = satirlar.join("\n");
msg.filename = "/data/cikti/MUDAHALE-GEREKLI.md";

node.warn(["ZINCIR ONAY ALAMADI", msg.ozet]);
return msg;
