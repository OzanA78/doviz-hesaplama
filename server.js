const express = require('express');
const path = require('path');
const { google } = require('googleapis');

const app = express();
const port = 3000;

// --- GOOGLE SHEETS API AYARLARI ---
const auth = new google.auth.GoogleAuth({
    keyFile: 'credentials.json',
    scopes: 'https://www.googleapis.com/auth/spreadsheets.readonly',
});

// DİKKAT! Bu satırı güncellemeyi unutmayın.
// Google E-Tablonuzun URL'sindeki .../d/...../edit kısmındaki ID'yi buraya yapıştırın.
const spreadsheetId = '1_dxzqWIgQqhONb53dxv39nVIG3JeN5iO-co8Lgbb6fw';

// --- API ENDPOINT ---
app.use(express.static(path.join(__dirname)));

app.get('/get-rate', async (req, res) => {
    const requestedDate = req.query.date;

    if (!requestedDate) {
        return res.status(400).json({ error: 'Tarih belirtilmedi.' });
    }

    try {
        const client = await auth.getClient();
        const googleSheets = google.sheets({ version: 'v4', auth: client });
        const range = 'Sayfa1!A:B';

        const response = await googleSheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: range,
        });

        const allRows = response.data.values;
        if (!allRows || allRows.length === 0) {
            return res.status(404).json({ error: 'E-Tabloda hiç veri bulunamadı.' });
        }

        const dataRows = allRows.slice(1);
        const record = dataRows.find(row => row[0] === requestedDate);

        if (record) {
            res.json({ date: record[0], rate: record[1] });
        } else {
            res.status(404).json({ error: 'Belirtilen tarihe ait veri bulunamadı.' });
        }

    } catch (error) {
        console.error('Google Sheets API Hatası:', error);
        res.status(500).json({ error: 'Veritabanına (Google Sheets) bağlanırken bir sunucu hatası oluştu.' });
    }
});

// Sunucuyu başlat
app.listen(port, () => {
    console.log(`Sunucu http://localhost:${port} adresinde çalışıyor.`);
});