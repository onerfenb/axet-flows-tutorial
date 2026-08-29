# Insan mudahalesi gerekli

Zincir 2 turda onay alamadi.

## Reviewer ozeti
Teknik sartname yapısal olarak iyi organize edilmiş olsa da, geliştirmeyi engelleyecek beş kritik boşluk mevcuttur: (1) Job tetikleme yöntemi ikilenmiş durumda, (2) BAdI interface tamamen detaysız, (3) WEMNG alanı tanımsız ve hesaplama yöntemi belirsiz, (4) performans hedefini sağlayacak sorgu stratejisi gösterilmemiş, (5) Excel teknolojisi eski/muğlak. Bu eksikliklerin giderilmesi olmadan geliştirici net bir şekilde kod yazamayacak ve ön inceleme döneminde taslak kabul edilemez.

## Kalan bulgular
- [yuksek] E-posta gönderimi için Job tetikleme yöntemi (SM36 vs BTP Scheduler) belirlenmemiştir. Teknik sartnamede 'RSBTCO (SM36) veya BTP Scheduler' yazılı olup, hangisinin kullanılacağı açık değildir. Üretim ortamında job tanımlanması için kesin karar gerekir.
- [yuksek] BAdI implementasyonu (ZMM_BADI_STOCK_RECIPIENT) detaylı olarak tanımlanmamıştır. BAdI interface'inin import/export parametreleri, default implementation için role tabanlı filtre logic'i, ve DL_LOGISTICS grubu tanımlaması eksiktir. Geliştirici bu interface'i nasıl kodlayacağını net olarak bilemez.
- [yuksek] WEMNG (stok dışlama) alanı MARD tablosunda bulunmamaktadır. Teknik sartnamede 'NETTO_STOK = LABST - WEMNG' hesaplaması tanımlanmış ancak hangi tablodan okunacağı veya nasıl hesaplanacağı belirtilmemiştir. Kod yazılırken çıkmazda kalınacaktır.
- [yuksek] Z_FM_STOCK_CHECK fonksiyonunun LEFT JOIN sırası ve performans optimizasyonu belirtilmemiştir. 200 kalem × 6 tablo JOIN'inde <30 saniye gereklililiği sağlanabilir mi? Index stratejisi, aggregate join kütüğü veya grup sorgusu (GROUP BY) kullanımı açıklanmalıdır.
- [orta] Excel çıktısı oluşturma yöntemi (OLE vs XLSX library vs CDS view export) belirsiz bırakılmıştır. 'OLE/LibreOffice' yazılı olup metin eski teknolojidir. S/4HANA 2023'te standart yöntem netleştirilmelidir.

Son teknik sartname: /internal-storage-files/cikti/02-TS-tur2.md