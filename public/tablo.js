document.addEventListener('DOMContentLoaded', () => {
    // HTML Elementleri
    const tableBody = document.getElementById('calculation-table-body');
    const totalAmountEl = document.getElementById('total-amount');
    const totalCurrentValueEl = document.getElementById('total-current-value');
    const totalCurrentValueLabelEl = document.getElementById('total-current-value-label');
    const totalsContainer = document.getElementById('totals-container');

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

    async function initializeApp() {
        try {
            const response = await fetch('/api/data');
            if (!response.ok) throw new Error('Veri sunucudan alınamadı.');
            
            historicalData = await response.json();
            if (historicalData.length === 0) return;

            currentGoldPrice = historicalData[historicalData.length - 1].price;
            addNewRow();
        } catch (error) {
            console.error('Initialization Error:', error);
            alert('Hata: Veri yüklenemedi. Lütfen sayfayı yenileyin.');
        }
    }

    function addNewRow(previousData = null) {
        const newRow = document.createElement('tr');
        
        const years = [...new Set(historicalData.map(item => item.date.substring(0, 4)))].sort((a, b) => b - a);
        
        let nextDate = { year: '', month: '' };
        if (previousData && previousData.date) {
            const date = new Date(`${previousData.date.year}-${previousData.date.month}-01`);
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
            <td class="gold-amount-cell">-</td>
            <td class="current-value-cell">-</td>
        `;

        const amountInput = newRow.querySelector('.amount-input');
        if (previousData && previousData.amount) {
            const formattedAmount = previousData.amount.toLocaleString('en-US');
            amountInput.value = formattedAmount;
        }

        tableBody.appendChild(newRow);
        attachEventListeners(newRow);

        if (nextDate.year && nextDate.month) {
            updateRow(newRow);
        }
        
        amountInput.focus();
        
        // Yeni satır eklendiğinde en aşağıya scroll et
        totalsContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    function updateRow(row) {
        const year = row.querySelector('.year-select').value;
        const month = row.querySelector('.month-select').value;
        const amountInput = row.querySelector('.amount-input');
        
        const rawAmount = amountInput.value.replace(/[^\d]/g, '');
        const amount = parseFloat(rawAmount) || 0;

        const rateCell = row.querySelector('.rate-cell');
        const goldAmountCell = row.querySelector('.gold-amount-cell');
        const currentValueCell = row.querySelector('.current-value-cell');

        if (year && month) {
            const targetDate = `${year}-${month}`;
            const dateData = historicalData.find(d => d.date.startsWith(targetDate));
            
            if (dateData) {
                const historicalPrice = dateData.price;
                rateCell.textContent = formatCurrency(historicalPrice, 'TRY');

                if (amount > 0) {
                    const goldAmount = amount / historicalPrice;
                    const currentValue = goldAmount * currentGoldPrice;
                    
                    goldAmountCell.textContent = `${goldAmount.toFixed(1)} gr`;
                    currentValueCell.textContent = formatCurrency(currentValue, 'TRY', 0);
                } else {
                    goldAmountCell.textContent = '-';
                    currentValueCell.textContent = '-';
                }
            } else {
                rateCell.textContent = 'Veri Yok';
                goldAmountCell.textContent = '-';
                currentValueCell.textContent = '-';
            }
        } else {
            rateCell.textContent = '-';
            goldAmountCell.textContent = '-';
            currentValueCell.textContent = '-';
        }

        updateTotals();
    }

    function updateTotals() {
        let totalAmount = 0;
        let totalGoldAmount = 0;
        let totalCurrentValue = 0;

        const rows = tableBody.querySelectorAll('tr');
        rows.forEach(row => {
            const rawAmount = row.querySelector('.amount-input').value.replace(/[^\d]/g, '');
            const amount = parseFloat(rawAmount) || 0;
            totalAmount += amount;

            const rateText = row.querySelector('.rate-cell').textContent;
            if (amount > 0 && rateText !== '-' && rateText !== 'Veri Yok') {
                const rawRate = rateText.replace(/[^\d,]/g, '').replace(',', '.');
                const rate = parseFloat(rawRate) || 0;
                if(rate > 0) {
                    totalGoldAmount += (amount / rate);
                }
            }
            
            const currentValueText = row.querySelector('.current-value-cell').textContent;
            const rawCurrentValue = currentValueText.replace(/[^\d,]/g, '').replace(',', '.');
            totalCurrentValue += parseFloat(rawCurrentValue) || 0;
        });

        const totalGoldAmountEl = document.getElementById('total-gold-amount');
        totalGoldAmountEl.textContent = `${totalGoldAmount.toFixed(1)} gr`;
        totalAmountEl.textContent = totalAmount.toLocaleString('tr-TR', {style: 'currency', currency: 'TRY', maximumFractionDigits: 0});
        
        totalCurrentValueLabelEl.innerHTML = `Bugünün Parası ile:`;
        totalCurrentValueEl.textContent = totalCurrentValue.toLocaleString('tr-TR', {style: 'currency', currency: 'TRY', maximumFractionDigits: 0});
    }

    function attachEventListeners(row) {
        row.querySelector('.year-select').addEventListener('change', () => updateRow(row));
        row.querySelector('.month-select').addEventListener('change', () => updateRow(row));
        
        const amountInput = row.querySelector('.amount-input');
        
        amountInput.addEventListener('focus', (e) => {
            e.target.select();
        });

        amountInput.addEventListener('input', (e) => {
            let rawValue = e.target.value.replace(/[^\d]/g, '');
            if (rawValue) {
                const formattedValue = parseInt(rawValue, 10).toLocaleString('en-US');
                if (e.target.value !== formattedValue) {
                    e.target.value = formattedValue;
                }
            } else {
                e.target.value = '';
            }
            updateRow(row);
        });

        amountInput.addEventListener('keydown', (e) => {
            const isLastRow = row === tableBody.lastElementChild;
            const nextRow = row.nextElementSibling;
            const prevRow = row.previousElementSibling;
            const isFirstRow = row === tableBody.firstElementChild;

            if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
                e.preventDefault();
                
                const rawAmount = amountInput.value.replace(/[^\d]/g, '');
                const amount = parseFloat(rawAmount) || 0;

                if (nextRow) {
                    const nextAmountInput = nextRow.querySelector('.amount-input');
                    if (!nextAmountInput.value) { // Eğer alt satır boşsa
                        nextAmountInput.value = amount.toLocaleString('en-US');
                        updateRow(nextRow);
                    }
                    nextAmountInput.focus();
                    nextAmountInput.select();
                } 
                else if (isLastRow) {
                    const year = row.querySelector('.year-select').value;
                    const month = row.querySelector('.month-select').value;
                    if (year && month && amount > 0) {
                        addNewRow({ date: { year, month }, amount: amount });
                    }
                }
            }

            if (e.key === 'Tab' && e.shiftKey) {
                if (isFirstRow) {
                    e.preventDefault(); // İlk satırdayken odağın dışarı çıkmasını engelle
                    return;
                }
                
                if (prevRow) {
                    e.preventDefault();
                    prevRow.querySelector('.amount-input').focus();
                }
            }
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