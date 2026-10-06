# Firma UN archivo de Windows a nombre de CLOSELABS LLC.
#
# Lo llama Tauri (`bundle.windows.signCommand`, armado en build.yml) por cada archivo que firma: el
# .exe de la app, nuestras DLL (transcribe/ggml; las de Microsoft ya vienen firmadas y Tauri las
# salta), los plugins de NSIS, el desinstalador y los dos instaladores. Por eso es un script y no
# una línea: así hay UN solo lugar que decide con qué se firma, y UNA comprobación al final.
#
# Proveedor (variable FIRMA_WINDOWS, la pone build.yml):
#   azure  — Azure Artifact Signing con `artifact-signing-cli` (credenciales AZURE_*).
#   sslcom — SSL.com eSigner con CodeSignTool (credenciales ES_*). Es el respaldo si Azure no
#            valida la LLC. ⚠️ Nunca se ha corrido contra SSL.com: probarlo en los 30 días gratis.
#
# ⚠️ La comprobación del final NO es opcional. CodeSignTool puede terminar con código 0 aunque no
# haya firmado, y un instalador que parece firmado y no lo está es lo peor que puede salir de aquí:
# el médico ve "editor desconocido" y nadie se entera. Se exige, archivo por archivo:
#   1. firma válida,
#   2. a nombre de FIRMA_PUBLISHER (CLOSELABS LLC),
#   3. con sello de tiempo — sin él, la firma muere el día que vence el certificado y todos los
#      instaladores ya entregados pasan a "editor desconocido".

param([Parameter(Mandatory = $true)][string]$Archivo)

$ErrorActionPreference = 'Stop'

switch ($env:FIRMA_WINDOWS) {
  'azure' {
    & artifact-signing-cli `
      -e $env:AZURE_SIGNING_ENDPOINT `
      -a $env:AZURE_SIGNING_ACCOUNT `
      -c $env:AZURE_SIGNING_PROFILE `
      -d 'CloseLabs Voice' `
      $Archivo
  }
  'sslcom' {
    # Se llama a Java directamente y no a CodeSignTool.bat: el .bat pasa por cmd.exe, que se come
    # caracteres como & ^ % de la contraseña. El JAR lee su configuración de conf/, relativa a su
    # carpeta: por eso el Push-Location.
    Push-Location $env:CODESIGNTOOL_DIR
    try {
      & $env:CODESIGNTOOL_JAVA -jar $env:CODESIGNTOOL_JAR sign `
        "-username=$env:ES_USERNAME" `
        "-password=$env:ES_PASSWORD" `
        "-credential_id=$env:ES_CREDENTIAL_ID" `
        "-totp_secret=$env:ES_TOTP_SECRET" `
        "-input_file_path=$Archivo" `
        '-override=true'
    } finally {
      Pop-Location
    }
  }
  default {
    throw "FIRMA_WINDOWS='$env:FIRMA_WINDOWS': se esperaba 'azure' o 'sslcom'."
  }
}
if ($LASTEXITCODE -ne 0) { throw "Firmar $Archivo terminó con código $LASTEXITCODE." }

$firma = Get-AuthenticodeSignature -LiteralPath $Archivo
if ($firma.Status -ne 'Valid') {
  throw "$Archivo no quedó firmado: $($firma.Status) — $($firma.StatusMessage)"
}
if ($firma.SignerCertificate.Subject -notlike "*CN=$env:FIRMA_PUBLISHER*") {
  throw "$Archivo quedó firmado a nombre de otro: $($firma.SignerCertificate.Subject)"
}
if (-not $firma.TimeStamperCertificate) {
  throw "$Archivo quedó firmado SIN sello de tiempo: dejaría de valer cuando venza el certificado."
}

# Registro para contar cuántas firmas gasta cada build (SSL.com da 20 al mes).
Add-Content -LiteralPath $env:FIRMA_REGISTRO -Value $Archivo
Write-Host "Firmado: $Archivo"
