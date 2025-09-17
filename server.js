const express = require('express');
const path = require('path');
const { google } = require('googleapis');
const NodeCache = require('node-cache');

const app = express();
const port = 3000;

// --- ÖNBELLEK AYARLARI ---
// Tarihsel veri için 10 dakika, güncel kur için 2 dakika önbellek süresi
const historicalDataCache = new NodeCache({ stdTTL: 600 });
const currentPriceCache = new NodeCache({ stdTTL: 120 });

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
  // clock time as the sheet's local time (e.g., 11:16 in sheet becomes 11:16 UTC).
  const msSinceEpoch = (serial - 25569) * 86400000;
  const date = new Date(msSinceEpoch);

  // To correct this, we get the timezone offset of the environment where this code runs
  // (which is UTC on the server, so offset is 0) and add it. Then we subtract the
  // known offset of the sheet's timezone (GMT+3 for Turkey).
  const sheetTimezoneOffset = 3 * 60; // 3 hours in minutes
  return new Date(date.getTime() + (date.getTimezoneOffset() - sheetTimezoneOffset) * 60000);
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

// --- STATİK DOSYALARI SUNMA ---
app.use(express.static(path.join(__dirname, 'public')));

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


// Ana sayfa için yönlendirme
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Sunucuyu başlat
app.listen(port, () => {
    console.log(`Sunucu http://localhost:${port} adresinde çalışıyor.`);
});