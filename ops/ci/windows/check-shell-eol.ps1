$ErrorActionPreference = "Stop"
$Failed = $false

$TrackedShellScripts = & git ls-files --cached --others --exclude-standard "*.sh"
if ($LASTEXITCODE -ne 0) {
    throw "Could not list tracked shell scripts."
}

foreach ($File in $TrackedShellScripts) {
    $Path = Join-Path (Get-Location) $File
    if (-not (Test-Path -LiteralPath $Path)) { continue }
    $Bytes = [System.IO.File]::ReadAllBytes($Path)
    if ($Bytes -contains 13) {
        Write-Output "::error file=${File}::Tracked shell script contains CR bytes"
        $Failed = $true
    }
}

if ($Failed) {
    exit 1
}
