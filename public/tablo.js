document.addEventListener('DOMContentLoaded', () => {
    // HTML Elementleri
    const tableBody = document.getElementById('calculation-table-body');
    const totalAmountEl = document.getElementById('total-amount');
    const totalCurrentValueEl = document.getElementById('total-current-value');

    // Global Durum Değişkenleri
    let historicalData = [];
    let currentGoldPrice = 0;
    const months = [
        { name: 'Ocak', value: '01' }, { name: 'Şubat', value: '02' },
        { name: 'Mart', value: '03' }, { name: 'Nisan', value: '04' },
        { name: 'Mayıs', value: '05' }, { name: 'Haziran', value: '06' },
        { name: 'Temmuz', value: '07' }, { name: 'Ağustos', value: '08' },
        { name: 'Eylül', value: '09' }, { name: 'Ekim', value: '10' },
        { name: 'Kasım', value: '11' }, { name: 'Aralık', value: '12' }
    ];

    // --- Başlangıç Fonksiyonları ---

    async function initializeApp() {
        try {
            const response = await fetch('/api/data');
            if (!response.ok) throw new Error('Veri sunucudan alınamadı.');
            
            historicalData = await response.json();
            if (historicalData.length === 0) return;

            currentGoldPrice = historicalData[historicalData.length - 1].price;
            addNewRow(); // Başlangıçta ilk satırı ekle
        } catch (error) {
            console.error('Initialization Error:', error);
            alert('Hata: Veri yüklenemedi. Lütfen sayfayı yenileyin.');
        }
    }

    // --- Ana Fonksiyonlar ---

    function addNewRow(previousDate = null) {
        const newRow = document.createElement('tr');
        
        const years = [...new Set(historicalData.map(item => item.date.substring(0, 4)))].sort((a, b) => b - a);
        
        let nextDate = { year: '', month: '' };
        if (previousDate) {
            const date = new Date(`${previousDate.year}-${previousDate.month}-01`);
            date.setMonth(date.getMonth() + 1);
            nextDate.year = date.getFullYear().toString();
            nextDate.month = ('0' + (date.getMonth() + 1)).slice(-2);
        }

        newRow.innerHTML = `
            <td>
                <select class="year-select">
                    <option value="">Yıl</option>
                    ${years.map(y => `<option value="${y}" ${y === nextDate.year ? 'selected' : ''}>${y}</option>`).join('')}
                </select>
            </td>
            <td>
                <select class="month-select">
                    <option value="">Ay</option>
                    ${months.map(m => `<option value="${m.value}" ${m.value === nextDate.month ? 'selected' : ''}>${m.name}</option>`).join('')}
                </select>
            </td>
            <td class="rate-cell">-</td>
            <td><input type="tel" class="amount-input" placeholder="0" inputmode="numeric"></td>
            <td class="current-value-cell">-</td>
        `;

        tableBody.appendChild(newRow);
        attachEventListeners(newRow);

        // Eğer tarih önceden seçili geldiyse, kuru otomatik olarak güncelle
        if (nextDate.year && nextDate.month) {
            updateRow(newRow);
        }
        
        // Yeni satırdaki miktar alanına odaklan
        newRow.querySelector('.amount-input').focus();
    }

    function updateRow(row) {
        const year = row.querySelector('.year-select').value;
        const month = row.querySelector('.month-select').value;
        const amountInput = row.querySelector('.amount-input');
        
        const rawAmount = amountInput.value.replace(/[^\d]/g, '');
        const amount = parseFloat(rawAmount) || 0;

        const rateCell = row.querySelector('.rate-cell');
        const currentValueCell = row.querySelector('.current-value-cell');

        if (year && month) {
            const targetDate = `${year}-${month}`;
            const dateData = historicalData.find(d => d.date.startsWith(targetDate));
            
            if (dateData) {
                const historicalPrice = dateData.price;
                rateCell.textContent = formatCurrency(historicalPrice, 'TRY');

                if (amount > 0) {
                    const currentValue = (amount / historicalPrice) * currentGoldPrice;
                    currentValueCell.textContent = formatCurrency(currentValue, 'TRY', 0);
                } else {
                    currentValueCell.textContent = '-';
                }
            } else {
                rateCell.textContent = 'Veri Yok';
                currentValueCell.textContent = '-';
            }
        } else {
            rateCell.textContent = '-';
            currentValueCell.textContent = '-';
        }

        updateTotals();

        // Yeni satır ekleme koşulunu kontrol et
        const isLastRow = row === tableBody.lastElementChild;
        if (isLastRow && year && month && amount > 0) {
            addNewRow({ year, month });
        }
    }

    function updateTotals() {
        let totalAmount = 0;
        let totalCurrentValue = 0;

        const rows = tableBody.querySelectorAll('tr');
        rows.forEach(row => {
            const rawAmount = row.querySelector('.amount-input').value.replace(/[^\d]/g, '');
            totalAmount += parseFloat(rawAmount) || 0;

            const currentValueText = row.querySelector('.current-value-cell').textContent;
            const rawCurrentValue = currentValueText.replace(/[^\d]/g, '');
            totalCurrentValue += parseFloat(rawCurrentValue) || 0;
        });

        totalAmountEl.textContent = formatCurrency(totalAmount, 'TRY');
        totalCurrentValueEl.textContent = formatCurrency(totalCurrentValue, 'TRY', 0);
    }

    // --- Yardımcı Fonksiyonlar ve Event Listeners ---

    function attachEventListeners(row) {
        row.querySelector('.year-select').addEventListener('change', () => updateRow(row));
        row.querySelector('.month-select').addEventListener('change', () => updateRow(row));
        
        const amountInput = row.querySelector('.amount-input');
        amountInput.addEventListener('input', (e) => {
            // Miktar girdisini formatla
            let rawValue = e.target.value.replace(/[^\d]/g, '');
            if (rawValue) {
                const formattedValue = parseInt(rawValue, 10).toLocaleString('tr-TR');
                if (e.target.value !== formattedValue) {
                    e.target.value = formattedValue;
                }
            }
            updateRow(row);
        });
    }

    function formatCurrency(value, currency, maximumFractionDigits = 2) {
        return value.toLocaleString('tr-TR', {
            style: 'currency',
            currency: currency,
            maximumFractionDigits: maximumFractionDigits
        });
    }

    // Uygulamayı Başlat
    initializeApp();
});