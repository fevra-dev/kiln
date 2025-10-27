# RPC Setup Guide

## 🚨 Issue: Balance Shows "Unknown" or RPC Errors

If you're seeing "Balance: Unknown" or getting RPC errors, it's because the default Solana public RPC endpoint (`api.mainnet-beta.solana.com`) has strict rate limits.

## ✅ Solution: Configure a Custom RPC Endpoint

### Quick Fix (For Development)

The app is now configured to use **Solana Devnet** by default, which has more generous rate limits:
- Endpoint: `https://api.devnet.solana.com`
- This should work out of the box for testing

### Production Setup (Recommended)

For production use on mainnet, you'll need a custom RPC endpoint. Here are the best free options:

#### Option 1: Helius (Recommended)
**Best for:** Most use cases, generous free tier

1. Sign up at https://dev.helius.xyz/
2. Create an API key
3. Create `.env.local` in project root:
```bash
NEXT_PUBLIC_SOLANA_RPC=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY
```

**Free tier:** 100,000 requests/month

#### Option 2: QuickNode
**Best for:** Enterprise needs, excellent reliability

1. Sign up at https://www.quicknode.com/
2. Create a Solana endpoint
3. Add to `.env.local`:
```bash
NEXT_PUBLIC_SOLANA_RPC=https://your-quicknode-endpoint.solana-mainnet.quiknode.pro/YOUR_KEY/
```

**Free tier:** 50M monthly credits

#### Option 3: Alchemy
**Best for:** Developer-friendly, good analytics

1. Sign up at https://www.alchemy.com/
2. Create a Solana app
3. Add to `.env.local`:
```bash
NEXT_PUBLIC_SOLANA_RPC=https://solana-mainnet.g.alchemy.com/v2/YOUR_API_KEY
```

**Free tier:** 300M compute units/month

#### Option 4: RPC Pool
**Best for:** Decentralized approach

```bash
NEXT_PUBLIC_SOLANA_RPC=https://api.rpcpool.com
```

No signup required, but has rate limits.

### Create .env.local File

1. **Create the file:**
```bash
touch .env.local
```

2. **Add your RPC configuration:**
```bash
# Solana RPC Configuration
NEXT_PUBLIC_SOLANA_RPC=https://your-rpc-endpoint-here

# Network (devnet or mainnet)
NEXT_PUBLIC_NETWORK=devnet
```

3. **Restart the development server:**
```bash
pnpm dev
```

### Verify It's Working

After configuring your RPC:

1. Connect your wallet
2. You should see your balance displayed (not "Unknown")
3. No 403 errors in the console

### Network Configuration

**Current Default:** Devnet (development mode)
- More reliable for testing
- Free to use
- Use testnet SOL for transactions

**Switch to Mainnet:**
Update `src/app/teleburn/layout.tsx`:
```typescript
<WalletProviders network={WalletAdapterNetwork.Mainnet}>
```

### Troubleshooting

**Still showing "Unknown"?**
1. Check console for errors
2. Verify `.env.local` is in project root
3. Ensure you restarted the dev server after creating `.env.local`
4. Check your RPC endpoint is correct

**"Access forbidden" errors?**
- You're being rate limited
- Configure a custom RPC endpoint (see above)

**Want to use mainnet without custom RPC?**
- Not recommended (will be rate limited frequently)
- Better to use devnet for development
- Get a free RPC provider for mainnet

### Quick Test

To test if your RPC is working:
```bash
curl -X POST YOUR_RPC_ENDPOINT \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
```

Should return: `{"jsonrpc":"2.0","result":"ok","id":1}`

---

## 📊 RPC Provider Comparison

| Provider | Free Tier | Setup Time | Best For |
|----------|-----------|------------|----------|
| **Helius** | 100K req/mo | 2 min | General use |
| **QuickNode** | 50M credits/mo | 3 min | Enterprise |
| **Alchemy** | 300M compute/mo | 2 min | Developers |
| **RPC Pool** | Rate limited | 0 min | Quick testing |
| **Devnet (default)** | Generous | 0 min | Development |

## 🎯 Recommendation

- **Development:** Use devnet (current default) ✅
- **Production:** Use Helius or QuickNode
- **Testing:** Devnet is fine
- **Mainnet:** Get a custom RPC provider (required)

---

**Need help?** Check the console for specific error messages or open an issue on GitHub.

