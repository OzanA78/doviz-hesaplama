const express = require('express');
const path = require('path');
const { google } = require('googleapis');
const NodeCache = require('node-cache');
const fs = require('fs').promises;

const app = express();
const port = 3000;

// --- ÖNBELLEK AYARLARI ---

// Tarihsel veri için uzun bir süre (örn: 1 gün), güncel kur için sonsuz önbellek. Kur sheet değiştiğinde otomatik sunucuya cache rset komuutu tetikleniyor.
const historicalDataCache = new NodeCache({ stdTTL: 86400 }); // 1 gün (saniye cinsinden)
const currentPriceCache = new NodeCache({ stdTTL: 0 }); // 0 = asla otomatik silme

/**
 * Converts a Google Sheets serial number to a JavaScript Date object.
 * @param {number} serial The Google Sheets serial number.
 * @returns {Date | null} The converted Date object or null if input is invalid.
 */
function sheetsSerialNumberToDate(serial) {
  if (typeof serial !== 'number') {
    const d = new Date(serial);
    return isNaN(d.getTime()) ? null : d;
  }
  // The serial number from Sheets represents days since 1899-12-30.
  // This calculation gives milliseconds since the JS epoch (1970-01-01 UTC).
  // The key issue is that this conversion results in a UTC date that has the same
  // clock time as the local time in the sheet (e.g., 11:16 in sheet becomes a Date object for 11:16 UTC).
  // The client will then be responsible for formatting this UTC time correctly.
  const msSinceEpoch = (serial - 25569) * 86400000;
  return new Date(msSinceEpoch);
}

// --- GOOGLE SHEETS API AYARLARI ---
let auth;
if (process.env.GOOGLE_CREDENTIALS_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    auth = new google.auth.GoogleAuth({
        credentials,
        scopes: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    });
} else {
    auth = new google.auth.GoogleAuth({
        keyFile: 'credentials.json',
        scopes: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    });
}

const spreadsheetId = '1_dxzqWIgQqhONb53dxv39nVIG3JeN5iO-co8Lgbb6fw';

// --- DOSYA YOLLARI ---
const counterFilePath = path.join(__dirname, 'counter.json');
const cacheStatusFilePath = path.join(__dirname, 'cacheStatus.json'); // YENİ EKLENDİ

// --- STATİK DOSYALARI SUNMA ---
app.use(express.static(path.join(__dirname, 'public')));


// --- WEBHOOK ENDPOINT: ÖNBELLEĞİ TEMİZLEME ---
// Bu endpoint, Google Apps Script'ten gelen isteği dinleyecek
app.post('/api/cache/clear', express.json(), async (req, res) => { // async EKLENDİ
    // Google Apps Script'e yazdığınız gizli anahtarın BİREBİR AYNISINI buraya yazın
    const GIZLI_ANAHTAR = 'c7e2a1b3d4f5e6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1';
    
    const { secret } = req.body;

    if (secret === GIZLI_ANAHTAR) {
        // Anahtar doğruysa, sadece güncel kur önbelleğini temizle.
        currentPriceCache.del('currentGoldPrice');
        
        // --- DEĞİŞİKLİK BAŞLANGICI ---
        try {
            // Şu anki zamanı dosyaya kaydet
            const newStatus = { lastCleared: new Date() };
            await writeCacheStatus(newStatus);
            console.log('Webhook received: Cache status file updated.');
        } catch (error) {
            console.error('Cache status dosyasına yazılırken hata:', error);
        }
        // --- DEĞİŞİKLİK SONU ---

        console.log('Webhook received: currentGoldPrice cache cleared successfully.');
        res.status(200).json({ message: 'Cache cleared.' });
    } else {
        // Anahtar yanlışsa veya yoksa, yetkisiz erişim hatası ver
        console.warn('Unauthorized attempt to clear cache received.');
        res.status(403).json({ error: 'Forbidden' });
    }
});

// --- API ENDPOINT: CACHE DURUMUNU GÖNDER --- YENİ EKLENDİ
app.get('/api/cache/status', async (req, res) => {
    try {
        const status = await readCacheStatus();
        res.json(status);
    } catch (error) {
        console.error('Cache status okunurken hata:', error);
        res.status(500).json({ error: 'Cache status verisi okunamadı.' });
    }
});


// --- API ENDPOINT (TÜM VERİYİ GÖNDER) ---
app.get('/api/data', async (req, res) => {
    const cacheKey = 'allHistoricalData';
    // 1. Önce önbelleği kontrol et
    if (historicalDataCache.has(cacheKey)) {
        console.log('Tarihsel veri önbellekten sunuldu.');
        return res.json(historicalDataCache.get(cacheKey));
    }

    try {
        const client = await auth.getClient();
        const googleSheets = google.sheets({ version: 'v4', auth: client });
        const range = 'GoldHistory!A:B';

        const response = await googleSheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: range,
            valueRenderOption: 'UNFORMATTED_VALUE'
        });

        const allRows = response.data.values;
        if (!allRows || allRows.length <= 1) {
            return res.status(404).json({ error: 'E-Tabloda hiç veri bulunamadı.' });
        }

        const data = allRows.slice(1).map(row => {
            const dateSerial = row[0];
            const priceValue = row[1];
            if (!dateSerial || priceValue == null) return null;

            let formattedPrice;
            if (typeof priceValue === 'number') {
                // Değer zaten bir sayı ise, doğrudan kullan.
                formattedPrice = priceValue;
            } else if (typeof priceValue === 'string') {
                // Değer bir metin ise, Türkçe formatından parse et.
                const priceString = priceValue.replace(/\./g, '').replace(',', '.');
                formattedPrice = parseFloat(priceString);
            } else {
                return null; // Desteklenmeyen tip
            }

            if (isNaN(formattedPrice)) return null;

            return { date: sheetsSerialNumberToDate(dateSerial), price: formattedPrice };
        }).filter(item => item !== null);

        // Sort by date in ascending order (oldest to newest) by subtracting them
        data.sort((a, b) => a.date - b.date);

        // 2. Veriyi önbelleğe kaydet
        historicalDataCache.set(cacheKey, data);
        console.log('Tarihsel veri Google Sheets\'ten çekildi ve önbelleğe alındı.');
        res.json(data);
    } catch (error) {
        console.error('Google Sheets API Hatası (/api/data):', error);
        res.status(500).json({ error: 'Google Sheets verisi alınırken sunucu hatası oluştu.' });
    }
});

// --- YENİ API ENDPOINT: GÜNCEL KUR VE HATA DURUMU ---
app.get('/api/current', async (req, res) => {
    const cacheKey = 'currentGoldPrice';
    // 1. Önce önbelleği kontrol et
    if (currentPriceCache.has(cacheKey)) {
        console.log('Güncel kur önbellekten sunuldu.');
        return res.json(currentPriceCache.get(cacheKey));
    }

    try {
        const client = await auth.getClient();
        const googleSheets = google.sheets({ version: 'v4', auth: client });

        // 'GoldHistory' sayfasından son satırın A, B ve C sütunlarını oku
        const response = await googleSheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: 'GoldHistory!A:C', // Tarih, Fiyat ve Hata sütunlarını al
            valueRenderOption: 'UNFORMATTED_VALUE'
        });

        const allRows = response.data.values;
        if (!allRows || allRows.length <= 1) { // Başlık satırını hesaba kat
            return res.status(404).json({ error: 'Tarihsel veri bulunamadı.' });
        }

        // Dizideki son satırı al
        const lastRow = allRows[allRows.length - 1];
        const timestampValue = sheetsSerialNumberToDate(lastRow[0]) || null; // A sütunundaki tarih değeri
        const priceValue = lastRow[1] || null; // B sütunundaki fiyat değeri
        const errorValue = lastRow[2] || null; // C sütunundaki hata değeri

        if (priceValue == null) {
            return res.status(404).json({ error: 'Güncel kur verisi (son satır) bulunamadı.' });
        }

        let formattedPrice;
        if (typeof priceValue === 'number') {
            formattedPrice = priceValue;
        } else if (typeof priceValue === 'string') {
            const priceString = priceValue.replace(/\./g, '').replace(',', '.');
            formattedPrice = parseFloat(priceString);
        } else {
            return res.status(500).json({ error: 'Güncel kur verisi anlaşılamadı.' });
        }

        const result = {
            price: formattedPrice,
            timestamp: timestampValue,
            error: errorValue
        };

        // 2. Sonucu önbelleğe kaydet
        currentPriceCache.set(cacheKey, result);
        console.log('Güncel kur ve durum GoldHistory son satırından çekildi ve önbelleğe alındı.');
        res.json(result);
    } catch (error) {
        console.error('Google Sheets API Hatası (/api/current):', error);
        res.status(500).json({ error: 'Güncel kur verisi alınırken sunucu hatası oluştu.' });
    }
});


// --- YARDIMCI FONKSİYONLAR: Sayaç ve Cache Durumu ---

// Sayaç verisini okuma
async function readCounter() {
    try {
        const data = await fs.readFile(counterFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Dosya yoksa veya bozuksa, varsayılan sayaç oluştur
        if (error.code === 'ENOENT') {
            await writeCounter({ count: 0 });
            return { count: 0 };
        }
        throw error;
    }
}

// Sayaç verisini yazma
async function writeCounter(data) {
    await fs.writeFile(counterFilePath, JSON.stringify(data, null, 2), 'utf8');
}

// Cache durumunu okuma -- YENİ EKLENDİ
async function readCacheStatus() {
    try {
        const data = await fs.readFile(cacheStatusFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            const defaultStatus = { lastCleared: null };
            await writeCacheStatus(defaultStatus);
            return defaultStatus;
        }
        throw error;
    }
}

// Cache durumunu yazma -- YENİ EKLENDİ
async function writeCacheStatus(data) {
    await fs.writeFile(cacheStatusFilePath, JSON.stringify(data, null, 2), 'utf8');
}

// --- SAYAÇ API ENDPOINT'LERİ ---

// Sayaç endpoint'i
app.get('/api/counter', async (req, res) => {
    try {
        const counter = await readCounter();
        res.json(counter);
    } catch (error) {
        console.error('Sayaç okunurken hata:', error);
        res.status(500).json({ error: 'Sayaç verisi okunamadı.' });
    }
});

const rateLimit = require('express-rate-limit');

// Rate limiting için ayar
const incrementLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 dakika
	max: 100, // Her IP için 15 dakikada 100 istek limiti
	message: 'Çok fazla sayaç artırma isteği gönderdiniz, lütfen 15 dakika sonra tekrar deneyin.',
    standardHeaders: true, // `RateLimit-*` başlıklarını yanıta ekle
	legacyHeaders: false, // `X-RateLimit-*` başlıklarını devre dışı bırak
});

// Sayaç artırma endpoint'i
app.post('/api/counter/increment', incrementLimiter, async (req, res) => {
    try {
        const counter = await readCounter();
        counter.count++;
        await writeCounter(counter);
        res.json(counter);
    } catch (error) {
        console.error('Sayaç artırılırken hata:', error);
        res.status(500).json({ error: 'Sayaç verisi güncellenemedi.' });
    }
});

// Sayaç sıfırlama endpoint'i
app.post('/api/counter/reset', async (req, res) => {
    try {
        const counter = { count: 0 };
        await writeCounter(counter);
        res.json(counter);
    } catch (error) {
        console.error('Sayaç sıfırlanırken hata:', error);
        res.status(500).json({ error: 'Sayaç verisi sıfırlanamadı.' });
    }
});

// Ana sayfa için yönlendirme
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Sunucuyu başlat
app.listen(port, () => {
    console.log(`Sunucu http://localhost:${port} adresinde çalışıyor.`);
});