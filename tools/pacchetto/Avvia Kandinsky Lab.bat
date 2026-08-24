@echo off
rem ===========================================================================
rem  Kandinsky Lab - avvio con rilancio automatico
rem
rem  Tiene l'applicazione accesa: se si chiude per un guasto, la riapre dopo
rem  qualche secondo. In una sala museale e' la differenza fra un'installazione
rem  che funziona tutto il giorno e uno schermo con il desktop di Windows
rem  davanti ai visitatori.
rem
rem  Per chiudere davvero: Ctrl+Alt+Maiusc+Q dentro l'applicazione.
rem  Quella combinazione lascia un segnale che ferma anche questo ciclo.
rem ===========================================================================

setlocal
cd /d "%~dp0"
title Kandinsky Lab

rem I dati stanno accanto all'applicazione: la cartella e' copiabile su un
rem altro computer portandosi dietro configurazione, opere e coda di invio.
set "KANDINSKY_DATA_DIR=%~dp0dati"
if not exist "%KANDINSKY_DATA_DIR%" mkdir "%KANDINSKY_DATA_DIR%"

set "SEGNALE=%KANDINSKY_DATA_DIR%\.uscita-richiesta"
if exist "%SEGNALE%" del /q "%SEGNALE%"

set "APP=%~dp0Kandinsky Lab.exe"
if not exist "%APP%" (
    echo.
    echo  Non trovo "Kandinsky Lab.exe" in questa cartella.
    echo  Il file di avvio deve stare accanto all'applicazione.
    echo.
    pause
    exit /b 1
)

:ciclo
echo [%date% %time%] avvio dell'applicazione
start /wait "" "%APP%"

if exist "%SEGNALE%" (
    del /q "%SEGNALE%"
    echo [%date% %time%] chiusura richiesta dall'operatore
    goto fine
)

echo [%date% %time%] l'applicazione si e' chiusa, riapertura fra 5 secondi
timeout /t 5 /nobreak >nul
goto ciclo

:fine
endlocal
