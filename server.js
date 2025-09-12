// server.js (YENİ HALİ)

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
// HTML, CSS, JS dosyalarını sunmak için public klasörünü kullanmak daha doğru bir yöntemdir.
// Şimdilik ana dizini kullanmaya devam edelim.
app.use(express.static(path.join(__dirname)));

// --- API ENDPOINT (TÜM VERİYİ GÖNDER) ---
app.get('/api/data', async (req, res) => {
    try {
        const client = await auth.getClient();
        const googleSheets = google.sheets({ version: 'v4', auth: client });
        const range = 'Sayfa1!A:B'; // A ve B sütunlarını al

        const response = await googleSheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: range,
        });

        const allRows = response.data.values;
        if (!allRows || allRows.length <= 1) { // Başlık satırı hariç veri var mı?
            return res.status(404).json({ error: 'E-Tabloda hiç veri bulunamadı.' });
        }

        // Başlık satırını (ilk satır) atla ve verileri formatla
        const data = allRows.slice(1).map(row => {
            // Virgülü noktaya çevir
            const formattedPrice = parseFloat(row[1].replace(',', '.'));
            return {
                date: row[0],      // Tarih (Örn: 2023-05)
                price: formattedPrice // Fiyat (Örn: 1250.75)
            };
        });

        res.json(data);

    } catch (error) {
        console.error('Google Sheets API Hatası:', error);
        res.status(500).json({ error: 'Google Sheets verisi alınırken sunucu hatası oluştu.' });
    }
});

// Sunucuyu başlat
app.listen(port, () => {
    console.log(`Sunucu http://localhost:${port} adresinde çalışıyor.`);
});