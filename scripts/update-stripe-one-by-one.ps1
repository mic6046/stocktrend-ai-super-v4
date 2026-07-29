# Update ONE Stripe setting at a time for Quantum Node Cloud Run

$ErrorActionPreference = 'Stop'
$Project = 'stocktrend-ai-super'
$Region = 'us-central1'
$Service = 'stocktrend-ai'
$SA = '357117913612-compute@developer.gserviceaccount.com'

function Set-Secret([string]$name, [string]$value) {
  $tmp = New-TemporaryFile
  try {
    [System.IO.File]::WriteAllText($tmp.FullName, $value)
    gcloud secrets describe $name --project=$Project 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
      Write-Host "Updating secret $name ..."
      gcloud secrets versions add $name --data-file=$tmp.FullName --project=$Project | Out-Null
    } else {
      Write-Host "Creating secret $name ..."
      gcloud secrets create $name --data-file=$tmp.FullName --project=$Project | Out-Null
    }
  } finally {
    Remove-Item $tmp.FullName -Force -ErrorAction SilentlyContinue
  }
  gcloud secrets add-iam-policy-binding $name `
    --member="serviceAccount:$SA" `
    --role='roles/secretmanager.secretAccessor' `
    --project=$Project 2>$null | Out-Null
  Write-Host "OK: $name saved." -ForegroundColor Green
}

function Set-Env([string]$name, [string]$value) {
  Write-Host "Updating Cloud Run env $name ..."
  gcloud run services update $Service `
    --region=$Region `
    --project=$Project `
    --update-env-vars="$name=$value" | Out-Null
  Write-Host "OK: $name set on Cloud Run." -ForegroundColor Green
}

function Attach-SecretEnv([string]$envName, [string]$secretName) {
  Write-Host "Attaching secret $secretName to Cloud Run as $envName ..."
  gcloud run services update $Service `
    --region=$Region `
    --project=$Project `
    --update-secrets="$envName=$secretName:latest" | Out-Null
  Write-Host "OK: $envName attached." -ForegroundColor Green
}

while ($true) {
  Write-Host ''
  Write-Host '=== Update ONE Stripe setting ===' -ForegroundColor Cyan
  Write-Host '1) STRIPE_SECRET_KEY        (sk_test_... / sk_live_...)'
  Write-Host '2) STRIPE_WEBHOOK_SECRET    (whsec_...)'
  Write-Host '3) STRIPE_PRICE_MONTHLY     Basic RM199 (price_...)'
  Write-Host '4) STRIPE_PRICE_PRO_MONTHLY Pro RM349 (price_...)'
  Write-Host '5) Show what is configured (no secret values)'
  Write-Host '0) Exit'
  Write-Host ''
  $choice = Read-Host 'Choose 0-5'

  switch ($choice) {
    '1' {
      $v = Read-Host 'Paste STRIPE_SECRET_KEY'
      if (-not $v.StartsWith('sk_')) { Write-Host 'Must start with sk_' -ForegroundColor Red; break }
      Set-Secret 'STRIPE_SECRET_KEY' $v
      Attach-SecretEnv 'STRIPE_SECRET_KEY' 'STRIPE_SECRET_KEY'
    }
    '2' {
      $v = Read-Host 'Paste STRIPE_WEBHOOK_SECRET'
      if (-not $v.StartsWith('whsec_')) { Write-Host 'Must start with whsec_' -ForegroundColor Red; break }
      Set-Secret 'STRIPE_WEBHOOK_SECRET' $v
      Attach-SecretEnv 'STRIPE_WEBHOOK_SECRET' 'STRIPE_WEBHOOK_SECRET'
    }
    '3' {
      $v = Read-Host 'Paste STRIPE_PRICE_MONTHLY (Basic)'
      if (-not $v.StartsWith('price_')) { Write-Host 'Must start with price_' -ForegroundColor Red; break }
      Set-Env 'STRIPE_PRICE_MONTHLY' $v
    }
    '4' {
      $v = Read-Host 'Paste STRIPE_PRICE_PRO_MONTHLY (Pro)'
      if (-not $v.StartsWith('price_')) { Write-Host 'Must start with price_' -ForegroundColor Red; break }
      Set-Env 'STRIPE_PRICE_PRO_MONTHLY' $v
    }
    '5' {
      Write-Host ''
      gcloud run services describe $Service --region=$Region --project=$Project --format="yaml(spec.template.spec.containers[0].env)" |
        Select-String -Pattern 'STRIPE|APP_URL|FIREBASE_PROJECT_ID'
      Write-Host ''
    }
    '0' {
      Write-Host 'Bye.'
      break
    }
    default {
      Write-Host 'Invalid choice.' -ForegroundColor Yellow
    }
  }

  if ($choice -eq '0') { break }
}

Write-Host 'Press Enter to close...'
Read-Host | Out-Null
