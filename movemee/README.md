# Movemee - Unused/Deprecated Files

This folder contains files that are no longer used in the active codebase but are kept for reference or historical purposes.

## Contents

### `files (1)/` - Reference Implementation Files

Original reference files that have been integrated into the codebase:

- **KILN_INSCRIPTION_METADATA_SPEC.md** - Now in `public/docs/INSCRIPTION_METADATA_SPEC.md`
- **KILN_TELEBURN_SPEC_v1.0.md** - Now in `public/docs/TELEBURN_SPEC_v1.0.md`
- **KILN_TELEBURN_SUMMARY.md** - Now in `public/docs/TELEBURN_SUMMARY.md`
- **KILN_TELEBURN_SPEC_v1.0.docx** - Word document version (reference only)
- **KILN_TELEBURN_SPEC_v1.0.pdf** - PDF version (reference only)
- **kiln-inscription.ts** - Reference implementation (to be integrated to `src/lib/`)
- **teleburn-v1.ts** - Reference implementation (already integrated)

### Deprecated Code

- **derived-owner.ts** - Legacy derived address algorithm (deprecated in v0.1.1, removed in v1.0)
- **derived-owner.test.ts** - Tests for deprecated derived-owner.ts

## Why These Files Are Here

These files are kept for:
- **Historical reference** - Understanding the evolution of the protocol
- **Migration purposes** - If needed for backwards compatibility
- **Documentation** - Original specifications in multiple formats
- **Future integration** - Some files (like `kiln-inscription.ts`) may be integrated later

## Status

All files in this folder are **NOT** used by the active codebase. They are safe to delete if you want to clean up, but are kept for reference purposes.

---

*Last updated: December 5, 2025*

