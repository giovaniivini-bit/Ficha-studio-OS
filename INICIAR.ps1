$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (Test-Path -LiteralPath '.env.local') {
    foreach ($line in Get-Content -LiteralPath '.env.local') {
        if ($line -match '^([A-Z][A-Z0-9_]*)=(.*)$') {
            $configName = $Matches[1]
            $configValue = $Matches[2].Trim().Trim('"').Trim("'")
            [Environment]::SetEnvironmentVariable($configName, $configValue, 'Process')
        }
    }
}
pnpm dev
