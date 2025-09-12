document.addEventListener('DOMContentLoaded', () => {
    // HTML elementlerine referanslar
    const yearSelect = document.getElementById('yearSelect');
    const monthSelect = document.getElementById('monthSelect');
    const amountInput = document.getElementById('amountInput');
    const calculateBtn = document.getElementById('calculateBtn');
    const resultDiv = document.getElementById('result');

    // Miktar alanına yazıldıkça sayıyı formatla
    // app.js

amountInput.addEventListener('input', (e) => {
    // 1. Girdideki sayı olmayan her şeyi (noktalar dahil) temizle
    let rawValue = e.target.value.replace(/[^\d]/g, '');

    // 2. Eğer girdi boşsa, input'u temizleyip işlemi bitir
    if (!rawValue) {
        e.target.value = '';
        return;
    }

    // 3. Değeri sayıya çevir ve sınırı uygula
    let numberValue = parseInt(rawValue, 10);
    const limit = 1000000000; // 1 Milyar sınırı

    // Girilen sayı limiti aşıyorsa, sayıya limit değerini ata
    if (numberValue > limit) {
        numberValue = limit;
    }

    // 4. Sınır kontrolünden geçmiş sayıyı Türkçe formatına göre binlik ayraçlarla formatla
    const formattedValue = numberValue.toLocaleString('tr-TR');
    
    // 5. İmlecin (cursor) gereksiz yere sona atlamasını engellemek için,
    // sadece formatlanmış değer mevcut değerden farklıysa güncelleme yap.
    if (e.target.value !== formattedValue) {
       e.target.value = formattedValue;
    }
});

    let historicalData = [];

    const months = [
        { name: 'Ocak', value: '01' }, { name: 'Şubat', value: '02' },
        { name: 'Mart', value: '03' }, { name: 'Nisan', value: '04' },
        { name: 'Mayıs', value: '05' }, { name: 'Haziran', value: '06' },
        { name: 'Temmuz', value: '07' }, { name: 'Ağustos', value: '08' },
        { name: 'Eylül', value: '09' }, { name: 'Ekim', value: '10' },
        { name: 'Kasım', value: '11' }, { name: 'Aralık', value: '12' }
    ];

    async function initializeApp() {
        try {
            // Sunucudan sıralanmış veriyi al
            const response = await fetch('/api/data');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Veri sunucudan alınamadı.');
            }
            historicalData = await response.json();

            if (historicalData.length === 0) {
                resultDiv.textContent = 'Hesaplama için veri bulunamadı.';
                calculateBtn.disabled = true; // Veri yoksa butonu devre dışı bırak
                return;
            }

            populateYears();
            // Yıl seçildiğinde ayları doldurmak için event listener ekle
            yearSelect.addEventListener('change', () => {
                const selectedYear = yearSelect.value;
                updateMonthsForYear(selectedYear);
            });
            // Başlangıçta ay listesini boş ve pasif yap
            disableMonthSelect();

        } catch (error) {
            console.error('Initialization Error:', error);
            resultDiv.textContent = 'Hata: ' + error.message;
        }
    }

    function populateYears() {
        const years = [...new Set(historicalData.map(item => item.date.substring(0, 4)))];
        years.sort((a, b) => b - a); // Yılları yeniden eskiye sırala
        
        yearSelect.innerHTML = '';
        const initialOption = document.createElement('option');
        initialOption.value = "";
        initialOption.textContent = "Yıl Seçin";
        initialOption.disabled = true; // Seçilemez yap
        initialOption.selected = true; // Varsayılan olarak görünsün
        yearSelect.appendChild(initialOption);

        years.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        });
    }

    function updateMonthsForYear(selectedYear) {
        if (!selectedYear) {
            disableMonthSelect();
            return;
        }

        // Seçilen yıla ait verileri filtrele
        const availableMonthsForYear = historicalData
            .filter(item => item.date.startsWith(selectedYear))
            .map(item => item.date.substring(5, 7)); // Sadece ay bölümünü al ('01', '02'...)

        monthSelect.innerHTML = '';
        const initialOption = document.createElement('option');
        initialOption.value = "";
        initialOption.textContent = "Ay Seçin";
        initialOption.disabled = true;
        initialOption.selected = true;
        monthSelect.appendChild(initialOption);
        
        // `months` dizisindeki aylardan, o yıl için mevcut olanları ekle
        months.forEach(month => {
            if (availableMonthsForYear.includes(month.value)) {
                const option = document.createElement('option');
                option.value = month.value;
                option.textContent = month.name;
                monthSelect.appendChild(option);
            }
        });
        monthSelect.disabled = false; // Ay seçimini aktif et
    }
    
    // Ay seçimini pasif hale getiren yardımcı fonksiyon
    function disableMonthSelect() {
        monthSelect.innerHTML = '';
        const initialOption = document.createElement('option');
        initialOption.value = "";
        initialOption.textContent = "Önce Yıl Seçin";
        monthSelect.appendChild(initialOption);
        monthSelect.disabled = true;
    }

    function performCalculation() {
        // Girdideki binlik ayraçlarını (noktaları) temizle
        const rawAmount = amountInput.value.replace(/\./g, ''); 
        const amount = parseFloat(rawAmount); // Temizlenmiş değeri sayıya çevir
        
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
        
        // Sunucu veriyi sıraladığı için son eleman her zaman en günceldir.
        const currentEntry = historicalData[historicalData.length - 1];

        if (!historicalEntry) {
            resultDiv.textContent = 'Seçtiğiniz tarih için veri bulunamadı.';
            return;
        }
        
        // En güncel verinin de varlığını kontrol et
        if (!currentEntry) {
            resultDiv.textContent = 'En güncel kur verisi alınamadı. Lütfen tekrar deneyin.';
            return;
        }

        const historicalPrice = historicalEntry.price;
        const currentPrice = currentEntry.price;
        const goldAmount = amount / historicalPrice;
        const currentValue = goldAmount * currentPrice;

        const formattedAmount = amount.toLocaleString('tr-TR');
        const selectedMonthName = months.find(m => m.value === month).name;

        const formattedCurrentValue = currentValue.toLocaleString('tr-TR', {
            style: 'currency',
            currency: 'TRY',
            maximumFractionDigits: 0
        });

        const formattedHistoricalPrice = historicalPrice.toLocaleString('tr-TR', {
            style: 'currency',
            currency: 'TRY'
        });
        
        const currentGoldPriceFormatted = currentPrice.toLocaleString('tr-TR', {
             style: 'currency',
             currency: 'TRY'
        });

        resultDiv.innerHTML = `
            <strong>${year}</strong> yılı <strong>${selectedMonthName}</strong> ayındaki <strong>${formattedAmount} ₺</strong>,
            <br>
            bugünün yaklaşık <strong>${formattedCurrentValue}</strong> değerindedir.
            <br><br>
            <small>
                <i>(Seçilen tarihteki 1 Gr Altın: ${formattedHistoricalPrice})</i>
                <br>
                <i>(Bugünkü 1 Gr Altın: ${currentGoldPriceFormatted})</i>
            </small>
        `;
    }
    
    calculateBtn.addEventListener('click', (event) => {
        event.preventDefault();
        performCalculation();
    });

    initializeApp();
});