# Rank & File 6787 Migration Notes

## Current Goal

Move `rankandfile6787.com` from GitHub Pages plus Google Sheets/App Script to Vercel plus Supabase, while adding `admin.rankandfile6787.com` for moderation and admin workflows.

## First Supabase Setup

1. Create a Supabase project.
2. Open the SQL editor and run `supabase/schema.sql`.
3. Create an Auth user for the admin account.
4. Copy `.env.example` to `.env`.
5. Fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_EMAILS`
6. Run `npm.cmd run import:comments` to import the shared Google Sheet comments.
7. Run `npm.cmd run dev` and open `/forum` and `/admin`.

## Vercel Setup

1. Import this GitHub repo into Vercel.
2. Add the same environment variables from `.env`.
3. Deploy a preview.
4. Add these domains to the Vercel project:
   - `rankandfile6787.com`
   - `www.rankandfile6787.com`
   - `admin.rankandfile6787.com`
5. Update DNS in GoDaddy only after the preview works.

## GoDaddy DNS Cutover

Use the exact records Vercel shows for the project. Usually the apex uses an A record and subdomains use CNAME records.

The current live DNS still points to GitHub Pages:

- `rankandfile6787.com` A records point to GitHub Pages IPs.
- `www.rankandfile6787.com` CNAME points to `rankfile6787.github.io`.

Cut over `admin.rankandfile6787.com` first, then move `www` and the apex once the admin flow is proven.
