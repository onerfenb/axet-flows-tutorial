msg.payload = `Asagidaki teknik sartnameye gore ABAP kodunu yaz.

Kurallar:
1. Calisir, eksiksiz bir program yaz -- sozde kod degil.
2. Naming convention'a uy.
3. Kodu yorumla; her ana blogun ne yaptigini kisaca acikla.
4. Sadece kodu dondur, aciklama metni ekleme.

TEKNIK SARTNAME:
---
${msg.tsMetni}
---`;

node.status({ fill: "blue", shape: "dot", text: "kod yaziliyor..." });
return msg;
