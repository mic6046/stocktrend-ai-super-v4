# Quantum Node · Switch Stripe to LIVE on Cloud Run
# Run from project root:
#   powershell -ExecutionPolicy Bypass -File .\scripts\go-stripe-live.ps1
#
# You will paste Live values locally. Nothing is sent to chat.

$ErrorActionPreference = 'Stop'
$Project = 'stocktrend-ai-super'
$Region = 'us-central1'
$Service = 'stocktrend-ai'
$SA = '357117913612-compute@developer.gserviceaccount.com'
$AppUrl = 'https://stocktrend-ai-super.web.app'
$WebhookUrl = 'https://stocktrend-ai-357117913612.us-central1.run.app/api/stripe/webhook'

Write-Host ''
Write-Host '=== Quantum Node · Stripe LIVE setup ===' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Before pasting values, finish these in Stripe Dashboard (LIVE mode ON):' -ForegroundColor Yellow
Write-Host '  1) Activate your Stripe account for Live payments'
Write-Host '  2) Create Products + Prices:'
Write-Host '       - Basic subscription  RM 199 / month  (recurring)'
Write-Host '       - Pro subscription    RM 349 / month  (recurring)'
Write-Host '       - Optional: AI analysis pack RM 10 (one-time)'
Write-Host '  3) Developers → API keys → copy Secret key (sk_live_...)'
Write-Host '  4) Developers → Webhooks → Add endpoint:'
Write-Host "       $WebhookUrl" -ForegroundColor Green
Write-Host '     Enable events:'
Write-Host '       - checkout.session.completed'
Write-Host '       - customer.subscription.created'
Write-Host '       - customer.subscription.updated'
Write-Host '       - customer.subscription.deleted'
Write-Host '     Copy Signing secret (whsec_...)'
Write-Host ''
Write-Host 'Press Enter when you have all Live values ready...'
Read-Host | Out-Null

$STRIPE_SECRET_KEY = Read-Host '1) STRIPE_SECRET_KEY (must be sk_live_...)'
$STRIPE_WEBHOOK_SECRET = Read-Host '2) STRIPE_WEBHOOK_SECRET (Live whsec_...)'
$STRIPE_PRICE_MONTHLY = Read-Host '3) STRIPE_PRICE_MONTHLY Basic RM199 Live price_...'
$STRIPE_PRICE_PRO_MONTHLY = Read-Host '4) STRIPE_PRICE_PRO_MONTHLY Pro RM349 Live price_...'
$STRIPE_PRICE_ANALYSIS_PACK = Read-Host '5) STRIPE_PRICE_ANALYSIS_PACK optional Live price_... (or leave blank)'

if (-not $STRIPE_SECRET_KEY.StartsWith('sk_live_')) {
  throw 'Live mode requires sk_live_... (you pasted a non-live key).'
}
if (-not $STRIPE_WEBHOOK_SECRET.StartsWith('whsec_')) {
  throw 'Webhook secret must start with whsec_'
}
if (-not $STRIPE_PRICE_MONTHLY.StartsWith('price_')) {
  throw 'Basic price id must start with price_'
}
if (-not $STRIPE_PRICE_PRO_MONTHLY.StartsWith('price_')) {
  throw 'Pro price id must start with price_'
}
if ($STRIPE_PRICE_ANALYSIS_PACK -and -not $STRIPE_PRICE_ANALYSIS_PACK.StartsWith('price_')) {
  throw 'Analysis pack price id must start with price_ (or leave blank)'
}

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
Write-Host 'Saving LIVE secrets to Google Secret Manager...' -ForegroundColor Cyan
Set-Secret 'STRIPE_SECRET_KEY' $STRIPE_SECRET_KEY
Set-Secret 'STRIPE_WEBHOOK_SECRET' $STRIPE_WEBHOOK_SECRET

$envVars = "STRIPE_PRICE_MONTHLY=$STRIPE_PRICE_MONTHLY,STRIPE_PRICE_PRO_MONTHLY=$STRIPE_PRICE_PRO_MONTHLY,APP_URL=$AppUrl,FIREBASE_PROJECT_ID=$Project"
if ($STRIPE_PRICE_ANALYSIS_PACK) {
  $envVars = "$envVars,STRIPE_PRICE_ANALYSIS_PACK=$STRIPE_PRICE_ANALYSIS_PACK"
}

# Force a new revision so instances reload Secret Manager "latest".
# Updating only the secret value does NOT refresh already-running containers.
$envVars = "$envVars,STRIPE_FORCE_REFRESH=$(Get-Date -Format o)"

Write-Host 'Updating Cloud Run service to LIVE prices (new revision)...' -ForegroundColor Cyan
gcloud run services update $Service `
  --region=$Region `
  --project=$Project `
  --update-secrets=STRIPE_SECRET_KEY=STRIPE_SECRET_KEY:latest,STRIPE_WEBHOOK_SECRET=STRIPE_WEBHOOK_SECRET:latest `
  --update-env-vars="$envVars"

Write-Host ''
Write-Host 'DONE — Stripe LIVE is wired to Cloud Run.' -ForegroundColor Green
Write-Host "1) Hard-refresh $AppUrl"
Write-Host '2) Sign in and click Subscribe (real charges apply)'
Write-Host '3) In Stripe → Webhooks → Live endpoint, confirm recent deliveries = 200'
Write-Host "4) Webhook URL: $WebhookUrl"
Write-Host ''
Write-Host 'Press Enter to close...'
Read-Host | Out-Null
