// HTML'deki ilgili elemanları seçiyoruz.
const kurFormu = document.getElementById('kurFormu');
const tarihInput = document.getElementById('tarihInput');
const sonucText = document.getElementById('sonucText');

// Forma gönderme (submit) olayı gerçekleştiğinde bu fonksiyon çalışacak.
kurFormu.addEventListener('submit', async (event) => {
    // Formun sayfayı yenileme gibi varsayılan davranışını engelliyoruz.
    event.preventDefault();

    const secilenTarih = tarihInput.value; // Input'tan seçilen tarihi al (örn: "2025-09-11")
    
    // Eğer tarih seçilmemişse fonksiyondan çık.
    if (!secilenTarih) {
        sonucText.textContent = 'Lütfen geçerli bir tarih seçin.';
        return;
    }

    sonucText.textContent = 'Veri getiriliyor, lütfen bekleyin...';

    try {
        // Backend sunucumuza (server.js) istek atıyoruz.
        // Bu kod, verinin Excel'den mi yoksa Google Sheets'ten mi geldiğini bilmez,
        // sadece isteği yapar ve cevap bekler. Bu güzel bir şeydir.
        const response = await fetch(`/get-rate?date=${secilenTarih}`);
        
        // Sunucudan gelen cevabı JSON olarak parse ediyoruz.
        const data = await response.json();

        if (response.ok) {
            // İstek başarılıysa ve veri geldiyse, sonucu ekrana yazdırıyoruz.
            sonucText.textContent = `${data.date} tarihindeki kur: ${data.rate}`;
        } else {
            // Sunucu bir hata mesajı gönderdiyse (örn: 404), o mesajı ekrana yazdırıyoruz.
            sonucText.textContent = `Hata: ${data.error}`;
        }
    } catch (error) {
        // Sunucuya ulaşılamazsa veya bir ağ hatası olursa burası çalışır.
        console.error('Fetch hatası:', error);
        sonucText.textContent = 'Sunucuya bağlanırken bir hata oluştu. Sunucunun çalıştığından emin olun.';
    }
});