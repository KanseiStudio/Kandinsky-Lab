<#
.SYNOPSIS
    Assembla il pacchetto da copiare sulla postazione di sala.

.DESCRIPTION
    Compila l'esperienza, impacchetta l'applicazione in versione portabile e
    raccoglie tutto in una cartella autosufficiente: eseguibile, file di avvio
    con rilancio automatico, istruzioni e script per l'avvio all'accensione.

    Il risultato si copia su qualsiasi computer Windows e funziona senza
    installazione. I dati (configurazione, opere, coda) restano dentro la
    cartella, quindi si spostano insieme a essa.

.PARAMETER Destinazione
    Cartella di uscita. Predefinita: apps\shell\release\Kandinsky Lab

.PARAMETER SaltaCompilazione
    Riusa la compilazione esistente invece di rifarla.

.EXAMPLE
    .\tools\crea-pacchetto-sala.ps1
    .\tools\crea-pacchetto-sala.ps1 -Destinazione "D:\Consegne\Kandinsky Lab"
#>
param(
    [string]$Destinazione,
    [switch]$SaltaCompilazione
)

$ErrorActionPreference = "Stop"

$radice = Split-Path -Parent $PSScriptRoot
Set-Location $radice

if (-not $Destinazione) {
    $Destinazione = Join-Path $radice "apps\shell\release\Kandinsky Lab"
}

Write-Host ""
Write-Host "  Pacchetto di sala" -ForegroundColor Cyan
Write-Host "  destinazione: $Destinazione"
Write-Host ""

# --- 1. Compilazione --------------------------------------------------------
if (-not $SaltaCompilazione) {
    Write-Host "[1/4] compilazione dell'esperienza e dell'applicazione..."

    # Se il download automatico di Electron non funziona su questa macchina,
    # si riusa il binario già estratto indicato dalla variabile d'ambiente.
    if ($env:ELECTRON_OVERRIDE_DIST_PATH) {
        Write-Host "      uso il binario Electron in $env:ELECTRON_OVERRIDE_DIST_PATH"
        pnpm --filter '@kandinsky/kiosk' build
        pnpm --filter '@kandinsky/shell' pack:win:locale
    } else {
        pnpm app:win
    }
    if ($LASTEXITCODE -ne 0) { throw "compilazione fallita" }
} else {
    Write-Host "[1/4] compilazione saltata"
}

# --- 2. Individuazione dell'eseguibile portabile ---------------------------
Write-Host "[2/4] raccolta dei file..."

$release = Join-Path $radice "apps\shell\release"
$portabile = Get-ChildItem $release -Filter "*.exe" -File |
    Where-Object { $_.Name -notmatch "Setup" } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $portabile) {
    throw "Nessun eseguibile portabile trovato in $release. Controllare l'esito della compilazione."
}

if (Test-Path $Destinazione) {
    # Le cartelle "dati" esistenti NON vengono toccate: conterrebbero
    # configurazione e opere di una postazione già in funzione.
    Get-ChildItem $Destinazione -Exclude "dati" | Remove-Item -Recurse -Force
} else {
    New-Item -ItemType Directory -Path $Destinazione -Force | Out-Null
}

Copy-Item $portabile.FullName (Join-Path $Destinazione "Kandinsky Lab.exe") -Force
Copy-Item (Join-Path $PSScriptRoot "pacchetto\*") $Destinazione -Force
Copy-Item (Join-Path $PSScriptRoot "installa-avvio-automatico.ps1") $Destinazione -Force

# --- 3. Verifica ------------------------------------------------------------
Write-Host "[3/4] verifica..."

$attesi = @("Kandinsky Lab.exe", "Avvia Kandinsky Lab.bat", "LEGGIMI.txt")
$mancanti = $attesi | Where-Object { -not (Test-Path (Join-Path $Destinazione $_)) }
if ($mancanti) { throw "Mancano dal pacchetto: $($mancanti -join ', ')" }

$peso = (Get-ChildItem $Destinazione -Recurse -File | Measure-Object Length -Sum).Sum / 1MB

# --- 4. Riepilogo -----------------------------------------------------------
Write-Host "[4/4] fatto." -ForegroundColor Green
Write-Host ""
Write-Host "  $Destinazione"
Get-ChildItem $Destinazione | ForEach-Object { Write-Host "    $($_.Name)" }
Write-Host ""
Write-Host ("  peso complessivo: {0:N0} MB" -f $peso)
Write-Host ""
Write-Host "  Sulla postazione di sala:" -ForegroundColor Yellow
Write-Host "    1. copiare la cartella in un percorso scrivibile (non Programmi)"
Write-Host "    2. doppio clic su 'Avvia Kandinsky Lab.bat'"
Write-Host "    3. chiudere con Ctrl+Alt+Maiusc+Q e compilare dati\kandinsky.config.json"
Write-Host "    4. per l'avvio all'accensione:"
Write-Host "       .\installa-avvio-automatico.ps1 -Percorso '<cartella>\Avvia Kandinsky Lab.bat'"
Write-Host ""
