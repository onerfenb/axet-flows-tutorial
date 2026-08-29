# Insan mudahalesi gerekli

Zincir 2 turda onay alamadi.

## Reviewer ozeti
Teknik sartname fonksiyonel sartname temelinde geliştirilmiş ve pek çok noktada iyileştirilmiştir (veri yapıları, algoritma akışı, test senaryoları net). Ancak kritik uygulama detayları eksiktir: E-posta alıcı kaynağı (Customizing vs. SU3), açık sipariş önceliklendirilmesi, fabrika takvimi FABKA parametresi, ve Excel oluşturma tekniği belirtilmemiştir. Bu boşluklar geliştirici için muğlak bırakılmış olup geliştirmeye başlanabilecek durumda değildir. Spesifik implementasyon seçimleri ve Customizing detayları açıklığa kavuşturulmalıdır.

## Kalan bulgular
- [yuksek] E-posta alıcısı tanımı eksik: 'ZMM_EMAIL_STOK_UYARI' Customizing parametresi veya SU3 değişkeni bahsedilmiş ancak teknik implementasyon (T-kod, tablo, FM) net değil. Geliştirici hangi Customizing tablosundan okuyacağını bilmeli.
- [yuksek] Açık sipariş kontrolü algoritmasında (4.2) çelişki: 'TÜFÜN KALDIR' notu yazılı ama sorgu metni tam netleşmemiş. Ek olarak: birden fazla EKPO kaydı bir MATNR/WERKS için varsa hangisi seçilecek (en erken teslim tarihi / ilk buldu)? Priorite kriteri eksik.
- [yuksek] Fabrika takvimi kontrolü (HOLIDAYS_GET): FABKA='DESA' hardcoded yazılmış ancak bu değer nereden gelecek? Sistem parametresi mi, Customizing mi, yoksa her Merkez (1000, 1200) için ayrı FABKA mı olacak tanımlanmamış.
- [orta] E-posta gönderme FM seçimi belirsiz: 'SO_NEW_DOCUMENT_ATT_SEND_API1 VEYA SEND_EMAIL_WITH_ATTACHMENT' şeklinde alternatif verilmiş. Hangisi kullanılacak, hangisinin ön koşulları (SAP posta yapılandırması vb.) var? Teknik olarak bir karar alınmalı.
- [orta] Excel dosya oluşturma mekanizması (ABAP_TO_FILE, UNI_FILENAME) bahsedilmiş ama detay eksik: SAP'ten Excel'e dönüşüm hangi FM ile yapılacak (ABAP2EXCEL, OLE automation, diğer)? Charset/encoding tanımı var mı?

Son teknik sartname: /data/cikti/02-TS-tur2.md