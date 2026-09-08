#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Antigravity Shield - Local Build & GitHub Release Script
.DESCRIPTION
    1. Bumps version in package.json, tauri.conf.json, Cargo.toml
    2. Builds the Windows NSIS installer locally
    3. Creates git commit + tag
    4. Pushes to GitHub
    5. Uploads the .exe, .sig, and updater.json to the GitHub Release

.PARAMETER Version
    The version to release (e.g. "5.0.4"). Required.
.PARAMETER Token
    GitHub Personal Access Token (PAT) with repo scope. If not provided, will prompt.
.PARAMETER SkipBuild
    Skip the Tauri build step (useful if you already built manually).
.PARAMETER DryRun
    Show what would happen without actually doing it.

.EXAMPLE
    .\scripts\release-local.ps1 -Version "5.0.4"
    .\scripts\release-local.ps1 -Version "5.0.4" -Token "ghp_xxxxx"
    .\scripts\release-local.ps1 -Version "5.0.4" -SkipBuild
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$Version,

    [Parameter(Mandatory=$false)]
    [string]$Token = "",

    [switch]$SkipBuild,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$REPO = "DoctorGuidance/Antigravity-Shield"
$TAG  = "v$Version"
$ROOT = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Antigravity Shield Local Release Script" -ForegroundColor Cyan
Write-Host "  Version : $TAG" -ForegroundColor Cyan
Write-Host "  Repo    : $REPO" -ForegroundColor Cyan
if ($DryRun) { Write-Host "  [DRY RUN MODE]" -ForegroundColor Yellow }
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ── 0. Get GitHub Token ──────────────────────────────────────────────────────
if (-not $Token) {
    $Token = Read-Host "Enter GitHub Personal Access Token (PAT) with repo scope"
}
if (-not $Token) {
    Write-Error "GitHub token is required to upload release assets."
    exit 1
}

$headers = @{
    Authorization = "Bearer $Token"
    Accept        = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
}

# ── 1. Bump Versions ─────────────────────────────────────────────────────────
Write-Host "► Step 1: Bumping version to $Version..." -ForegroundColor Green

if (-not $DryRun) {
    Push-Location $ROOT

    # package.json
    $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
    $pkg.version = $Version
    $pkg | ConvertTo-Json -Depth 10 | Set-Content "package.json" -Encoding UTF8
    Write-Host "  ✓ package.json → $Version"

    # tauri.conf.json
    $tauri = Get-Content "src-tauri/tauri.conf.json" -Raw | ConvertFrom-Json
    $tauri.version = $Version
    $tauri | ConvertTo-Json -Depth 20 | Set-Content "src-tauri/tauri.conf.json" -Encoding UTF8
    Write-Host "  ✓ tauri.conf.json → $Version"

    # Cargo.toml (sed-style replacement)
    $cargo = Get-Content "src-tauri/Cargo.toml" -Raw
    $cargo = $cargo -replace '(?m)^version = "\d+\.\d+\.\d+"', "version = `"$Version`""
    Set-Content "src-tauri/Cargo.toml" $cargo -Encoding UTF8
    Write-Host "  ✓ Cargo.toml → $Version"

    Pop-Location
} else {
    Write-Host "  [DRY RUN] Would bump version to $Version in package.json, tauri.conf.json, Cargo.toml"
}

# ── 2. Build NSIS Installer ──────────────────────────────────────────────────
if (-not $SkipBuild) {
    Write-Host ""
    Write-Host "► Step 2: Building Windows NSIS installer locally (this takes ~15 min)..." -ForegroundColor Green

    if (-not $DryRun) {
        Push-Location $ROOT
        $env:TAURI_SIGNING_PRIVATE_KEY = ""
        $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""

        # Disable updater artifacts if no signing key
        $tauriConf = Get-Content "src-tauri/tauri.conf.json" -Raw | ConvertFrom-Json
        if ($tauriConf.bundle) {
            $tauriConf.bundle.createUpdaterArtifacts = $false
        }
        $tauriConf | ConvertTo-Json -Depth 20 | Set-Content "src-tauri/tauri.conf.json" -Encoding UTF8

        npm run tauri build -- --bundles nsis
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Tauri build failed with exit code $LASTEXITCODE"
            exit 1
        }
        Pop-Location
    } else {
        Write-Host "  [DRY RUN] Would run: npm run tauri build -- --bundles nsis"
    }
} else {
    Write-Host "► Step 2: Skipped build (--SkipBuild)" -ForegroundColor Yellow
}

# ── 3. Find Build Artifacts ──────────────────────────────────────────────────
Write-Host ""
Write-Host "► Step 3: Locating build artifacts..." -ForegroundColor Green

$nsisDir = Join-Path $ROOT "src-tauri\target\release\bundle\nsis"
$exeFile = Get-ChildItem -Path $nsisDir -Filter "*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
$sigFile = Get-ChildItem -Path $nsisDir -Filter "*.sig" -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $exeFile -and -not $DryRun) {
    Write-Error "No .exe found in $nsisDir - did the build succeed?"
    exit 1
}

$exePath = if ($exeFile) { $exeFile.FullName } else { "$nsisDir\Antigravity.Shield_${Version}_x64-setup.exe" }
$sigPath = if ($sigFile) { $sigFile.FullName } else { "" }

Write-Host "  ✓ Installer : $($exeFile?.Name ?? '[not found yet]')"
Write-Host "  ✓ Signature : $($sigFile?.Name ?? '[none]')"

# ── 4. Copy to project root ──────────────────────────────────────────────────
Write-Host ""
Write-Host "► Step 4: Copying installer to project root..." -ForegroundColor Green

if (-not $DryRun -and $exeFile) {
    $destExe = Join-Path $ROOT "Antigravity.Shield_${Version}_x64-setup.exe"
    Copy-Item -Path $exePath -Destination $destExe -Force
    Write-Host "  ✓ Copied to: $destExe"
}

# ── 5. Git Commit + Tag + Push ───────────────────────────────────────────────
Write-Host ""
Write-Host "► Step 5: Git commit, tag, and push..." -ForegroundColor Green

if (-not $DryRun) {
    Push-Location $ROOT
    git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json CHANGELOG.md CHANGELOG_EN.md
    git commit -m "release: bump version to $Version"
    git tag -a $TAG -m "Release $TAG"
    git push origin main
    git push origin $TAG
    Pop-Location
    Write-Host "  ✓ Pushed commit and tag $TAG to origin"
} else {
    Write-Host "  [DRY RUN] Would commit, tag $TAG, and push to origin"
}

# ── 6. Get or Create GitHub Release ─────────────────────────────────────────
Write-Host ""
Write-Host "► Step 6: Creating/finding GitHub Release for $TAG..." -ForegroundColor Green

Start-Sleep -Seconds 5  # Give GitHub a moment after tag push

$releaseUrl = "https://api.github.com/repos/$REPO/releases/tags/$TAG"
$release = $null

try {
    $release = Invoke-RestMethod -Uri $releaseUrl -Headers $headers -Method Get
    Write-Host "  ✓ Found existing release (id: $($release.id))"
} catch {
    # Create it
    Write-Host "  Creating new release for $TAG..."

    # Extract release notes from CHANGELOG.md
    $changelog = Get-Content (Join-Path $ROOT "CHANGELOG_EN.md") -Raw
    $notes = "# Antigravity Shield $TAG`n`n"
    $inSection = $false
    foreach ($line in $changelog -split "`n") {
        if ($line -match "^\s*[*+-]\s+\*\*$([regex]::Escape($TAG))") {
            $inSection = $true; continue
        }
        if ($inSection -and $line -match "^\s*[*+-]\s+\*\*v") { break }
        if ($inSection) {
            $trimmed = $line -replace "^        ", ""
            $notes += "$trimmed`n"
        }
    }

    if (-not $DryRun) {
        $body = @{
            tag_name   = $TAG
            name       = "Antigravity Shield $TAG"
            body       = $notes.Trim()
            draft      = $false
            prerelease = $false
        } | ConvertTo-Json -Depth 5

        $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$REPO/releases" `
            -Headers $headers -Method Post -Body $body -ContentType "application/json"
        Write-Host "  ✓ Created release id: $($release.id)"
    } else {
        Write-Host "  [DRY RUN] Would create GitHub release for $TAG"
    }
}

# ── 7. Upload Assets ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host "► Step 7: Uploading assets to GitHub Release..." -ForegroundColor Green

function Upload-Asset {
    param([string]$FilePath, [string]$ReleaseId)

    if (-not (Test-Path $FilePath)) {
        Write-Host "  ⚠ Skipping (not found): $FilePath" -ForegroundColor Yellow
        return
    }

    $fileName = Split-Path -Leaf $FilePath
    $uploadUrl = "https://uploads.github.com/repos/$REPO/releases/$ReleaseId/assets?name=$fileName"

    Write-Host "  Uploading $fileName..."

    if (-not $DryRun) {
        $uploadHeaders = $headers.Clone()
        $uploadHeaders["Content-Type"] = "application/octet-stream"

        $bytes = [System.IO.File]::ReadAllBytes($FilePath)
        Invoke-RestMethod -Uri $uploadUrl -Headers $uploadHeaders -Method Post -Body $bytes | Out-Null
        Write-Host "  ✓ Uploaded: $fileName" -ForegroundColor Green
    } else {
        Write-Host "  [DRY RUN] Would upload: $fileName"
    }
}

if ($release) {
    Upload-Asset -FilePath $exePath -ReleaseId $release.id
    if ($sigPath) { Upload-Asset -FilePath $sigPath -ReleaseId $release.id }
} else {
    Write-Host "  ⚠ No release found, skipping upload." -ForegroundColor Yellow
}

# ── Done ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  ✅ Release $TAG complete!" -ForegroundColor Green
Write-Host "  https://github.com/$REPO/releases/tag/$TAG" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
