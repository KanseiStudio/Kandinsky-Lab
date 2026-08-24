<#
.SYNOPSIS
    Registra Kandinsky Lab per l'avvio automatico sulla postazione di sala.

.DESCRIPTION
    Usa l'Utilità di pianificazione invece della cartella Esecuzione automatica.
    La differenza che conta in un museo: se l'applicazione si chiude o va in
    errore, l'Utilità di pianificazione la riavvia da sola. La cartella
    Esecuzione automatica lancia l'applicazione una volta e basta, e se alle
    undici del mattino qualcosa va storto lo schermo resta sul desktop di
    Windows davanti ai visitatori per il resto della giornata.

.PARAMETER Percorso
    Percorso completo di "Avvia Kandinsky Lab.bat" (consigliato, perché e' il
    file che rilancia l'applicazione se si chiude) oppure dell'eseguibile.
    Se omesso, viene cercato nelle posizioni consuete.

.PARAMETER Rimuovi
    Rimuove l'attività pianificata invece di crearla.

.EXAMPLE
    .\installa-avvio-automatico.ps1
    .\installa-avvio-automatico.ps1 -Percorso "D:\Kandinsky\Kandinsky Lab.exe"
    .\installa-avvio-automatico.ps1 -Rimuovi
#>
param(
    [string]$Percorso,
    [switch]$Rimuovi
)

$ErrorActionPreference = "Stop"
$NomeAttivita = "Kandinsky Lab"

# --- Rimozione --------------------------------------------------------------
if ($Rimuovi) {
    if (Get-ScheduledTask -TaskName $NomeAttivita -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $NomeAttivita -Confirm:$false
        Write-Host "Attivita '$NomeAttivita' rimossa." -ForegroundColor Green
    } else {
        Write-Host "Nessuna attivita '$NomeAttivita' da rimuovere."
    }
    return
}

# --- Individuazione dell'eseguibile ----------------------------------------
if (-not $Percorso) {
    $candidati = @(
        # Il file di avvio ha la precedenza: e' quello che rilancia
        # l'applicazione se si chiude.
        (Join-Path $PSScriptRoot "Avvia Kandinsky Lab.bat"),
        "$env:USERPROFILE\Desktop\Kandinsky Lab\Avvia Kandinsky Lab.bat",
        "C:\Kandinsky Lab\Avvia Kandinsky Lab.bat",
        "$env:ProgramFiles\Kandinsky Lab\Kandinsky Lab.exe",
        "${env:ProgramFiles(x86)}\Kandinsky Lab\Kandinsky Lab.exe",
        "$env:LOCALAPPDATA\Programs\Kandinsky Lab\Kandinsky Lab.exe"
    )
    $Percorso = $candidati | Where-Object { Test-Path $_ } | Select-Object -First 1
}

if (-not $Percorso -or -not (Test-Path $Percorso)) {
    Write-Host "Eseguibile non trovato." -ForegroundColor Red
    Write-Host "Indicarlo esplicitamente:"
    Write-Host '  .\installa-avvio-automatico.ps1 -Percorso "C:\percorso\Kandinsky Lab.exe"'
    exit 1
}

Write-Host "Eseguibile: $Percorso"

# --- Attività ---------------------------------------------------------------
$azione = New-ScheduledTaskAction -Execute $Percorso -WorkingDirectory (Split-Path $Percorso)

if ($Percorso -notlike "*.bat") {
    Write-Host ""
    Write-Host "Nota: stai registrando l'eseguibile e non 'Avvia Kandinsky Lab.bat'." -ForegroundColor Yellow
    Write-Host "L'Utilita' di pianificazione riavviera' comunque l'applicazione, ma il"
    Write-Host "file .bat lo fa in cinque secondi invece che in un minuto."
    Write-Host ""
}

# Ritardo di venti secondi: all'accesso il desktop non è ancora pronto e una
# finestra a schermo intero aperta troppo presto può finire dietro le altre.
$trigger = New-ScheduledTaskTrigger -AtLogOn
$trigger.Delay = "PT20S"

$impostazioni = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew

if (Get-ScheduledTask -TaskName $NomeAttivita -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $NomeAttivita -Confirm:$false
    Write-Host "Attivita preesistente sostituita."
}

Register-ScheduledTask `
    -TaskName $NomeAttivita `
    -Description "Avvia l'installazione Kandinsky Lab e la riavvia se si chiude." `
    -Action $azione `
    -Trigger $trigger `
    -Settings $impostazioni `
    -RunLevel Limited | Out-Null

Write-Host ""
Write-Host "Avvio automatico configurato." -ForegroundColor Green
Write-Host "  parte all'accesso dell'utente, dopo 20 secondi"
Write-Host "  si riavvia da sola entro un minuto se si chiude"
Write-Host ""
Write-Host "Da completare a mano sulla macchina di sala:" -ForegroundColor Yellow
Write-Host "  1. accesso automatico a Windows, o all'accensione resta la schermata di login"
Write-Host "  2. sospensione e spegnimento schermo disattivati"
Write-Host "  3. riavvii automatici di Windows Update fuori dall'orario di apertura"
Write-Host ""
Write-Host "Per provare subito:  Start-ScheduledTask -TaskName '$NomeAttivita'"
Write-Host "Per rimuovere:       .\installa-avvio-automatico.ps1 -Rimuovi"
