# Script'in bir parametre (-Message) almasını sağla
param (
    [Parameter(Mandatory=$true)]
    [string]$Message
)

# 1. Değişiklikleri pakete ekle
Write-Host "--- Değişiklikler Pakete Ekleniyor (git add .) ---"
git add .

# 2. Değişiklikleri parametre olarak gelen mesajla kaydet
Write-Host "--- Değişiklikler '$Message' mesajıyla kaydediliyor (git commit) ---"
git commit -m "$Message"

# 3. Değişiklikleri GitHub'a gönder
Write-Host "--- GitHub'a Gönderiliyor (git push) ---"
git push

Write-Host "`n--- İşlem Tamamlandı! ---"