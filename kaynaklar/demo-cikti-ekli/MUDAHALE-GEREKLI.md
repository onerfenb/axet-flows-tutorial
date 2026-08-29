# Insan mudahalesi gerekli

Zincir 2 turda onay alamadi.

## Reviewer ozeti
Teknik sartname genel yapı ve veri akışı açısından sağlam olmakla birlikte, beş kritik noktada belirsizlik ve risk taşıyor: (1) Excel eki içeriğine dair AQ-05 hala 'optional' durumdadır ve kod davranışı FS beklentisi ile uyuşmayabilir, (2) aktif sipariş filtrelemesinde ESTAT kontrolü eksik olup tamamlanan/iptal siparişler de eklenebilir, (3) kritik malzeme Z-tablo import senkronizasyonu ve runtime update senaryoları undefined, (4) tatil takvimi tanımı işletme politikasına bağlı olup senaryo kapsam dışında, (5) gecikmiş PO tespitinde saat/time-zone dimensyonu eksik. Bu sorunlar çözüldüğü ve FS açık sorularının kesinleştiği sürece geliştirmeye başlanması önerilmez.

## Kalan bulgular
- [yuksek] AQ-05 (Excel eki İZLE satırları): Teknik sartnamede 'default: Main tab (K+U) XLSX, İZLE optional' yazılı ancak fonksiyonel sartnamede açık bir karar yok. F_SEND_EMAIL fonksiyonunda hangi sekmenin ekli gönderileceği kod seviyesinde ambiguous kalıyor. Geliştirici hangi davranışı implement etse de fonksiyonel talep ile uyuşmazlık riski yüksek.
- [yuksek] Açık Sipariş Mantığında (3.3, 4.1): EKPO seçim kriteri 'loekz <> "X"' yazılı ancak fonksiyonel sartnamede (3.3) 'aktif satınalma siparişi' tanımı net değil. EKET.EINDT kontrolüne rağmen EKPO.ESTAT (siparişin genel statüsü, ör. 'B'=iptal, 'C'=tamamlandı) check edilmemiş. Tamamlanan siparişler de sorguya dahil olabilir.
- [yuksek] Kritik Malzeme Listesi Veri Tutarlılığı: 2.2'de 'Z-tablo öncelikli kullanılacak' kararı verilmiş ve 'haftalık manual veya API' import belirtilmiş ancak import sırasında ve runtime'da list güncellemesi senkronizasyon problemi tanımlanmamış. Rapor çalışırken Z-tablo güncellenirse ne olur spesifiye edilmemiş (dirty read riski).
- [orta] Tatil Takvimi Kontrolü (AQ-04): ZMM_F_CHECK_WORKDAY fonksiyonunda TFACD.HOLIDAY sadece 'X' check edilmiş ancak fabrika takvimi tanımında 'normal iş günü' varsayımı yer almıyor. İşletmenin tatil tanımı (cumartesi=tatil mi?) veya özel çalışma günleri (cumartesi shift) senaryosu kapsam dışında bırakılmış.
- [orta] Gecikmiş PO Notu Detayı: 3.3'te 'Gecikmiş Sipariş' notu gösterilir denmesi ancak 3.2 (EKET.EINDT) ile 4.1'deki 'EINDT < sy-datum' karşılaştırması saat bileşeni içermiyor. Gün başında ve gün sonunda çalıştırıldığında farklı sonuçlar verebilir; time-zone handling belirtilmemiş.

Son teknik sartname: /internal-storage-files/cikti/02-TS-tur2.md