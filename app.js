// HTML'deki yeni elemanları seçiyoruz
const kurFormu = document.getElementById('kurFormu');
const yilInput = document.getElementById('yilInput');
const ayInput = document.getElementById('ayInput');
const sonucText = document.getElementById('sonucText');

// Ayları ve Yılları dolduracak fonksiyonlar
function yillariDoldur() {
    const simdikiYil = new Date().getFullYear();
    // 2010'dan başlayarak günümüz yılına kadar seçenekleri ekle
    for (let yil = simdikiYil; yil >= 2010; yil--) {
        const option = document.createElement('option');
        option.value = yil;
        option.textContent = yil;
        yilInput.appendChild(option);
    }
}

function aylariDoldur() {
    const aylar = [
        { value: '01', name: 'Ocak' }, { value: '02', name: 'Şubat' },
        { value: '03', name: 'Mart' }, { value: '04', name: 'Nisan' },
        { value: '05', name: 'Mayıs' }, { value: '06', name: 'Haziran' },
        { value: '07', name: 'Temmuz' }, { value: '08', name: 'Ağustos' },
        { value: '09', name: 'Eylül' }, { value: '10', name: 'Ekim' },
        { value: '11', name: 'Kasım' }, { value: '12', name: 'Aralık' }
    ];
    aylar.forEach(ay => {
        const option = document.createElement('option');
        option.value = ay.value;
        option.textContent = ay.name;
        ayInput.appendChild(option);
    });
}

// Sayfa yüklendiğinde açılır menüleri doldur
document.addEventListener('DOMContentLoaded', () => {
    yillariDoldur();
    aylariDoldur();
});

// Form gönderildiğinde çalışacak ana fonksiyon
kurFormu.addEventListener('submit', async (event) => {
    event.preventDefault(); // Sayfanın yenilenmesini engelle

    const secilenYil = yilInput.value;
    const secilenAy = ayInput.value;

    // Yıl ve Ay'ı birleştirip "YYYY-AA" formatını oluştur
    const secilenTarih = `${secilenYil}-${secilenAy}`;
    
    sonucText.textContent = 'Veri getiriliyor, lütfen bekleyin...';

    try {
        const response = await fetch(`/get-rate?date=${secilenTarih}`);
        const data = await response.json();

        if (response.ok) {
            sonucText.textContent = `${data.date} tarihindeki gram altın fiyatı: ${data.rate} TL`;
        } else {
            sonucText.textContent = `Hata: ${data.error}`;
        }
    } catch (error) {
        console.error('Fetch hatası:', error);
        sonucText.textContent = 'Sunucuya bağlanırken bir hata oluştu.';
    }
});