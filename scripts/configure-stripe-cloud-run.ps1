# Configure Stripe on Cloud Run for Quantum Node
# Usage: fill the variables below, then run:
#   powershell -ExecutionPolicy Bypass -File .\scripts\configure-stripe-cloud-run.ps1

$ErrorActionPreference = 'Stop'
$Project = 'stocktrend-ai-super'
$Region = 'us-central1'
$Service = 'stocktrend-ai'
$RuntimeSA = '357117913612-compute@developer.gserviceaccount.com'

# ========== PASTE YOUR STRIPE TEST VALUES HERE ==========
$STRIPE_SECRET_KEY = 'sk_test_PASTE_HERE'
$STRIPE_WEBHOOK_SECRET = 'whsec_PASTE_HERE'          # from Stripe webhook endpoint
$STRIPE_PRICE_MONTHLY = 'price_PASTE_BASIC_199'      # Basic RM 199 / month
$STRIPE_PRICE_PRO_MONTHLY = 'price_PASTE_PRO_349'    # Pro RM 349 / month
# =======================================================

function Assert-Filled([string]$name, [string]$value, [string]$prefix) {
  if (-not $value -or $value -match 'PASTE_HERE|PASTE_') {
    throw "Please set $name in the script before running."
  }
  if ($prefix -and -not $value.StartsWith($prefix)) {
    throw "$name should start with $prefix"
  }
}

Assert-Filled 'STRIPE_SECRET_KEY' $STRIPE_SECRET_KEY 'sk_'
Assert-Filled 'STRIPE_WEBHOOK_SECRET' $STRIPE_WEBHOOK_SECRET 'whsec_'
Assert-Filled 'STRIPE_PRICE_MONTHLY' $STRIPE_PRICE_MONTHLY 'price_'
Assert-Filled 'STRIPE_PRICE_PRO_MONTHLY' $STRIPE_PRICE_PRO_MONTHLY 'price_'

Write-Host 'Creating/updating Secret Manager secrets...'

function Set-Secret([string]$name, [string]$value) {
  $tmp = New-TemporaryFile
  try {
    [System.IO.File]::WriteAllText($tmp.FullName, $value)
    $exists = gcloud secrets describe $name --project=$Project 2>$null
    if ($LASTEXITCODE -eq 0) {
      gcloud secrets versions add $name --data-file=$tmp.FullName --project=$Project | Out-Null
    } else {
      gcloud secrets create $name --data-file=$tmp.FullName --project=$Project | Out-Null
    }
  } finally {
    Remove-Item $tmp.FullName -Force -ErrorAction SilentlyContinue
  }
  gcloud secrets add-iam-policy-binding $name `
    --member="serviceAccount:$RuntimeSA" `
    --role='roles/secretmanager.secretAccessor' `
    --project=$Project | Out-Null
}

Set-Secret 'STRIPE_SECRET_KEY' $STRIPE_SECRET_KEY
Set-Secret 'STRIPE_WEBHOOK_SECRET' $STRIPE_WEBHOOK_SECRET

Write-Host 'Updating Cloud Run service env...'
gcloud run services update $Service `
  --region=$Region `
  --project=$Project `
  --update-secrets=STRIPE_SECRET_KEY=STRIPE_SECRET_KEY:latest,STRIPE_WEBHOOK_SECRET=STRIPE_WEBHOOK_SECRET:latest `
  --update-env-vars="STRIPE_PRICE_MONTHLY=$STRIPE_PRICE_MONTHLY,STRIPE_PRICE_PRO_MONTHLY=$STRIPE_PRICE_PRO_MONTHLY,APP_URL=https://stocktrend-ai-super.web.app,FIREBASE_PROJECT_ID=stocktrend-ai-super"

Write-Host ''
Write-Host 'Done. Verify with a hard refresh on https://stocktrend-ai-super.web.app and try Subscribe again.'
Write-Host 'Webhook URL must be:'
Write-Host '  https://stocktrend-ai-357117913612.us-central1.run.app/api/stripe/webhook'
