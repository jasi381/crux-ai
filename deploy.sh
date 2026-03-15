#!/bin/bash
# Crux.ai — Google Cloud Run Deployment Script
# Usage: ./deploy.sh YOUR_GCP_PROJECT_ID
# Bonus: Infrastructure-as-code for Gemini Live Agent Challenge submission

set -e

PROJECT_ID=${1:-$(gcloud config get-value project)}
IMAGE="gcr.io/$PROJECT_ID/crux-ai"
SERVICE="crux-ai"
REGION="us-central1"

echo "Deploying Crux.ai to Cloud Run..."
echo "Project: $PROJECT_ID | Region: $REGION"

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com \
  --project "$PROJECT_ID"

# Build container image using Cloud Build
echo "Building image: $IMAGE"
gcloud builds submit \
  --tag "$IMAGE" \
  --project "$PROJECT_ID" \
  .

# Deploy to Cloud Run
echo "Deploying service: $SERVICE"
gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "GEMINI_API_KEY=${GEMINI_API_KEY},NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY},NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN},NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID},NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET},NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID},NEXT_PUBLIC_FIREBASE_APP_ID=${NEXT_PUBLIC_FIREBASE_APP_ID}" \
  --project "$PROJECT_ID"

echo ""
echo "Deployment complete."
SERVICE_URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" --format "value(status.url)")
echo "Live at: $SERVICE_URL"
echo ""
echo "Next step: Add $SERVICE_URL to Firebase Console > Authentication > Authorized Domains"