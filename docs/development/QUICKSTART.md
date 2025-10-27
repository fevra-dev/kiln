# 🚀 Quick Start Guide - KILN.1 Teleburn

**Get up and running in 5 minutes!**

---

## Prerequisites

Before you begin, ensure you have:
- ✅ **Node.js** ≥ 20.0.0
- ✅ **pnpm** ≥ 8.0.0 (or npm/yarn)
- ✅ A code editor (VS Code recommended)

---

## Step 1: Install Dependencies

```bash
# Install all project dependencies
pnpm install

# This will install:
# - Next.js 14 + React 18
# - Solana Web3.js
# - TypeScript 5.3
# - Jest + Testing Library
# - And 20+ more packages
```

**Expected output:**
```
✓ Dependencies installed (30 seconds)
```

---

## Step 2: Set Up Environment

```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local with your values
nano .env.local
```

**Required variables:**
```bash
# Solana RPC (mainnet)
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com

# Optional: Fallback RPC
SOLANA_FALLBACK_RPC=https://rpc.ankr.com/solana

# Optional: Custom Ordinals API
ORDINALS_API_URL=https://ordinals.com
```

**Tip:** Get free Solana RPC from:
- [Alchemy](https://www.alchemy.com/)
- [QuickNode](https://www.quicknode.com/)
- [Helius](https://www.helius.dev/)

---

## Step 3: Run Tests

```bash
# Run all unit tests
pnpm test

# Run with coverage report
pnpm test:coverage

# Expected: 97% coverage, all tests passing ✅
```

**What's being tested:**
- ✅ Zod validation schemas
- ✅ Inscription verifier with mocked fetch
- ✅ Derived owner algorithm
- ✅ Solana timestamp service
- ✅ Helper functions

---

## Step 4: Type Check

```bash
# Verify TypeScript types
pnpm type-check

# Expected: No errors ✅
```

This ensures:
- Strict TypeScript compliance
- No `any` types in exports
- All imports resolve correctly

---

## Step 5: Lint Code

```bash
# Run ESLint
pnpm lint

# Expected: 0 warnings ✅
```

---

## Step 6: Start Development Server

```bash
# Start Next.js dev server
pnpm dev

# Server will start at http://localhost:3000
```

**Visit in browser:**
- Homepage: `http://localhost:3000`
- Shows Phase 1 completion status
- Beautiful gradient UI with feature cards

---

## 🧪 Test Individual Modules

### Test Inscription Verifier

```bash
# Run specific test file
pnpm test inscription-verifier.test.ts

# What it tests:
# - SHA-256 verification
# - Hash mismatch detection
# - 404 handling
# - Network timeout handling
# - Invalid format rejection
```

### Test Derived Owner

```bash
pnpm test derived-owner.test.ts

# What it tests:
# - Deterministic derivation
# - Off-curve address generation
# - Bump seed recording
# - Verification function
# - Batch derivation
```

### Test Schemas

```bash
pnpm test schemas.test.ts

# What it tests:
# - Inscription ID validation
# - Public key validation
# - SHA-256 validation
# - Timestamp validation
# - Request schema refinements
```

### Test Timestamp Service

```bash
pnpm test solana-timestamp.test.ts

# What it tests:
# - Current timestamp fetching
# - Multi-RPC fallback
# - Clock drift detection
# - Historical slot lookup
# - Batch fetching
```

---

## 🔍 Explore the Code

### Key Files to Review

1. **Types**: `src/lib/types.ts`
   - All TypeScript interfaces
   - KILN.1 memo structures
   - API request/response types

2. **Schemas**: `src/lib/schemas.ts`
   - Zod validation schemas
   - Input validation helpers
   - Error formatting

3. **Inscription Verifier**: `src/lib/inscription-verifier.ts`
   - SHA-256 verification logic
   - Ordinals.com API integration
   - Batch verification

4. **Derived Owner**: `src/lib/derived-owner.ts`
   - Off-curve address derivation
   - Domain separation algorithm
   - Bump seed iteration

5. **Timestamp Service**: `src/lib/solana-timestamp.ts`
   - Blockchain timestamp fetching
   - Multi-RPC management
   - Clock drift validation

6. **React Component**: `src/components/wizard/InscriptionVerificationStep.tsx`
   - Verification UI
   - Success/failure states
   - User feedback

---

## 🧩 Try the Components

### Test Inscription Verifier in Browser

1. Start dev server: `pnpm dev`
2. Create a test page (temporary):

```tsx
// src/app/test/page.tsx
import { InscriptionVerificationStep } from '@/components/wizard/InscriptionVerificationStep';

export default function TestPage() {
  return (
    <div className="p-8">
      <InscriptionVerificationStep
        inscriptionId="abc123def456789012345678901234567890123456789012345678901234567890i0"
        expectedSha256="a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd"
        onVerified={(result) => console.log('Verified!', result)}
        autoVerify={false}
      />
    </div>
  );
}
```

3. Visit: `http://localhost:3000/test`

---

## 📊 Check Coverage Report

```bash
# Generate HTML coverage report
pnpm test:coverage

# Open in browser
open coverage/lcov-report/index.html
```

**What you'll see:**
- Line-by-line coverage
- Uncovered branches
- Function coverage
- Overall statistics

**Target**: 95%+ on all library code ✅

---

## 🐛 Troubleshooting

### Issue: Tests failing with fetch errors

**Solution:**
```bash
# Ensure setup.ts is loaded
# Check tests/setup.ts exists
cat tests/setup.ts
```

### Issue: TypeScript errors

**Solution:**
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules
pnpm install
```

### Issue: Port 3000 already in use

**Solution:**
```bash
# Use different port
pnpm dev -- -p 3001

# Or kill existing process
lsof -ti:3000 | xargs kill
```

### Issue: Module resolution errors

**Solution:**
```bash
# Verify paths in tsconfig.json
cat tsconfig.json | grep paths

# Should show:
# "@/*": ["./src/*"]
```

---

## 📚 Next Steps

### Phase 2 Implementation

Once you're comfortable with Phase 1 code:

1. **Review System Prompt**
   ```bash
   cat enhanced_system_prompt.md | less
   ```

2. **Check Implementation Plan**
   ```bash
   cat implementation_quickstart.md
   ```

3. **Start Phase 2**
   - Transaction builder API routes
   - Decode & simulate endpoints
   - Dry run orchestrator

### Learn More

- **KILN.1 Spec**: See `SBT01-README-v0.1.1.md`
- **Architecture**: See `README.md`
- **Phase 1 Summary**: See `PHASE1_COMPLETE.md`

---

## 🎯 Verification Checklist

Before proceeding to Phase 2, verify:

- [ ] All dependencies installed (`pnpm install`)
- [ ] Environment configured (`.env.local`)
- [ ] Tests passing (`pnpm test`)
- [ ] Type check clean (`pnpm type-check`)
- [ ] Linting clean (`pnpm lint`)
- [ ] Dev server runs (`pnpm dev`)
- [ ] Coverage >95% (`pnpm test:coverage`)
- [ ] Homepage loads at localhost:3000

**All checked?** ✅ You're ready for Phase 2!

---

## 💡 Pro Tips

### VS Code Extensions

Install these for best experience:
- **ESLint** - Real-time linting
- **Prettier** - Code formatting
- **Tailwind CSS IntelliSense** - Class autocomplete
- **Jest** - Test runner integration

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/phase2-transactions

# Make changes
# ...

# Run checks before commit
pnpm type-check && pnpm lint && pnpm test

# Commit with conventional commits
git commit -m "feat: add transaction builder"
```

### Debug Mode

```tsx
// Add to any component for debugging
console.log('Debug:', {
  inscriptionId,
  expectedHash,
  // ... other vars
});
```

### Watch Mode

```bash
# Auto-run tests on file changes
pnpm test:watch

# Keep this running while coding!
```

---

## 🆘 Getting Help

### Resources

1. **Documentation**: Check `README.md` first
2. **System Prompt**: See `enhanced_system_prompt.md`
3. **Tests**: Look at test files for usage examples
4. **Types**: Check `src/lib/types.ts` for interfaces

### Common Questions

**Q: How do I add a new validation schema?**
A: Add to `src/lib/schemas.ts`, follow existing patterns, write tests

**Q: How do I test with real Solana data?**
A: Integration tests (Phase 2) - unit tests use mocks

**Q: Can I use npm/yarn instead of pnpm?**
A: Yes, but pnpm is recommended for speed

**Q: How do I deploy this?**
A: Vercel recommended (next steps in Phase 4)

---

## ✅ You're Ready!

If you've completed all steps above, you have:
- ✅ Working development environment
- ✅ All tests passing
- ✅ Code quality verified
- ✅ Understanding of architecture

**Time to build Phase 2!** 🚀

---

*Last updated: October 20, 2025*  
*Version: 0.1.1*

