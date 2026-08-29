// Uc dokuman join dugumunde tek metne birlestirildi.
// Ajana gonderilen sey msg.payload'daki METINDIR.

const belgeler = msg.payload;

msg.tur = 0;              // TS duzeltme turu sayaci -- msg uzerinde tasinir
msg.belgeler = belgeler;  // sonraki adimlar icin sakla

msg.payload = `Asagida bir SAP gelistirme talebine ait toplanti notlari ve
mevcut durum belgesi var.

Bunlardan bir FONKSIYONEL SARTNAME (FS) uret. Kurallar:

1. Sadece belgelerde YAZAN bilgiyi kullan. Uydurma.
2. Celiskili konusulmus bir konu varsa, son toplantidaki karari esas al.
3. Belirsiz kalan konulari "Acik Sorular" basligi altinda ayri listele.
4. KISA TUT: en fazla 120 satir. Gereksiz tekrar yapma.
5. Ciktiyi Markdown olarak ver. Baslik yapisi:
   # Fonksiyonel Sartname
   ## 1. Amac
   ## 2. Kapsam
   ## 3. Is Kurallari
   ## 4. Cikti ve Formatlar
   ## 5. Acik Sorular

BELGELER:
---
${belgeler}
---`;

node.status({ fill: "blue", shape: "dot", text: "FS uretiliyor..." });
return msg;
