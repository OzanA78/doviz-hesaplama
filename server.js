const express = require('express');
const path = require('path');
const { google } = require('googleapis');

const app = express();
const port = 3000;

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
    try {
        const client = await auth.getClient();
        const googleSheets = google.sheets({ version: 'v4', auth: client });
        const range = 'Sayfa1!A:B';

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
        res.json(data);
    } catch (error) {
        console.error('Google Sheets API Hatası (/api/data):', error);
        res.status(500).json({ error: 'Google Sheets verisi alınırken sunucu hatası oluştu.' });
    }
});

// --- YENİ API ENDPOINT: GÜNCEL KUR VE HATA DURUMU ---
app.get('/api/current', async (req, res) => {
    try {
        const client = await auth.getClient();
        const googleSheets = google.sheets({ version: 'v4', auth: client });
        
        // Hem A1 (fiyat) hem de C1 (hata) hücrelerini tek seferde oku
        const response = await googleSheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: 'Guncel Kur!A1:C1',
        });

        const values = response.data.values ? response.data.values[0] : [];
        const priceValue = values[0] || null; // A1 hücresi
        const errorValue = values[2] || null; // C1 hücresi

        if (!priceValue) {
            return res.status(404).json({ error: 'Güncel kur verisi (A1) bulunamadı.' });
        }

        const priceString = priceValue.replace(/\./g, '').replace(',', '.');
        const formattedPrice = parseFloat(priceString);

        res.json({ 
            price: formattedPrice,
            error: errorValue // Hata mesajını da yanıta ekle
        });

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