# TradePulse — Production Deployment Guide
### Deploying with Supabase (Database & Auth) + Vercel (Hosting) via GitHub

This guide covers taking TradePulse from AI Studio to production using **GitHub**, **Supabase**, and **Vercel**.

---

## Architecture Overview

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS (hosted on **Vercel**)
- **Database & Auth**: PostgreSQL + Row Level Security + Auth (hosted on **Supabase**)
- **Repository**: Git repository exported to **GitHub**
- **Offline / PWA**: Service worker caching with offline fallback support

---

## Step 1: Export Codebase to GitHub

1. In AI Studio, click the **Export** button in the top navigation bar and select **Export to GitHub**.
2. Connect your GitHub account and choose either a new repository name (e.g. `tradepulse-app`) or an existing repository.
3. Once exported, clone or open your repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/tradepulse-app.git
   cd tradepulse-app
   ```

---

## Step 2: Set Up Supabase

1. Go to [https://supabase.com](https://supabase.com) and sign in or create a free account.
2. Click **New Project**:
   - **Name**: `TradePulse`
   - **Database Password**: Choose a strong password and save it
   - **Region**: Choose the region closest to your trading hours / audience (e.g., US East, Frankfurt)
3. Once the database finishes provisioning (~1-2 minutes):
   - Navigate to the **SQL Editor** tab on the left sidebar.
   - Click **+ New query**.
   - Copy the entire contents of `supabase-schema.sql` located in this repository's root.
   - Paste into the SQL Editor and click **Run**.
4. **Copy Your Supabase API Keys**:
   - Go to **Project Settings** (gear icon) -> **API**.
   - Copy:
     - **Project URL** (e.g. `https://xyzcompany.supabase.co`)
     - **Project API Keys** -> `anon` `public` key (e.g. `eyJhbGciOi...`)

---

## Step 3: Deploy to Vercel

1. Go to [https://vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New...** -> **Project**.
3. Import your GitHub repository (`tradepulse-app`).
4. In the **Configure Project** screen:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Expand the **Environment Variables** section and add:

   | Key | Value | Description |
   |-----|-------|-------------|
   | `VITE_SUPABASE_URL` | `https://your-project.supabase.co` | Your Supabase Project URL |
   | `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6...` | Your Supabase public anon key |
   | `GEMINI_API_KEY` | `AIzaSy...` *(Optional)* | For AI Coach & automated audits |

6. Click **Deploy**. Vercel will build and publish your app with a production `.vercel.app` URL and free SSL certificate!

---

## Step 4: Verify Auth & Production Features

1. Open your live Vercel URL.
2. Click **Sign In / Sign Up** in the top navigation bar.
3. Click **Create Account** tab:
   - Enter your email, password (min 6 characters), and trader handle.
   - Click **Create Free Account**.
4. You are now logged in! Notice the green **Cloud Synced** indicator in the navbar.
5. Log a trade or import a broker statement (ThinkorSwim, Interactive Brokers, TradingView, MT4/MT5, NinjaTrader).
6. Check your Supabase Dashboard: go to **Table Editor** -> `trades` to see your rows securely stored with your `user_id`.

---

## Production Security & Row Level Security (RLS)

- **Isolation**: Each user only reads, modifies, and deletes their own trades. Row Level Security policies (`auth.uid() = user_id`) enforce this at the database engine level.
- **Vercel Routing**: `vercel.json` contains SPA rewrite rules ensuring page refreshes and direct links route properly to `index.html`.
- **Offline Resilience**: Even if the network drops mid-session, TradePulse caches your entries locally and displays the offline indicator.
