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
            updateCurrentRateInHeader();
            
            // Plan yönetimi sistemini başlat
            setupPlanManagement();
            
            addNewRow();
        } catch (error) {
            console.error('Initialization Error:', error);
            alert('Hata: Veri yüklenemedi. Lütfen sayfayı yenileyin.');
        }
    }
    
    // Plan yönetimi sistemi
    const PLANS_KEY = 'doviz-hesaplama-plans';
    let currentPlanName = '';
    
    function setupPlanManagement() {
        // Plan input ve selector elementleri
        const planTitleInput = document.getElementById('planTitleInput');
        const planSelector = document.getElementById('planSelector');
        const savePlanBtn = document.getElementById('savePlanBtn');
        const deletePlanBtn = document.getElementById('deletePlanBtn');
        const clearCacheBtn = document.getElementById('clearCacheBtn');
        
        // Cache status güncellemesi
        updateCacheStatus();
        updatePlanSelector();
        
        // Plan title input events
        if (planTitleInput) {
            planTitleInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    savePlan();
                }
            });
        }
        
        // Plan selector değişimi
        if (planSelector) {
            planSelector.addEventListener('change', function() {
                const selectedPlan = this.value;
                if (selectedPlan) {
                    loadPlan(selectedPlan);
                    if (planTitleInput) {
                        planTitleInput.value = selectedPlan;
                    }
                }
            });
        }
        
        // Kaydet butonu
        if (savePlanBtn) {
            savePlanBtn.addEventListener('click', savePlan);
        }
        
        // Sil butonu
        if (deletePlanBtn) {
            deletePlanBtn.addEventListener('click', function() {
                if (currentPlanName) {
                    if (confirm(`"${currentPlanName}" planını silmek istediğinizden emin misiniz?`)) {
                        deletePlan(currentPlanName);
                    }
                } else {
                    alert('Silinecek plan seçilmemiş');
                }
            });
        }
        
        // Cache temizleme
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', function() {
                if (confirm('Tüm planları silmek istediğinizden emin misiniz?')) {
                    localStorage.removeItem(PLANS_KEY);
                    updateCacheStatus();
                    updatePlanSelector();
                    alert('Tüm planlar silindi');
                }
            });
        }
    }
    
    function savePlan() {
        const planTitleInput = document.getElementById('planTitleInput');
        const planName = planTitleInput?.value.trim();
        
        if (!planName) {
            alert('Lütfen plan adı girin');
            planTitleInput?.focus();
            return;
        }
        
        const tableData = getCurrentTableData();
        if (tableData.length === 0) {
            alert('Kaydedilecek veri yok. Lütfen en az bir satır ekleyin.');
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
            updateCacheStatus();
            updatePlanSelector();
            
            alert(`"${planName}" planı kaydedildi!`);
        } catch (error) {
            console.error('Plan kaydetme hatası:', error);
            alert('Plan kaydedilemedi!');
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
                
                currentPlanName = planName;
                updateCacheStatus();
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
                if (planTitleInput) {
                    planTitleInput.value = '';
                }
                clearTable();
                addNewRow();
            }
            
            updateCacheStatus();
            updatePlanSelector();
            alert(`"${planName}" planı silindi`);
        } catch (error) {
            console.error('Plan silme hatası:', error);
        }
    }
    
    function updatePlanSelector() {
        const planSelector = document.getElementById('planSelector');
        if (!planSelector) return;
        
        try {
            const plans = JSON.parse(localStorage.getItem(PLANS_KEY) || '{}');
            planSelector.innerHTML = '<option value="">Plan seçin...</option>';
            
            Object.keys(plans).sort().forEach(planName => {
                const option = document.createElement('option');
                option.value = planName;
                option.textContent = planName;
                if (planName === currentPlanName) {
                    option.selected = true;
                }
                planSelector.appendChild(option);
            });
        } catch (error) {
            console.error('Plan selector güncelleme hatası:', error);
        }
    }
    
    function updateCacheStatus() {
        const cacheStatusEl = document.getElementById('cacheStatus');
        if (!cacheStatusEl) return;
        
        try {
            const plans = JSON.parse(localStorage.getItem(PLANS_KEY) || '{}');
            const planCount = Object.keys(plans).length;
            
            if (currentPlanName) {
                const currentPlan = plans[currentPlanName];
                if (currentPlan) {
                    const rowCount = currentPlan.data ? currentPlan.data.length : 0;
                    cacheStatusEl.textContent = `📋 "${currentPlanName}" (${rowCount} satır)`;
                } else {
                    cacheStatusEl.textContent = `📋 "${currentPlanName}" - Kaydedilmemiş`;
                }
            } else if (planCount > 0) {
                cacheStatusEl.textContent = `💾 ${planCount} plan kaydedildi`;
            } else {
                cacheStatusEl.textContent = '💾 Kayıtlı plan yok';
            }
        } catch (error) {
            cacheStatusEl.textContent = '💾 Cache hatası';
        }
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
            tableBody.innerHTML = '';
        }
    }

    function updateCurrentRateInHeader() {
        const currentRateEl = document.getElementById('currentRateInfo');
        if (currentRateEl && currentGoldPrice) {
            currentRateEl.textContent = `Güncel Kur: ${formatCurrency(currentGoldPrice, 'TRY', 0)}`;
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
                    
                    // Sağ alt: Güncel etiket + değer (HTML ile)
                    currentValueSubValue.innerHTML = `<span class="guncel-label">Güncel:</span><span class="guncel-value">${formatCurrency(currentValue, 'TRY', 0)}</span>`;
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
                // Yeni yapıda güncel değeri span'dan al
                const guncelValueSpan = currentValueSubValue.querySelector('.guncel-value');
                if (guncelValueSpan) {
                    const currentText = guncelValueSpan.textContent;
                    const rawCurrentValue = currentText.replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.');
                    totalCurrentValue += parseFloat(rawCurrentValue) || 0;
                } else {
                    // Fallback: "Güncel: 296.073 ₺" formatından değeri çıkar
                    const currentText = currentValueSubValue.textContent;
                    const valueMatch = currentText.match(/Güncel:\s*([₺\d,.]+)/);
                    if (valueMatch) {
                        const rawCurrentValue = valueMatch[1].replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.');
                        totalCurrentValue += parseFloat(rawCurrentValue) || 0;
                    }
                }
            }
        });

        const totalGoldAmountEl = document.getElementById('total-gold-amount');
        totalGoldAmountEl.textContent = `${totalGoldAmount.toFixed(1)} gr`;
        totalAmountEl.textContent = formatCurrency(totalAmount, 'TRY', 0);
        
        totalCurrentValueLabelEl.innerHTML = `Bugünün Parası ile:`;
        totalCurrentValueEl.textContent = formatCurrency(totalCurrentValue, 'TRY', 0);
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
        // ###,###.## formatı için
        const formatted = value.toLocaleString('tr-TR', {
            minimumFractionDigits: maximumFractionDigits,
            maximumFractionDigits: maximumFractionDigits
        });
        
        return `${formatted} ${currency === 'TRY' ? '₺' : currency}`;
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

    // Uygulamayı Başlat
    initializeApp();
});