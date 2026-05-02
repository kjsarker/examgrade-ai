# ExamGrade AI — Deployment Guide

## Step 1: Set up Supabase

1. Go to https://supabase.com → New project
2. Note your **Project URL** and **anon key** (Settings → API)
3. Also copy your **service_role key** (keep secret)
4. In SQL Editor, paste and run the entire contents of `supabase/schema.sql`
5. Go to **Storage** → New bucket:
   - Name: `exam-files` — toggle **Public** OFF
   - Name: `reports` — toggle **Public** ON (for report downloads)
6. Go to **Authentication** → Providers → Enable **Google** (add your OAuth credentials)

## Step 2: Set up Anthropic

1. Go to https://console.anthropic.com → API Keys → New Key
2. Copy the key

## Step 3: Set up Stripe

1. Go to https://dashboard.stripe.com
2. Create two recurring products:
   - **Pro**: $49.99/month → copy Price ID
   - **Premium**: $99.99/month → copy Price ID
3. Copy your **Publishable key** and **Secret key**
4. For webhooks (after deploy): Stripe → Webhooks → Add endpoint
   - URL: `https://your-app.vercel.app/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`
   - Copy **Webhook signing secret**

## Step 4: Set up Resend (email)

1. Go to https://resend.com → API Keys → New Key
2. Add and verify your sending domain, or use `onboarding@resend.dev` for testing

## Step 5: Push to GitHub

```bash
cd examgrade-ai
git init
git add .
git commit -m "Initial commit: ExamGrade AI"
# Create a new repo on github.com then:
git remote add origin https://github.com/YOUR_USERNAME/examgrade-ai.git
git branch -M main
git push -u origin main
```

## Step 6: Deploy to Vercel (FREE)

1. Go to https://vercel.com → New Project → Import from GitHub
2. Select your `examgrade-ai` repo
3. Add all environment variables (from `.env.example`):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRO_PRICE_ID
STRIPE_PREMIUM_PRICE_ID
RESEND_API_KEY
EMAIL_FROM
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

4. Click **Deploy**

## Step 7: Configure Stripe webhook

After deploy, copy your Vercel URL and add it as a Stripe webhook endpoint (see Step 3).

## Vercel Free Tier Limits

- 100GB bandwidth/month
- Serverless functions: 100GB-hours/month
- The grading endpoint has `maxDuration: 300s` (requires Vercel Pro for full 5 min — free tier allows 60s)
- **Recommendation**: Upgrade to Vercel Pro ($20/mo) or use Vercel's Edge Functions for long-running grading

## Alternative Free Deployments

- **Railway.app** — $5 free credit/month, supports longer function timeouts
- **Render.com** — free web services, spin-down after inactivity
- **Fly.io** — generous free tier for containers

## Local Development

```bash
npm install
cp .env.example .env.local
# Fill in your keys
npm run dev
```

Open http://localhost:3000
