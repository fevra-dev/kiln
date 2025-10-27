# Documentation

This folder contains the complete documentation for the KILN-TELEBURN v0.1.1.1 Teleburn Standard implementation.

## 📚 Core Documentation

### Algorithm & Implementation
- **[TELEBURN_ALGORITHM.md](./TELEBURN_ALGORITHM.md)** - Complete algorithm specification with examples
- **[ALGORITHM_COMPARISON.md](./ALGORITHM_COMPARISON.md)** - Visual comparison with Ethereum teleburn
- **[TELEBURN_SUMMARY.md](./TELEBURN_SUMMARY.md)** - Implementation overview and status

### Migration & Development
- **[TELEBURN_MIGRATION.md](./TELEBURN_MIGRATION.md)** - Migration guide from legacy implementation
- **[TELEBURN_STANDARDIZATION.md](./TELEBURN_STANDARDIZATION.md)** - Complete standardization summary

## 🎯 Quick Reference

### For Developers
1. **Algorithm Spec** → `TELEBURN_ALGORITHM.md`
2. **Migration Guide** → `TELEBURN_MIGRATION.md`
3. **Implementation Status** → `TELEBURN_SUMMARY.md`

### For Users
1. **How It Works** → `ALGORITHM_COMPARISON.md`
2. **What Changed** → `TELEBURN_STANDARDIZATION.md`
3. **Getting Started** → Main [README.md](../README.md)

## 🔗 Related Files

### Active Implementation
- `src/lib/teleburn.ts` - Canonical implementation
- `tests/unit/teleburn.test.ts` - 78 unit tests
- `src/lib/transaction-builder.ts` - Transaction construction

### Archived Documentation
- `extras/` - Historical development files
- `extras/README.md` - Archive index

## 📖 Documentation Structure

```
docs/
├── README.md                    # This file
├── TELEBURN_ALGORITHM.md        # Algorithm specification
├── ALGORITHM_COMPARISON.md      # Visual comparison
├── TELEBURN_MIGRATION.md        # Migration guide
├── TELEBURN_STANDARDIZATION.md  # Standardization summary
└── TELEBURN_SUMMARY.md          # Implementation overview
```

## 🎯 Key Points

- **Algorithm**: SHA-256 based derivation matching Ethereum pattern
- **Security**: Domain separation + off-curve guarantee
- **Testing**: 78 unit tests with 100% coverage
- **Status**: Production ready
- **Migration**: Legacy `derived-owner.ts` deprecated

## 📞 Questions?

- **Algorithm questions** → `TELEBURN_ALGORITHM.md`
- **Migration help** → `TELEBURN_MIGRATION.md`
- **Visual comparison** → `ALGORITHM_COMPARISON.md`
- **Implementation status** → `TELEBURN_SUMMARY.md`
