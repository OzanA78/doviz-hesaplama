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

            // --- YENİ VE DÜZELTİLMİŞ KISIM ---
            // '4.441,09' gibi bir metni doğru sayıya çevirmek için:
            // 1. Binlik ayracı olan noktaları kaldır ('4441,09')
            // 2. Ondalık ayracı olan virgülü noktaya çevir ('4441.09')
            const priceString = row[1]
                .replace(/\./g, '') // Bütün noktaları kaldır
                .replace(',', '.');  // Virgülü noktaya çevir
            
            const formattedPrice = parseFloat(priceString);
            // --- DÜZELTME SONU ---

            return {
                date: row[0],
                price: formattedPrice
            };
        }).filter(item => item !== null);

        data.sort((a, b) => a.date.localeCompare(b.date));

        res.json(data);

    } catch (error) {
        console.error('Google Sheets API Hatası:', error);
        res.status(500).json({ error: 'Google Sheets verisi alınırken sunucu hatası oluştu.' });
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