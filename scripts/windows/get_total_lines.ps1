[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

function Get-RepositoryRoot {
    $Root = & git -C $PSScriptRoot rev-parse --show-toplevel
    if ($LASTEXITCODE -ne 0 -or -not $Root) {
        throw "Run this script from inside a Git repository."
    }

    return $Root.Trim()
}

function Get-ProjectFiles {
    param(
        [Parameter(Mandatory)]
        [string] $RepositoryRoot
    )

    $Files = & git -C $RepositoryRoot ls-files --cached --others --exclude-standard
    if ($LASTEXITCODE -ne 0) {
        throw "Could not list project files."
    }

    $IgnoredTrackedFiles = & git -C $RepositoryRoot ls-files `
        --cached `
        --ignored `
        --exclude-standard
    if ($LASTEXITCODE -ne 0) {
        throw "Could not evaluate ignored tracked files."
    }

    $IgnoredTracked = [System.Collections.Generic.HashSet[string]]::new(
        [System.StringComparer]::OrdinalIgnoreCase
    )
    foreach ($IgnoredFile in $IgnoredTrackedFiles) {
        [void] $IgnoredTracked.Add($IgnoredFile)
    }

    return $Files | Where-Object {
        $_ -and
        -not $IgnoredTracked.Contains($_) -and
        [System.IO.Path]::GetFileName($_) -notin @(
            "package.json"
            "package-lock.json"
        ) -and
        (Test-Path -LiteralPath (Join-Path $RepositoryRoot $_) -PathType Leaf)
    }
}

function Test-BinaryFile {
    param(
        [Parameter(Mandatory)]
        [string] $Path
    )

    $Stream = [System.IO.File]::OpenRead($Path)
    try {
        $Buffer = [byte[]]::new(8192)
        while (($BytesRead = $Stream.Read($Buffer, 0, $Buffer.Length)) -gt 0) {
            for ($Index = 0; $Index -lt $BytesRead; $Index++) {
                if ($Buffer[$Index] -eq 0) {
                    return $true
                }
            }
        }
    }
    finally {
        $Stream.Dispose()
    }

    return $false
}

function Get-LineCount {
    param(
        [Parameter(Mandatory)]
        [string] $Path
    )

    $Count = 0
    $Reader = [System.IO.File]::OpenText($Path)
    try {
        while ($null -ne $Reader.ReadLine()) {
            $Count++
        }
    }
    finally {
        $Reader.Dispose()
    }

    return $Count
}

function Get-ExtensionLabel {
    param(
        [Parameter(Mandatory)]
        [string] $Path
    )

    $Name = [System.IO.Path]::GetFileName($Path)
    $Extension = [System.IO.Path]::GetExtension($Name)

    if ($Extension) {
        return $Extension.ToLowerInvariant()
    }

    if ($Name.StartsWith(".")) {
        return $Name.ToLowerInvariant()
    }

    return "<none>"
}

function Format-Count {
    param(
        [Parameter(Mandatory)]
        [long] $Value
    )

    return $Value.ToString("N0")
}

$RepositoryRoot = Get-RepositoryRoot
$Records = foreach ($RelativePath in Get-ProjectFiles -RepositoryRoot $RepositoryRoot) {
    $AbsolutePath = Join-Path $RepositoryRoot $RelativePath
    if (Test-BinaryFile -Path $AbsolutePath) {
        continue
    }

    [pscustomobject]@{
        Extension = Get-ExtensionLabel -Path $RelativePath
        Lines = Get-LineCount -Path $AbsolutePath
        File = $RelativePath.Replace("\", "/")
    }
}

if (-not $Records) {
    Write-Output "No non-ignored text files were found."
    exit 0
}

$ExtensionTotals = $Records |
    Group-Object Extension |
    ForEach-Object {
        [pscustomobject]@{
            Extension = $_.Name
            Files = $_.Count
            Lines = ($_.Group | Measure-Object Lines -Sum).Sum
        }
    } |
    Sort-Object `
        @{ Expression = "Lines"; Descending = $true },
        @{ Expression = "Extension"; Descending = $false }

$TotalLines = ($Records | Measure-Object Lines -Sum).Sum
$LargestExtension = $ExtensionTotals | Select-Object -First 1

Write-Output ("=" * 72)
Write-Output "SEMANTIX PROJECT LINE REPORT"
Write-Output ("=" * 72)
Write-Output "Scope: Git-tracked and unignored text files"
Write-Output "Excluded: binary files, package.json, and package-lock.json"
Write-Output "Files: $(Format-Count -Value $Records.Count)"
Write-Output "Lines: $(Format-Count -Value $TotalLines)"
Write-Output (
    "Largest extension: {0} ({1} lines)" -f
    $LargestExtension.Extension,
    (Format-Count -Value $LargestExtension.Lines)
)
Write-Output ""
Write-Output "EXTENSION SUMMARY"
Write-Output ("-" * 72)

$SummaryRows = $ExtensionTotals | ForEach-Object {
    [pscustomobject]@{
        Extension = $_.Extension
        Files = $_.Files
        Lines = $_.Lines
        Share = "{0:P1}" -f ($_.Lines / $TotalLines)
    }
}

Write-Output (
    $SummaryRows |
        Format-Table `
            Extension,
            @{ Label = "Files"; Expression = { $_.Files }; FormatString = "N0"; Alignment = "Right" },
            @{ Label = "Lines"; Expression = { $_.Lines }; FormatString = "N0"; Alignment = "Right" },
            @{ Label = "Share"; Expression = { $_.Share }; Alignment = "Right" } `
            -AutoSize |
        Out-String -Width 4096
).Trim()

foreach ($Extension in $ExtensionTotals | Sort-Object Extension) {
    $FileLabel = if ($Extension.Files -eq 1) { "file" } else { "files" }
    Write-Output ""
    Write-Output (
        "[{0}] {1} {2} | {3} lines" -f
        $Extension.Extension.ToUpperInvariant(),
        (Format-Count -Value $Extension.Files),
        $FileLabel,
        (Format-Count -Value $Extension.Lines)
    )
    Write-Output ("-" * 72)

    $Rows = $Records |
        Where-Object Extension -eq $Extension.Extension |
        Sort-Object `
            @{ Expression = "Lines"; Descending = $true },
            @{ Expression = "File"; Descending = $false }

    Write-Output (
        $Rows |
            Format-Table `
                @{ Label = "Lines"; Expression = { $_.Lines }; FormatString = "N0"; Alignment = "Right" },
                File `
                -AutoSize |
            Out-String -Width 4096
    ).Trim()
}
