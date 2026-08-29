# Insan mudahalesi gerekli

Zincir 2 turda onay alamadi.

## Reviewer ozeti
Teknik sartname genel yapı olarak uygun olmakla birlikte, kritikal geliştirmeyi engelleyen beş önemli sorun mevcuttur. En ciddi sorun, açık siparis filtresi mantığının FS ve TS arasında çelişkili olmasıdır; KRİTİK ve UYARI durumlarında ELIKZ alanının kontrolü eksiktir ve gecikmiş sipariş kuralı muğlaktır. Kolon listesi FS'de hala bekleme durumundadır ve 'asgari' 7 kolon tanımı yetersizdir. Kritik malzeme listesi tablosunun ilk doldurulması ve güncellemesi süreçleri resmiyet kazanmamıştır. Veri yapılarında DEFAULT VALUE hatalı başlangıç değerine neden olabilir. E-posta gönderim hatalarına karşı error handling stratejisi tanımlanmamıştır. Geliştirici bu belirsizlikleri netleştirmeden koda başlayamaz.

## Kalan bulgular
- [yuksek] Açik siparis mantığında çelişki: FS'de 'açik satinalma siparişi olan malzemeler uyarıya girmez' deniliyor, ancak TS'de gecikmiş sipariş durumunda 'uyarıya girer' deniyor. Hangi koşulda tam olarak uyarıya girecek/girmeyecek net değil. Algoritma 4.1 adım 4'te ELIKZ kontrol edilmiyor (sadece EINDT kontrol ediliyor). Geliştirici bu belirsizliği sonradan sormak zorunda kalacak.
- [yuksek] FS'de kolon listesi 'Zeynep tarafından iletilecek' olarak açık sorular #1'de belirtiliyor ve 'henüz alınmadı' durumuyla kalmış. TS'de 'asgari 7 kolon sabitlendi' deniyor ama tam liste FS referansında hala eksik. Geliştirici hangi sütunları ALV/Excel'e ekleyeceği konusunda tam olmayan bilgiye sahip.
- [yuksek] Kritik malzeme listesi dinamik olarak ZMM_T_KRITMAT'tan okunacak ancak bu tablonun ilk doldurulması sorumluluğu belirsiz. MM ekibinin 'haftalık veya malzeme değişim anında' güncellemesi gerektiği yazılı ama netleştirilmemiş. Tablo boş olursa program stop edecek (adım 1), bu da production riski.
- [orta] TS'de veri yapılarındaki `status` alanı `ty_kritmat`'te DEFAULT VALUE 'K' (KRİTİK) olarak tanımlanmış ancak algoritma 4.1'de tüm malzemelere sınıflandırma uygulanıyor. Bu, başlangıç değerinin hatalı sonuç vermesine neden olabilir. Başlangıç değeri olmamalı veya algoritma clarify edilmeli.
- [orta] TS'de E-posta gönderim başarısızlığı senaryosu (Test #5: 'Rapor çıktı, e-posta gönderilmez + log uyarı') net olarak kodlanmamış. Hata yakalama (TRY-CATCH), retry mekanizması, veya hata log tablosu tanımlanmadı. Ek olarak SO_NEW_DOCUMENT_ATT_SEND_API1 çağrısında attachment imlementation detayları eksik.

Son teknik sartname: /data/cikti/02-TS-tur2.md