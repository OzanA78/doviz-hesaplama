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
    const valueIncreaseInfoEl = document.getElementById('value-increase-info');
    const totalsContainer = document.getElementById('totals-container');
    const deviceIndicatorEl = document.querySelector('.device-indicator');
    const mainContainer = document.querySelector('.container.table-view');

    // Cihaz tipini ayarla
    let isMobile = window.innerWidth <= 768;

    // Global Durum Değişkenleri
    let historicalData = [];
    let currentGoldPrice = null;
    const months = [
        { name: 'Ocak', value: '01' }, { name: 'Şubat', value: '02' },
        { name: 'Mart', value: '03' }, { name: 'Nisan', value: '04' },
        { name: 'Mayıs', value: '05' }, { name: 'Haziran', value: '06' },
        { name: 'Temmuz', value: '07' }, { name: 'Ağustos', value: '08' },
        { name: 'Eylül', value: '09' }, { name: 'Ekim', value: '10' },
        { name: 'Kasım', value: '11' }, { name: 'Aralık', value: '12' }
    ];

    async function initializeApp() {
        console.log('İnitializeApp başlatılıyor...');
        try {
            console.log('API çağrısı yapılıyor...');
            const response = await fetch('/api/data');
            console.log('Response alındı:', response.status, response.statusText);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error Response:', errorText);
                throw new Error(`Veri sunucudan alınamadı. Status: ${response.status}`);
            }
            
            historicalData = await response.json();
            console.log('Data parsed, length:', historicalData.length);
            
            if (historicalData.length === 0) {
                console.warn('Hiç veri bulunamadı');
                showToast('Uyarı: Hiç veri bulunamadı.', 'warning');
                return;
            }

            // Güncel fiyatı yeni endpointten al
            const currentRes = await fetch('/api/current');
            if (!currentRes.ok) {
                const errorData = await currentRes.json();
                throw new Error(errorData.error || 'Güncel kur alınamadı.');
            }
            // ...
            const currentData = await currentRes.json();
            currentGoldPrice = currentData.price;
            console.log('Current gold price set:', currentGoldPrice);
            updateCurrentRateInHeader(currentData); // Tüm güncel kur verisini gönder
            // ...
            
            // Plan yönetimi sistemini başlat
            setupPlanManagement();

            // Eğer plan yükleme sonrası hiç satır eklenmemişse, başlangıç için bir tane ekle
            const tableBody = document.getElementById('calculation-table-body');
            if (tableBody && tableBody.rows.length === 0) {
                addNewRow();
            }

            // Sayfa yüklendiğinde sayacı artır
            incrementCounter();
            
            console.log('İnitializeApp başarıyla tamamlandı');
        } catch (error) {
            console.error('Initialization Error:', error);
            showToast(`Hata: ${error.message}. Sunucu çalışıyor mu kontrol edin.`, 'error');
        }
    }
    
    // Plan yönetimi sistemi
    const PLANS_KEY = 'doviz-hesaplama-plans';
    let currentPlanName = '';
    let hasAutoLoaded = false;
    
    // Toast notification fonksiyonu
    function showToast(message, type = 'success') {
        // Mevcut toast'u kaldır
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        // payment-count-input elementini bul ve onun üzerine yerleştir
        const paymentCountInput = document.getElementById('payment-count-input');
        if (paymentCountInput) {
            const rect = paymentCountInput.getBoundingClientRect();
            toast.style.position = 'fixed';
            toast.style.left = rect.left + 'px';
            toast.style.top = (rect.top - 45) + 'px';
        }
        
        document.body.appendChild(toast);
        
        // Show animation
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Hide after 1.5 seconds
        setTimeout(() => {
            toast.classList.add('hide');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 1500);
    }
    
    function setupPlanManagement() {
        // Plan input ve selector elementleri
        const planSelector = document.getElementById('planSelector');
        const savePlanBtn = document.getElementById('savePlanBtn');
        const deletePlanBtn = document.getElementById('deletePlanBtn');
        const clearCacheBtn = document.getElementById('clearCacheBtn');
        
        // Cache status güncellemesi
        updateCacheStatus();
        updatePlanSelector();
        
        // Plan selector değişimi
        if (planSelector) {
            const planDropdown = document.getElementById('planDropdown');
            
            // Enter tuşu ile kaydetme
            planSelector.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    savePlan();
                }
            });
            
            // Dropdown açma/kapama
            planSelector.addEventListener('focus', function() {
                showPlanDropdown();
            });
            
            planSelector.addEventListener('click', function() {
                showPlanDropdown();
            });
            
            planSelector.addEventListener('blur', function() {
                // Dropdown seçeneklerine tıklama zamanı vermek için gecikmeli kapama
                setTimeout(() => {
                    hidePlanDropdown();
                }, 200);
            });
            
            planSelector.addEventListener('input', function() {
                const selectedPlan = this.value;
                
                // Dropdown'u filtrele
                filterPlanDropdown(selectedPlan);
                
                if (selectedPlan) {
                    // Mevcut planlardan birini seçtiyse yükle
                    const plans = JSON.parse(localStorage.getItem(PLANS_KEY) || '{}');
                    if (plans[selectedPlan]) {
                        loadPlan(selectedPlan);
                    }
                }
            });
            
            planSelector.addEventListener('change', function() {
                const selectedPlan = this.value;
                // planTitleInput'u da güncelle
                if (planTitleInput) {
                    planTitleInput.value = selectedPlan;
                }
                
                if (selectedPlan) {
                    const plans = JSON.parse(localStorage.getItem(PLANS_KEY) || '{}');
                    if (plans[selectedPlan]) {
                        loadPlan(selectedPlan);
                    }
                }
            });
        }
        
        // Plan dropdown helper fonksiyonları
        function showPlanDropdown() {
            const planDropdown = document.getElementById('planDropdown');
            
            if (planDropdown) {
                updatePlanDropdownOptions();
                planDropdown.classList.remove('hidden');
            }
        }
        
        function hidePlanDropdown() {
            const planDropdown = document.getElementById('planDropdown');
            if (planDropdown) {
                planDropdown.classList.add('hidden');
            }
        }
        
        function updatePlanDropdownOptions() {
            const planDropdown = document.getElementById('planDropdown');
            if (!planDropdown) return;
            
            try {
                const plans = JSON.parse(localStorage.getItem(PLANS_KEY) || '{}');
                const planNames = Object.keys(plans).sort();
                
                planDropdown.innerHTML = '';
                
                if (planNames.length === 0) {
                    const emptyOption = document.createElement('div');
                    emptyOption.className = 'plan-dropdown-option empty';
                    emptyOption.textContent = 'Henüz plan yok';
                    planDropdown.appendChild(emptyOption);
                } else {
                    planNames.forEach(planName => {
                        const option = document.createElement('div');
                        option.className = 'plan-dropdown-option';
                        option.textContent = planName;
                        option.addEventListener('click', function() {
                            selectPlan(planName);
                        });
                        planDropdown.appendChild(option);
                    });
                }
            } catch (error) {
                console.error('Dropdown güncelleme hatası:', error);
            }
        }
        
        function filterPlanDropdown(searchText) {
            const planDropdown = document.getElementById('planDropdown');
            if (!planDropdown) return;
            
            const options = planDropdown.querySelectorAll('.plan-dropdown-option:not(.empty)');
            let hasVisible = false;
            
            options.forEach(option => {
                const planName = option.textContent.toLowerCase();
                const search = searchText.toLowerCase();
                
                if (planName.includes(search)) {
                    option.style.display = 'block';
                    hasVisible = true;
                } else {
                    option.style.display = 'none';
                }
            });
            
            if (!hasVisible && searchText) {
                planDropdown.innerHTML = '<div class="plan-dropdown-option empty">Plan bulunamadı</div>';
            }
        }
        
        function selectPlan(planName) {
            const planSelector = document.getElementById('planSelector');
            
            if (planSelector) {
                planSelector.value = planName;
            }
            
            loadPlan(planName);
            hidePlanDropdown();
        }
        
        // Kaydet butonu
        if (savePlanBtn) {
            savePlanBtn.addEventListener('click', savePlan);
        }
        
        // Sil butonu
        if (deletePlanBtn) {
            deletePlanBtn.addEventListener('click', function() {
                if (currentPlanName) {
                    showConfirmModal(`"${currentPlanName}" planını silmek istediğinizden emin misiniz?`, () => {
                        deletePlan(currentPlanName);
                    });
                } else {
                    showToast('Silinecek plan seçilmemiş', 'warning');
                }
            });
        }
        
        // Cache temizleme
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', function() {
                showConfirmModal('Mevcut tablo satırlarını temizlemek istediğinizden emin misiniz?', () => {
                    clearTable();
                    addNewRow();
                    // Footer toplamlarını sıfırla
                    updateTotals();
                    showToast('Tablo temizlendi');
                });
            });
        }
    }
    
    function savePlan() {
        const planSelector = document.getElementById('planSelector');
        
        // Plan ismi planSelector'dan al
        let planName = planSelector?.value.trim();
        
        if (!planName) {
            showToast('Lütfen plan adı girin', 'warning');
            planSelector?.focus();
            return;
        }
        
        const tableData = getCurrentTableData();
        if (tableData.length === 0) {
            showToast('Kaydedilecek veri yok. Lütfen en az bir satır ekleyin.', 'warning');
            return;
        }
        
        try {
            const plans = JSON.parse(localStorage.getItem(PLANS_KEY) || '{}');
            plans[planName] = {
                data: tableData,
                timestamp: Date.now(),
                version: '1.0'
            };
            localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
            
            currentPlanName = planName;
            
            // Her iki input'u da senkronize et
            const planTitleInput = document.getElementById('planTitleInput');
            const planSelector = document.getElementById('planSelector');
            if (planTitleInput) {
                planTitleInput.value = planName;
            }
            if (planSelector) {
                planSelector.value = planName;
            }
            
            updateCacheStatus();
            updatePlanSelector();
            
            showToast(`"${planName}" kaydedildi!`);
        } catch (error) {
            console.error('Plan kaydetme hatası:', error);
            showToast('Plan kaydedilemedi!', 'error');
        }
    }
    
    function loadPlan(planName) {
        try {
            const plans = JSON.parse(localStorage.getItem(PLANS_KEY) || '{}');
            const planData = plans[planName];
            
            if (planData && planData.data) {
                clearTable();
                planData.data.forEach(rowData => {
                    addNewRow({
                        date: { year: rowData.year, month: rowData.month },
                        amount: rowData.amount
                    });
                });
                
                // Plan yükledikten sonra yeni boş satır ekleme
                
                currentPlanName = planName;
                updateCacheStatus();
                
                // Son satırın inputuna odaklan
                const lastRow = tableBody.querySelector('tr:last-child');
                if (lastRow) {
                    const amountInput = lastRow.querySelector('.amount-input');
                    if (amountInput) {
                        amountInput.focus();
                        amountInput.select();
                    }
                }

                return planData.data;
            }
        } catch (error) {
            console.error('Plan yükleme hatası:', error);
        }
        return null;
    }
    
    function deletePlan(planName) {
        try {
            const plans = JSON.parse(localStorage.getItem(PLANS_KEY) || '{}');
            delete plans[planName];
            localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
            
            if (currentPlanName === planName) {
                currentPlanName = '';
                const planTitleInput = document.getElementById('planTitleInput');
                const planSelector = document.getElementById('planSelector');
                if (planTitleInput) {
                    planTitleInput.value = '';
                }
                if (planSelector) {
                    planSelector.value = '';
                }
                clearTable();
                addNewRow();
            }
            
            updateCacheStatus();
            updatePlanSelector();
            showToast(`"${planName}" silindi`);
        } catch (error) {
            console.error('Plan silme hatası:', error);
        }
    }
    
    function updatePlanSelector() {
        const planSelector = document.getElementById('planSelector');
        if (!planSelector) return;
        
        try {
            // Mevcut plan varsa her iki input'a da yaz
            if (currentPlanName) {
                planSelector.value = currentPlanName;
                const planTitleInput = document.getElementById('planTitleInput');
                if (planTitleInput) {
                    planTitleInput.value = currentPlanName;
                }
            }
            
            const plans = JSON.parse(localStorage.getItem(PLANS_KEY) || '{}');
            const planNames = Object.keys(plans).sort();
            
            // Tek plan varsa otomatik seç, veya ilk plan otomatik yüklensin (sadece sayfa ilk açıldığında)
            if (planNames.length === 1 || (planNames.length > 0 && !currentPlanName && !hasAutoLoaded)) {
                const firstPlan = planNames[0];
                loadPlan(firstPlan);
                const planTitleInput = document.getElementById('planTitleInput');
                if (planTitleInput) {
                    planTitleInput.value = firstPlan;
                }
                
                // Plan selector'ı güncelle
                planSelector.value = firstPlan;
                
                hasAutoLoaded = true;
            }
        } catch (error) {
            console.error('Plan selector güncelleme hatası:', error);
        }
    }
    
    function updateCacheStatus() {
        // Cache status display removed - no longer needed
        return;
    }
    
    function getCurrentTableData() {
        const rows = tableBody.querySelectorAll('tr');
        const tableData = [];
        
        rows.forEach(row => {
            const yearSelect = row.querySelector('.year-select');
            const monthSelect = row.querySelector('.month-select');
            const amountInput = row.querySelector('.amount-input');
            
            if (yearSelect && monthSelect && amountInput) {
                const year = yearSelect.value;
                const month = monthSelect.value;
                const rawAmount = amountInput.value.replace(/[^\d]/g, '');
                const amount = parseFloat(rawAmount) || 0;
                
                if (year && month && amount > 0) {
                    tableData.push({
                        year: year,
                        month: month,
                        amount: amount
                    });
                }
            }
        });
        
        return tableData;
    }
    
    function clearTable() {
        if (tableBody) {
            // Hafıza sızıntılarını önlemek için satırları tek tek temizleyerek kaldır
            while (tableBody.firstChild) {
                const row = tableBody.firstChild;
                // Satıra bağlı "drag" olay dinleyicilerini temizle
                if (row._cleanupDragListeners) {
                    row._cleanupDragListeners();
                }
                tableBody.removeChild(row);
            }
        }
    }

    function updateCurrentRateInHeader(currentData) {
        const currentRateEl = document.getElementById('currentRateInfo');
        if (!currentRateEl || !currentData || !currentData.price) return;
 
        const priceHTML = `<div class="rate-price">Güncel Kur: ${formatCurrency(currentData.price, 'TRY', 0)}</div>`;
 
        let sublineHTML = '';
        // Hata olsa bile, sunucudan gelen son geçerli verinin tarih damgası her zaman gösterilir.
        if (currentData.timestamp) {
            const date = new Date(currentData.timestamp);
            // Use UTC methods to format the date, ignoring the browser's timezone.
            // This will display the exact time as seen in the sheet.
            const day = ('0' + date.getUTCDate()).slice(-2);
            const month = ('0' + (date.getUTCMonth() + 1)).slice(-2);
            const year = date.getUTCFullYear();
            const hours = ('0' + date.getUTCHours()).slice(-2);
            const minutes = ('0' + date.getUTCMinutes()).slice(-2);
            const formattedDateTime = `${day}.${month}.${year} ${hours}:${minutes}`;
 
            const errorIndicator = currentData.error
                ? `<span class="rate-error-indicator" title="${currentData.error}">( ! )</span>`
                : '';
 
            sublineHTML = `<div class="rate-subline">
                <span class="rate-timestamp">${formattedDateTime}</span>
                ${errorIndicator}
            </div>`;
        }
 
        currentRateEl.innerHTML = priceHTML + sublineHTML;
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
                <td class="year-cell" data-label="Yıl">
                    <select class="year-select">
                        ${years.map(y => `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>${y}</option>`).join('')}
                    </select>
                </td>
                <td class="month-cell" data-label="Ay">
                    <select class="month-select">
                        ${months.map(m => `<option value="${m.value}" ${m.value === selectedMonth ? 'selected' : ''}>${m.name}</option>`).join('')}
                    </select>
                </td>
                <td class="rate-cell" data-label="Kur">
                    <span class="rate-info">-</span>
                </td>
                <td class="amount-cell" data-label="Miktar">
                    <div class="amount-input-wrapper">
                        <input type="tel" class="amount-input" placeholder="0" inputmode="numeric" maxlength="10">
                    </div>
                </td>
                <td class="gram-cell" data-label="Gram">
                    <span class="gold-amount-sub-value">-</span>
                </td>
                <td class="current-value-cell" data-label="Güncel TL">
                    <span class="current-value-sub-value">-</span>
                </td>
                <td class="action-cell" data-label="İşlem">
                    <button class="delete-row-btn" title="Satırı sil">✕</button>
                </td>
            `;
        } else {
            newRow.innerHTML = `
                <td>
                    <select class="year-select">
                        ${years.map(y => `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>${y}</option>`).join('')}
                    </select>
                </td>
                <td>
                    <select class="month-select">
                        ${months.map(m => `<option value="${m.value}" ${m.value === selectedMonth ? 'selected' : ''}>${m.name}</option>`).join('')}
                    </select>
                </td>
                <td class="rate-cell">
                    <span class="rate-info">-</span>
                </td>
                <td class="amount-cell">
                    <div class="amount-input-wrapper">
                        <input type="tel" class="amount-input" placeholder="0" inputmode="numeric" maxlength="10">
                    </div>
                </td>
                <td class="gram-cell">
                    <span class="gold-amount-sub-value">-</span>
                </td>
                <td class="current-value-cell">
                    <span class="current-value-sub-value">-</span>
                </td>
                <td class="action-cell">
                    <button class="delete-row-btn" title="Satırı sil">✕</button>
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

                    // Ham değerleri data attribute'larında sakla
                    row.dataset.goldAmount = goldAmount;
                    row.dataset.currentValue = currentValue;

                    // Gram kolonuna altın miktarı
                    goldAmountSubValue.textContent = `${goldAmount.toFixed(1)} gr`;
                    
                    // Güncel TL kolonuna güncel değer
                    currentValueSubValue.innerHTML = `<span class="guncel-value">${formatCurrency(currentValue, 'TRY', 0)}</span>`;
                } else {
                    // Data attribute'larını temizle
                    delete row.dataset.goldAmount;
                    delete row.dataset.currentValue;
                    goldAmountSubValue.textContent = '-';
                    currentValueSubValue.textContent = '-';
                }
            } else {
                // Data attribute'larını temizle
                delete row.dataset.goldAmount;
                delete row.dataset.currentValue;
                rateInfo.textContent = 'Veri Yok';
                goldAmountSubValue.textContent = 'Veri Yok';
                currentValueSubValue.textContent = '-';
            }
        } else {
            // Data attribute'larını temizle
            delete row.dataset.goldAmount;
            delete row.dataset.currentValue;
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

            // Hesaplamalar için DOM'dan metin okumak yerine data attribute'larını kullan
            // Bu yöntem daha güvenilir ve performanslıdır.
            totalGoldAmount += parseFloat(row.dataset.goldAmount) || 0;
            totalCurrentValue += parseFloat(row.dataset.currentValue) || 0;
        });

        const totalGoldAmountEl = document.getElementById('total-gold-amount');
        totalGoldAmountEl.textContent = `${totalGoldAmount.toFixed(1)} gr`;
        totalAmountEl.textContent = formatCurrency(totalAmount, 'TRY', 0);
        
        totalCurrentValueLabelEl.innerHTML = `Güncel değer: `;
        totalCurrentValueEl.textContent = formatCurrency(totalCurrentValue, 'TRY', 0);
        
        // Yüzde artış hesaplama
        if (totalAmount > 0 && valueIncreaseInfoEl) {
            const increasePercentage = ((totalCurrentValue - totalAmount) / totalAmount * 100);
            const increaseText = increasePercentage >= 0 ? 
                `%${increasePercentage.toFixed(1)} artış` : 
                `%${Math.abs(increasePercentage).toFixed(1)} azalış`;
            valueIncreaseInfoEl.textContent = increaseText;
        } else if (valueIncreaseInfoEl) {
            valueIncreaseInfoEl.textContent = '%0 artış';
        }
    }

    function updateSubsequentRows(changedRow) {
        const year = changedRow.querySelector('.year-select').value;
        const month = changedRow.querySelector('.month-select').value;
        
        // Eğer yıl veya ay seçili değilse işlem yapma
        if (!year || !month) return;
        
        const allRows = Array.from(tableBody.querySelectorAll('tr'));
        const changedIndex = allRows.indexOf(changedRow);
        
        // Değişen satırın altındaki satırları bul
        const subsequentRows = allRows.slice(changedIndex + 1);
        
        // Eğer alt satır yoksa işlem yapma
        if (subsequentRows.length === 0) return;
        
        // Modern modal ile onay al
        const message = `Kalan satırların tarihleri otomatik güncellensin mi?`;
        
        showConfirmModal(message, () => {
            // Evet seçildiğinde
            let currentDate = new Date(`${year}-${month}-01`);
            
            subsequentRows.forEach((row, index) => {
                // Her bir alt satır için tarihi 1 ay ileri al
                currentDate.setMonth(currentDate.getMonth() + 1);
                
                const newYear = currentDate.getFullYear().toString();
                const newMonth = ('0' + (currentDate.getMonth() + 1)).slice(-2);
                
                // Yıl ve ay select'lerini güncelle
                const yearSelect = row.querySelector('.year-select');
                const monthSelect = row.querySelector('.month-select');
                
                // Sadece mevcut yıllar arasında olan tarihleri güncelle
                const yearOption = yearSelect.querySelector(`option[value="${newYear}"]`);
                if (yearOption) {
                    yearSelect.value = newYear;
                    monthSelect.value = newMonth;
                    
                    // Satırı güncelle
                    updateRow(row);
                }
            });
        });
    }

    // Drag to Delete İşlevselliği
    function addDragToDeleteListeners(row) {
        let startX = 0;
        let startY = 0;
        let currentX = 0;
        let isDragging = false;
        let deleteThreshold = 80; // Silme için minimum mesafe
        let highlightThreshold = 40; // Highlight başlama mesafesi
        let verticalThreshold = 30; // Dikey hareket toleransı
        let isHighlighted = false;
        
        // Touch ve mouse eventlerini birlikte handle et
        const startEvent = isMobile ? 'touchstart' : 'mousedown';
        const moveEvent = isMobile ? 'touchmove' : 'mousemove';
        const endEvent = isMobile ? 'touchend' : 'mouseup';
        
        function getEventPos(e) {
            if (isMobile) {
                return {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY
                };
            }
            return {
                x: e.clientX,
                y: e.clientY
            };
        }
        
        function handleStart(e) {
            // Tek satır varsa drag'e izin verme
            const totalRows = tableBody.querySelectorAll('tr').length;
            if (totalRows <= 1) {
                return;
            }
            
            // Sadece boş alanlarda başlat (input, select elementlerinde değil)
            if (e.target.tagName === 'INPUT' || 
                e.target.tagName === 'SELECT' || 
                e.target.closest('select')) {
                return;
            }
            
            const pos = getEventPos(e);
            startX = pos.x;
            startY = pos.y;
            currentX = 0;
            isDragging = false;
            isHighlighted = false;
            
            // Drag başlarken transition'ı kaldır
            row.style.transition = 'none';
        }
        
        function handleMove(e) {
            if (startX === 0) return;
            
            const pos = getEventPos(e);
            const deltaX = pos.x - startX;
            const deltaY = Math.abs(pos.y - startY);
            
            // Dikey hareket çok fazlaysa drag işlemini iptal et
            if (deltaY > verticalThreshold && !isDragging) {
                resetDrag();
                return;
            }
            
            // Her iki yöne de drag (sağa ve sola)
            const absDeltaX = Math.abs(deltaX);
            if (absDeltaX > 5) { // Minimum hareket
                isDragging = true;
                currentX = deltaX;
                
                // Transition'sız direkt güncelle
                row.style.transform = `translateX(${deltaX}px)`;
                
                // Highlight threshold kontrolü - sadece ilk kez highlight olduğunda renk değişir
                if (absDeltaX >= highlightThreshold && !isHighlighted) {
                    isHighlighted = true;
                    const alpha = 0.4; // Sabit alpha değeri, mesafeye göre değişmesin
                    row.style.backgroundColor = `rgba(220, 53, 69, ${alpha})`;
                    row.classList.add('dragging');
                } else if (absDeltaX < highlightThreshold && isHighlighted) {
                    // Threshold'un altına düştüğünde highlight'ı kaldır
                    isHighlighted = false;
                    row.style.backgroundColor = '';
                    row.classList.remove('dragging');
                }
                // Mesafe artışında renk yoğunluğu değişmesin
                
                e.preventDefault(); // Sayfa kaydırmasını engelle
            }
        }
        
        function handleEnd(e) {
            if (startX === 0) return;
            
            const deleteRow = isDragging && Math.abs(currentX) >= deleteThreshold;
            
            if (deleteRow) {
                // Silme animasyonu için transition ekle
                row.style.transition = 'all 0.3s ease-out';
                const direction = currentX > 0 ? '100%' : '-100%';
                row.style.transform = `translateX(${direction})`;
                row.style.opacity = '0';
                
                setTimeout(() => {
                    // Direkt sil, onay sorma
                    if (row.parentNode) {
                        row._cleanupDragListeners(); // Hafıza sızıntısını önle
                        row.remove();
                        updateTotals();
                    }
                }, 300);
            } else {
                resetDrag();
            }
            
            // State'i tamamen temizle
            startX = 0;
            isDragging = false;
            isHighlighted = false;
            currentX = 0;
        }
        
        function resetDrag() {
            // Önce mevcut stilleri temizle
            row.style.transform = '';
            row.style.backgroundColor = '';
            row.classList.remove('dragging');
            isHighlighted = false;
            
            // Kısa bir gecikme sonra yumuşak transition ekle
            setTimeout(() => {
                row.style.transition = 'all 0.3s ease-out';
                // Bir sonraki frame'de transition'ı kaldır
                setTimeout(() => {
                    row.style.transition = '';
                }, 300);
            }, 10);
        }
        
        // Event listener'ları ekle
        row.addEventListener(startEvent, handleStart, { passive: false });
        document.addEventListener(moveEvent, handleMove, { passive: false });
        document.addEventListener(endEvent, handleEnd, { passive: false });
        
        // Temizlik için row'a cleanup fonksiyonu ekle
        row._cleanupDragListeners = () => {
            document.removeEventListener(moveEvent, handleMove);
            document.removeEventListener(endEvent, handleEnd);
        };
    }

    function attachEventListeners(row) {
        row.querySelector('.year-select').addEventListener('change', () => {
            updateRow(row);
            updateSubsequentRows(row);
        });
        row.querySelector('.month-select').addEventListener('change', () => {
            updateRow(row);
            updateSubsequentRows(row);
        });
        
        // Drag to delete işlevselliği ekle
        addDragToDeleteListeners(row);
        
        // Sil butonu event listener
        const deleteBtn = row.querySelector('.delete-row-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Drag event'ları ile çakışmasını önle
                
                // Tek satır varsa silmeye izin verme
                const totalRows = tableBody.querySelectorAll('tr').length;
                if (totalRows <= 1) {
                    showToast('En az bir satır olmalı', 'warning');
                    return;
                }
                
                // Satırı sil
                // Satıra bağlı "drag" olay dinleyicilerini temizle
                if (row._cleanupDragListeners) {
                    row._cleanupDragListeners();
                }
                row.remove();
                updateTotals();
                showToast('Satır silindi');
            });
        }
        
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
                
                // Yeni özellik: Alt satırlarda miktar varsa onay sor
                const currentAmount = amountInput.value.replace(/[^\d]/g, '');
                if (currentAmount && hasSubsequentRowsWithAmount(row)) {
                    showAmountUpdateConfirmModal(currentAmount, row);
                    return;
                }
                
                // Normal akışa devam et: bir sonraki satıra geç veya yeni satır ekle
                if (nextRow) {
                    nextRow.querySelector('.amount-input').focus();
                } 
                else if (isLastRow) {
                    const { year, month, amount } = getRowData(row);
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

    function getRowData(row) {
        const year = row.querySelector('.year-select').value;
        const month = row.querySelector('.month-select').value;
        const rawAmount = row.querySelector('.amount-input').value.replace(/[^\d]/g, '');
        const amount = parseFloat(rawAmount) || 0;
        return { year, month, amount };
    }

    function formatCurrency(value, currency, maximumFractionDigits = 2) {
        // Basamak ayracı virgül, ondalık ayracı nokta (en-US formatı)
        const formatted = value.toLocaleString('en-US', {
            minimumFractionDigits: maximumFractionDigits,
            maximumFractionDigits: maximumFractionDigits
        });
        
        return `${formatted} ${currency === 'TRY' ? '₺' : currency}`;
    }

    // Yardımcı fonksiyonlar
    function hasSubsequentRowsWithAmount(currentRow) {
        const allRows = Array.from(tableBody.querySelectorAll('tr'));
        const currentIndex = allRows.indexOf(currentRow);
        const subsequentRows = allRows.slice(currentIndex + 1);
        
        return subsequentRows.some(row => {
            const amountInput = row.querySelector('.amount-input');
            const rawAmount = amountInput.value.replace(/[^\d]/g, '');
            return rawAmount && parseFloat(rawAmount) > 0;
        });
    }

    function showAmountUpdateConfirmModal(amount, currentRow) {
        const formattedAmount = parseInt(amount, 10).toLocaleString('en-US');
        const allRows = Array.from(tableBody.querySelectorAll('tr'));
        const currentIndex = allRows.indexOf(currentRow);
        const subsequentRows = allRows.slice(currentIndex + 1);
        const rowsWithAmount = subsequentRows.filter(row => {
            const amountInput = row.querySelector('.amount-input');
            const rawAmount = amountInput.value.replace(/[^\d]/g, '');
            return rawAmount && parseFloat(rawAmount) > 0;
        });
        
        const message = `Bu satırın altındaki ${rowsWithAmount.length} satırın miktar alanını da "${formattedAmount} ₺" yapmak istiyor musunuz?`;
        
        showConfirmModal(message, () => {
            // Evet seçildiğinde - alt satırları güncelle
            rowsWithAmount.forEach(row => {
                const amountInput = row.querySelector('.amount-input');
                amountInput.value = formattedAmount;
                updateRow(row);
            });
            
            // Sonra normal akışa devam et (sonraki satıra geç)
            const nextRow = currentRow.nextElementSibling;
            if (nextRow) {
                nextRow.querySelector('.amount-input').focus();
            }
        }, () => {
            // Hayır seçildiğinde - sadece normal akışa devam et
            const nextRow = currentRow.nextElementSibling;
            if (nextRow) {
                nextRow.querySelector('.amount-input').focus();
            }
        });
    }

    // Modern Modal Fonksiyonları
    function showConfirmModal(message, onConfirm, onCancel = null) {
        const modal = document.getElementById('confirmModal');
        const modalMessage = document.getElementById('modalMessage');
        const modalYes = document.getElementById('modalYes');
        const modalNo = document.getElementById('modalNo');
        
        modalMessage.textContent = message;
        modal.classList.add('show');
        
        // Event listener'ları temizle
        modalYes.replaceWith(modalYes.cloneNode(true));
        modalNo.replaceWith(modalNo.cloneNode(true));
        
        // Yeni event listener'ları ekle
        document.getElementById('modalYes').addEventListener('click', () => {
            modal.classList.remove('show');
            onConfirm();
        });
        
        document.getElementById('modalNo').addEventListener('click', () => {
            modal.classList.remove('show');
            if (onCancel) onCancel();
        });
        
        // Overlay'e tıklandığında kapat
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
                if (onCancel) onCancel();
            }
        });
        
        // ESC tuşu ile kapat
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                modal.classList.remove('show');
                if (onCancel) onCancel();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    async function incrementCounter() {
        try {
            const response = await fetch('/api/counter/increment', { method: 'POST' });
            const data = await response.json();
            const counterElement = document.getElementById('counter');
            if (counterElement) {
                counterElement.textContent = data.count;
            }
        } catch (error) {
            console.error('Sayaç artırılırken hata oluştu:', error);
        }
    }

    // Uygulamayı Başlat
    initializeApp();

    const resetCounterBtn = document.getElementById('resetCounterBtn');
    if (resetCounterBtn) {
        resetCounterBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/counter/reset', { method: 'POST' });
                const data = await response.json();
                const counterElement = document.getElementById('counter');
                if (counterElement) {
                    counterElement.textContent = data.count;
                }
            } catch (error) {
                console.error('Sayaç sıfırlanırken hata oluştu:', error);
            }
        });
    }

    const generateRowsBtn = document.getElementById('generate-rows-btn');
    generateRowsBtn.addEventListener('click', generateRows);

    function generateRows() {
        const paymentCountInput = document.getElementById('payment-count-input');
        const targetRowCount = parseInt(paymentCountInput.value, 10);

        if (isNaN(targetRowCount) || targetRowCount <= 0) {
            showToast('Lütfen geçerli bir taksit sayısı girin.', 'warning');
            return;
        }

        const currentRowCount = tableBody.rows.length;
        const rowsToAdd = targetRowCount - currentRowCount;

        if (rowsToAdd <= 0) {
            showToast('Girilen taksit sayısı mevcut satır sayısından az veya eşit.', 'warning');
            return;
        }

        const lastRow = tableBody.querySelector('tr:last-child');
        if (!lastRow) {
            showToast('Otomatik doldurma için en az bir satır olmalıdır.', 'warning');
            return;
        }

        let { year, month, amount } = getRowData(lastRow);

        if (!year || !month || !amount) {
            showToast('Lütfen son satırdaki tüm alanları doldurun.', 'warning');
            return;
        }

        let lastDate = new Date(year, month - 1, 1);

        for (let i = 0; i < rowsToAdd; i++) {
            lastDate.setMonth(lastDate.getMonth() + 1);
            const nextYear = lastDate.getFullYear().toString();
            const nextMonth = ('0' + (lastDate.getMonth() + 1)).slice(-2);

            addNewRow({ date: { year: nextYear, month: nextMonth }, amount: amount });
        }

        paymentCountInput.value = '';
    }
});