# Extras Folder

This folder contains files that are not actively used by the main codebase but are kept for reference, documentation, or historical purposes.

## Contents

### 📸 Images
- `ChatGPT Image Oct 20, 2025, 06_34_55 PM.png` - Screenshot from development

### 📝 Development Documentation
- `dieter_rams_cursor (1).md` - Cursor rules and development guidelines
- `DISCOVERY_SUMMARY.md` - Initial project discovery and analysis
- `enhanced_system_prompt.md` - AI system prompt configurations
- `implementation_quickstart.md` - Quick start guide for implementation
- `IMPLEMENTATION_STATUS.md` - Development status tracking
- `implementation_summary.md` - Implementation summary
- `INTEGRATION_GUIDE.md` - Integration documentation
- `QUICKSTART.md` - Quick start guide

### 🏗️ Project Phases Documentation
- `PHASE1_COMPLETE.md` - Phase 1 completion documentation
- `PHASE2_COMPLETE.md` - Phase 2 completion documentation
- `PHASE2_SUMMARY.md` - Phase 2 summary
- `PHASE3_COMPLETE.md` - Phase 3 completion documentation
- `PHASE3_PROGRESS.md` - Phase 3 progress tracking
- `PHASE4_COMPLETE.md` - Phase 4 completion documentation
- `PHASE4_SUMMARY.md` - Phase 4 summary
- `PHASES_1-4_SUMMARY.md` - Combined phases summary

### 📊 Project Status Files
- `PROJECT_COMPLETE.md` - Project completion documentation
- `PROJECT_STATUS.md` - Overall project status
- `RED_MATRIX_THEME.md` - UI theme documentation

### 🔧 Scripts and Tools
- `extract_components.sh` - Component extraction script
- `INSTALL.sh` - Installation script
- `inscription_hash.py` - Python script for inscription hashing
- `inscription_verify.ts` - TypeScript verification utility
- `dry_run_mode.ts` - Dry run mode implementation

### 📚 KILN Documentation
- `SBT01-Marketplace-Guide.md` - Marketplace integration guide
- `SBT01-README-v0.1.1.md` - KILN specification v0.1.1
- `SBT01-Token2022-Compatibility.md` - Token-2022 compatibility guide

### 🔗 Teleburn Documentation
- `sol-tele.md` - Solana teleburn documentation
- `teleb-solana.js` - Solana teleburn JavaScript implementation
- `teleburn-solana.md` - Teleburn Solana guide

### 🧪 Testing
- `TEST_INSCRIPTION.md` - Test inscription documentation
- `token2022_docs.md` - Token-2022 documentation

## Why These Files Are Here

These files were moved to the `extras/` folder because they are:

1. **Historical documentation** - Development phases and progress tracking
2. **Reference materials** - Specifications and guides not used in runtime
3. **Development tools** - Scripts and utilities used during development
4. **Alternative implementations** - Different approaches or versions
5. **Documentation artifacts** - Screenshots, notes, and development artifacts

## Active Codebase

The main codebase now contains only the essential files:

- `src/` - Source code
- `docs/` - Active documentation (teleburn algorithm docs)
- `tests/` - Test files
- Configuration files (`package.json`, `tsconfig.json`, etc.)
- `README.md` - Main project documentation
- `TELEBURN_SUMMARY.md` - Teleburn implementation summary

## Accessing Extras

If you need to reference any of these files:

```bash
# View a specific file
cat extras/PROJECT_COMPLETE.md

# List all files
ls -la extras/

# Search for content
grep -r "keyword" extras/
```

## Cleanup

These files are preserved for:
- Historical reference
- Development context
- Alternative implementations
- Documentation completeness

They don't affect the main application functionality and can be safely archived or removed if storage space is a concern.
