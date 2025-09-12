@echo off
rem Turkce karakter sorunu olmamasi icin kod sayfasini ayarla
chcp 65001 > nul

rem Kullanicidan commit mesaji iste
set /p commitMessage="Lutfen commit mesajini girin: "

rem PowerShell script'ini kullanicinin mesajiyla calistir
powershell -ExecutionPolicy Bypass -File ".\deploy.ps1" -Message "%commitMessage%"

echo.
echo Islem tamamlandi. Pencereyi kapatmak icin bir tusa basin...
pause > nul