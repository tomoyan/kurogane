# JPY Price Tool

AI-powered product info extractor and import pricing calculator for the Japanese market.

## Features

- Extract product details from any URL using AI
- Search for products by name
- Real-time USD/JPY exchange rate (cached 12hrs)
- Import pricing formula with tax, shipping, markup
- One-tap copy for all fields
- Quick price check without full extraction

## Setup

```bash
npm install
cp .env.local.example .env.local
# Add your Anthropic API key to .env.local
npm run dev
```

Open http://localhost:3000

## Environment Variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key from console.anthropic.com |

## Deploy to Vercel

1. Push to GitHub
2. Go to vercel.com/new → import repo
3. Add `ANTHROPIC_API_KEY` in Environment Variables
4. Deploy ✓

## Pricing Formula

```
(((USD × 1.1) × (Rate + 10)) + 7,000) × 1.1 × 1.05
```
Rounded down to nearest ¥10.
