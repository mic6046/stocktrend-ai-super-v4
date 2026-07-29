# Interactive Stripe secret updater for Quantum Node Cloud Run
# You will be prompted to paste values. Nothing is sent to chat.

$ErrorActionPreference = 'Stop'
$Project = 'stocktrend-ai-super'
$Region = 'us-central1'
$Service = 'stocktrend-ai'
$SA = '357117913612-compute@developer.gserviceaccount.com'

Write-Host ''
Write-Host '=== Quantum Node · Stripe Cloud Run setup ===' -ForegroundColor Cyan
Write-Host 'Paste each value when asked, then press Enter.'
Write-Host 'Webhook URL should already be:'
Write-Host '  https://stocktrend-ai-357117913612.us-central1.run.app/api/stripe/webhook' -ForegroundColor Yellow
Write-Host ''

$STRIPE_SECRET_KEY = Read-Host '1) STRIPE_SECRET_KEY (sk_test_... or sk_live_...)'
$STRIPE_WEBHOOK_SECRET = Read-Host '2) STRIPE_WEBHOOK_SECRET (whsec_...)'
$STRIPE_PRICE_MONTHLY = Read-Host '3) STRIPE_PRICE_MONTHLY Basic RM199 (price_...)'
$STRIPE_PRICE_PRO_MONTHLY = Read-Host '4) STRIPE_PRICE_PRO_MONTHLY Pro RM349 (price_...)'

if (-not $STRIPE_SECRET_KEY.StartsWith('sk_')) { throw 'Secret key must start with sk_' }
if (-not $STRIPE_WEBHOOK_SECRET.StartsWith('whsec_')) { throw 'Webhook secret must start with whsec_' }
if (-not $STRIPE_PRICE_MONTHLY.StartsWith('price_')) { throw 'Basic price id must start with price_' }
if (-not $STRIPE_PRICE_PRO_MONTHLY.StartsWith('price_')) { throw 'Pro price id must start with price_' }

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
}

Write-Host ''
Write-Host 'Saving secrets to Google Secret Manager...' -ForegroundColor Cyan
Set-Secret 'STRIPE_SECRET_KEY' $STRIPE_SECRET_KEY
Set-Secret 'STRIPE_WEBHOOK_SECRET' $STRIPE_WEBHOOK_SECRET

Write-Host 'Updating Cloud Run service...' -ForegroundColor Cyan
gcloud run services update $Service `
  --region=$Region `
  --project=$Project `
  --update-secrets=STRIPE_SECRET_KEY=STRIPE_SECRET_KEY:latest,STRIPE_WEBHOOK_SECRET=STRIPE_WEBHOOK_SECRET:latest `
  --update-env-vars="STRIPE_PRICE_MONTHLY=$STRIPE_PRICE_MONTHLY,STRIPE_PRICE_PRO_MONTHLY=$STRIPE_PRICE_PRO_MONTHLY,APP_URL=https://stocktrend-ai-super.web.app,FIREBASE_PROJECT_ID=stocktrend-ai-super"

Write-Host ''
Write-Host 'DONE.' -ForegroundColor Green
Write-Host '1) Hard-refresh https://stocktrend-ai-super.web.app'
Write-Host '2) Sign in and try Subscribe again'
Write-Host ''
Write-Host 'Press Enter to close...'
Read-Host | Out-Null
