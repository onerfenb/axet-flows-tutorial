// Reviewer'in cevabi outputSchema ile YAPILANDIRILMIS gelir:
//   { onay: boolean, bulgular: [{madde, onem}], ozet: string }
// Bu yuzden switch dugumu metin icinde arama yapmak zorunda kalmaz.

msg.tsMetni = msg.payload.response || msg.payload;

msg.payload = `Asagidaki teknik sartnameyi bir SAP kidemli gelistiricisi
gozuyle incele.

Sorulacak sorular:
- Fonksiyonel sartnamedeki her kural teknik olarak karsilanmis mi?
- Tablo ve alan secimleri dogru mu?
- Performans kisiti dikkate alinmis mi?
- Gelistirici bu belgeyle kod yazmaya baslayabilir mi?

Eksik veya hatali bir sey bulursan onay verme; bulgulari maddeler halinde yaz.
EN FAZLA 5 BULGU yaz -- sadece gelistirmeyi engelleyecek kadar onemli
olanlari. Kucuk eksikleri gormezden gel.
Belge yeterliyse onay ver.

FONKSIYONEL SARTNAME:
---
${msg.fsMetni}
---

TEKNIK SARTNAME:
---
${msg.tsMetni}
---`;

node.status({ fill: "blue", shape: "dot", text: "inceleniyor..." });
return msg;
