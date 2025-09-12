// app.js (YENİ HALİ)

document.addEventListener('DOMContentLoaded', () => {
    // HTML elementlerine referanslar
    const yearSelect = document.getElementById('yearSelect');
    const monthSelect = document.getElementById('monthSelect');
    const amountInput = document.getElementById('amountInput');
    const calculateBtn = document.getElementById('calculateBtn');
    const resultDiv = document.getElementById('result');

    let historicalData = [];

    const months = [
        { name: 'Ocak', value: '01' }, { name: 'Şubat', value: '02' },
        { name: 'Mart', value: '03' }, { name: 'Nisan', value: '04' },
        { name: 'Mayıs', value: '05' }, { name: 'Haziran', value: '06' },
        { name: 'Temmuz', value: '07' }, { name: 'Ağustos', value: '08' },
        { name: 'Eylül', value: '09' }, { name: 'Ekim', value: '10' },
        { name: 'Kasım', value: '11' }, { name: 'Aralık', 'value': '12' }
    ];

    async function initializeApp() {
        try {
            // DOĞRU API ADRESİ
            const response = await fetch('/api/data');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Veri sunucudan alınamadı.');
            }
            historicalData = await response.json();

            if (historicalData.length === 0) {
                resultDiv.textContent = 'Hesaplama için veri bulunamadı.';
                return;
            }

            populateYears();
            populateMonths();
        } catch (error) {
            console.error('Initialization Error:', error);
            resultDiv.textContent = 'Hata: ' + error.message;
        }
    }

    function populateYears() {
        const years = [...new Set(historicalData.map(item => item.date.substring(0, 4)))];
        years.sort((a, b) => b - a);
        
        yearSelect.innerHTML = ''; // Önceki verileri temizle
        const initialOption = document.createElement('option');
        initialOption.value = "";
        initialOption.textContent = "Yıl Seçin";
        yearSelect.appendChild(initialOption);

        years.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        });
    }

    function populateMonths() {
        monthSelect.innerHTML = ''; // Önceki verileri temizle
        const initialOption = document.createElement('option');
        initialOption.value = "";
        initialOption.textContent = "Ay Seçin";
        monthSelect.appendChild(initialOption);
        
        months.forEach(month => {
            const option = document.createElement('option');
            option.value = month.value;
            option.textContent = month.name;
            monthSelect.appendChild(option);
        });
    }

    function performCalculation() {
        const amount = parseFloat(amountInput.value);
        const year = yearSelect.value;
        const month = monthSelect.value;

        if (isNaN(amount) || amount <= 0) {
            resultDiv.textContent = 'Lütfen geçerli bir miktar girin.';
            return;
        }
        if (!year || !month) {
            resultDiv.textContent = 'Lütfen bir yıl ve ay seçin.';
            return;
        }

        const targetDate = `${year}-${month}`;
        const historicalEntry = historicalData.find(d => d.date === targetDate);
        const currentEntry = historicalData[historicalData.length - 1];

        if (!historicalEntry) {
            resultDiv.textContent = 'Seçtiğiniz tarih için veri bulunamadı.';
            return;
        }

        const historicalPrice = historicalEntry.price;
        const currentPrice = currentEntry.price;
        const goldAmount = amount / historicalPrice;
        const currentValue = goldAmount * currentPrice;

        const formattedAmount = amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 });
        const formattedCurrentValue = currentValue.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
        const selectedMonthName = months.find(m => m.value === month).name;

        resultDiv.innerHTML = `
            <strong>${year}</strong> yılı <strong>${selectedMonthName}</strong> ayındaki <strong>${formattedAmount} ₺</strong>,
            <br>
            bugünün yaklaşık <strong>${formattedCurrentValue}</strong> değerindedir.
        `;
    }
    
    // Butonun form içinde submit (gönderme) eylemini engelle ve hesaplamayı çalıştır
    calculateBtn.addEventListener('click', (event) => {
        event.preventDefault(); // Sayfanın yeniden yüklenmesini engelle
        performCalculation();
    });

    initializeApp();
});