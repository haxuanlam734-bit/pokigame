$content = Get-Content 'src/combat/grenade.js' -Raw
$open = ([regex]::Matches($content, '\{')).Count
$close = ([regex]::Matches($content, '\}')).Count
Write-Host ("grenade.js braces: open=$open close=$close")
