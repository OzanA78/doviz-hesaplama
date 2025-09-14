document.addEventListener('DOMContentLoaded', () => {
    // Set dynamic height for mobile browsers
    const setAppHeight = () => {
        const doc = document.documentElement;
        doc.style.setProperty('--app-height', `${window.innerHeight}px`);
    };
    window.addEventListener('resize', setAppHeight);
    setAppHeight();

    // HTML Elementleri
    const tableBody = document.getElementById('calculation-table-body');
    const totalAmountEl = document.getElementById('total-amount');
    const totalCurrentValueEl = document.getElementById('total-current-value');
    const totalCurrentValueLabelEl = document.getElementById('total-current-value-label');
    const totalsContainer = document.getElementById('totals-container');
    const deviceIndicatorEl = document.querySelector('.device-indicator');
    const mainContainer = document.querySelector('.container.table-view');

    // Cihaz tipini ayarla
    let isMobile = window.innerWidth <= 768;
    deviceIndicatorEl.textContent = isMobile ? '(Mobil)' : '(Web)';

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

    function addNewRow(previousData = null, existingData = null) {
        const newRow = document.createElement('tr');
        
        const years = [...new Set(historicalData.map(item => item.date.substring(0, 4)))].sort((a, b) => b - a);
        
        let nextDate = { year: '', month: '' };
        if (previousData && previousData.date) {
            const date = new Date(`${previousData.date.year}-${previousData.date.month}-01`);
            date.setMonth(date.getMonth() + 1);
            nextDate.year = date.getFullYear().toString();
            nextDate.month = ('0' + (date.getMonth() + 1)).slice(-2);
        }

        const selectedYear = existingData ? existingData.year : nextDate.year;
        const selectedMonth = existingData ? existingData.month : nextDate.month;

        // Mobil için Yıl/Ay'ı tek hücrede birleştir
        if (isMobile) {
            newRow.innerHTML = `
                <td class="year-cell">
                    <select class="year-select">
                        <option value="">Yıl</option>
                        ${years.map(y => `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>${y}</option>`).join('')}
                    </select>
                </td>
                <td class="month-cell">
                    <select class="month-select">
                        <option value="">Ay</option>
                        ${months.map(m => `<option value="${m.value}" ${m.value === selectedMonth ? 'selected' : ''}>${m.name}</option>`).join('')}
                    </select>
                    <div class="rate-info-container">
                        <span class="rate-info">-</span>
                    </div>
                </td>
                <td class="amount-cell">
                    <div class="mobile-amount-wrapper">
                        <input type="tel" class="amount-input" placeholder="0" inputmode="numeric" maxlength="10">
                    </div>
                    <div class="sub-values-container">
                        <span class="sub-value gold-amount-sub-value">-</span>
                        <span class="sub-value current-value-sub-value">-</span>
                    </div>
                </td>
            `;
        } else {
            newRow.innerHTML = `
                <td>
                    <select class="year-select">
                        <option value="">Yıl</option>
                        ${years.map(y => `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>${y}</option>`).join('')}
                    </select>
                </td>
                <td>
                    <select class="month-select">
                        <option value="">Ay</option>
                        ${months.map(m => `<option value="${m.value}" ${m.value === selectedMonth ? 'selected' : ''}>${m.name}</option>`).join('')}
                    </select>
                    <div class="rate-info-container">
                        <span class="rate-info">-</span>
                    </div>
                </td>
                <td class="amount-cell">
                    <input type="tel" class="amount-input" placeholder="0" inputmode="numeric" maxlength="10">
                    <div class="sub-values-container">
                        <span class="sub-value gold-amount-sub-value">-</span>
                        <span class="sub-value current-value-sub-value">-</span>
                    </div>
                </td>
            `;
        }

        const amountInput = newRow.querySelector('.amount-input');
        if (existingData && existingData.amount) {
            const formattedAmount = parseInt(existingData.amount, 10).toLocaleString('en-US');
            amountInput.value = formattedAmount;
        } else if (previousData && previousData.amount) {
            const formattedAmount = previousData.amount.toLocaleString('en-US');
            amountInput.value = formattedAmount;
        }

        tableBody.appendChild(newRow);
        attachEventListeners(newRow);

        if ((selectedYear && selectedMonth) || (amountInput.value && amountInput.value !== '0')) {
            updateRow(newRow);
        }
        
        if (!existingData) {
            amountInput.focus();
            totalsContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }

    function updateRow(row) {
        const year = row.querySelector('.year-select').value;
        const month = row.querySelector('.month-select').value;
        const amountInput = row.querySelector('.amount-input');
        
        const rawAmount = amountInput.value.replace(/[^\d]/g, '');
        const amount = parseFloat(rawAmount) || 0;

        // Alt değerleri seç (hem mobil hem web için)
        const goldAmountSubValue = row.querySelector('.gold-amount-sub-value');
        const currentValueSubValue = row.querySelector('.current-value-sub-value');
        const rateInfo = row.querySelector('.rate-info');

        if (year && month) {
            const targetDate = `${year}-${month}`;
            const dateData = historicalData.find(d => d.date.startsWith(targetDate));
            
            if (dateData) {
                const historicalPrice = dateData.price;
                
                // Ay altında kur bilgisi
                rateInfo.textContent = `Kur: ${formatCurrency(historicalPrice, 'TRY', 0)}`;

                if (amount > 0) {
                    const goldAmount = amount / historicalPrice;
                    const currentValue = goldAmount * currentGoldPrice;
                    
                    // Sol alt: Altın miktarı (altın renginde)
                    goldAmountSubValue.textContent = `${goldAmount.toFixed(1)} gr`;
                    
                    // Sağ alt: Güncel değer + güncel kur
                    currentValueSubValue.textContent = `${formatCurrency(currentValue, 'TRY', 0)} (Güncel Kur: ${formatCurrency(currentGoldPrice, 'TRY', 0)})`;
                } else {
                    goldAmountSubValue.textContent = '-';
                    currentValueSubValue.textContent = '-';
                }
            } else {
                rateInfo.textContent = 'Veri Yok';
                goldAmountSubValue.textContent = 'Veri Yok';
                currentValueSubValue.textContent = '-';
            }
        } else {
            rateInfo.textContent = '-';
            goldAmountSubValue.textContent = '-';
            currentValueSubValue.textContent = '-';
            if(isMobile) {
                goldAmountSubValue.textContent = '-';
                currentValueSubValue.textContent = '-';
            }
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

            // Yeni yapıda alt değerlerden bilgileri al
            const goldAmountSubValue = row.querySelector('.gold-amount-sub-value');
            const currentValueSubValue = row.querySelector('.current-value-sub-value');
            
            if (goldAmountSubValue && goldAmountSubValue.textContent !== '-' && goldAmountSubValue.textContent !== 'Veri Yok') {
                // "66.7 gr" formatından altın miktarını çıkar
                const goldText = goldAmountSubValue.textContent;
                const goldMatch = goldText.match(/([0-9,.]+)\s*gr/);
                if (goldMatch) {
                    const goldAmount = parseFloat(goldMatch[1].replace(',', '.')) || 0;
                    totalGoldAmount += goldAmount;
                }
            }
            
            if (currentValueSubValue && currentValueSubValue.textContent !== '-' && currentValueSubValue.textContent !== 'Veri Yok') {
                // "296,073 ₺ (Güncel Kur: 4,441 ₺)" formatından değeri çıkar
                const currentText = currentValueSubValue.textContent;
                const valueMatch = currentText.match(/^([₺\d,.]+)/);
                if (valueMatch) {
                    const rawCurrentValue = valueMatch[1].replace(/[^\d,]/g, '').replace(',', '.');
                    totalCurrentValue += parseFloat(rawCurrentValue) || 0;
                }
            }
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
            
            // Maksimum 8 haneye sınırla (99,999,999)
            if (rawValue.length > 8) {
                rawValue = rawValue.substring(0, 8);
            }

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
                
                if (nextRow) {
                    nextRow.querySelector('.amount-input').focus();
                } 
                else if (isLastRow) {
                    const year = row.querySelector('.year-select').value;
                    const month = row.querySelector('.month-select').value;
                    const rawAmount = amountInput.value.replace(/[^\d]/g, '');
                    const amount = parseFloat(rawAmount) || 0;
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