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
        });

        const allRows = response.data.values;
        if (!allRows || allRows.length <= 1) {
            return res.status(404).json({ error: 'E-Tabloda hiç veri bulunamadı.' });
        }

        const data = allRows.slice(1).map(row => {
            if (!row[0] || !row[1]) return null;
            const priceString = row[1].replace(/\./g, '').replace(',', '.');
            const formattedPrice = parseFloat(priceString);
            return { date: row[0], price: formattedPrice };
        }).filter(item => item !== null);

        data.sort((a, b) => a.date.localeCompare(b.date));

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

        // 'GoldHistory' sayfasının tamamını oku
        const response = await googleSheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: 'GoldHistory!A:B', // Tarih ve Fiyat sütunlarını al
        });

        const allRows = response.data.values;
        if (!allRows || allRows.length <= 1) { // Başlık satırını hesaba kat
            return res.status(404).json({ error: 'Tarihsel veri bulunamadı.' });
        }

        // Dizideki son satırı al
        const lastRow = allRows[allRows.length - 1];
        const priceValue = lastRow[1] || null; // B sütunundaki fiyat değeri

        if (!priceValue) {
            return res.status(404).json({ error: 'Güncel kur verisi (son satır) bulunamadı.' });
        }

        const priceString = priceValue.replace(/\./g, '').replace(',', '.');
        const formattedPrice = parseFloat(priceString);

        const result = {
            price: formattedPrice,
            // Not: 'Guncel Kur' sayfasındaki hata hücresi artık okunmuyor.
            error: null 
        };

        // 2. Sonucu önbelleğe kaydet
        currentPriceCache.set(cacheKey, result);
        console.log('Güncel kur GoldHistory son satırından çekildi ve önbelleğe alındı.');
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