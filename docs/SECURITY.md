# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability within Kiln, please send an email to **fev.dev@proton.me**.

**Please do NOT open a public GitHub issue for security vulnerabilities.**

All security vulnerabilities will be promptly addressed.

## Security Measures

### Input Validation
- All API endpoints use Zod schema validation
- User inputs are sanitized before processing
- Transaction parameters are validated before building

### Transaction Safety
- All transactions are simulated (dry-run) before execution
- Users must explicitly sign every transaction
- Transaction details are fully disclosed before signing
- No auto-signing or hidden transactions

### Key Management
- Private keys are NEVER handled or stored by the application
- Wallet connection uses standard Solana wallet adapters
- All signing happens in the user's wallet

### API Security
- Rate limiting on all public endpoints
- CORS protection for API routes
- Environment-based configuration for sensitive values

### What We Don't Store
- No private keys
- No wallet seeds or mnemonics
- No session tokens beyond standard wallet connection

## Known Considerations

### dangerouslySetInnerHTML
The documentation viewer uses `dangerouslySetInnerHTML` to render markdown content. This content is sourced from trusted local files only, not user input.

### Console Logging
Development console logs are present for debugging. These do not expose sensitive user data.

## Version

This security policy applies to Kiln v0.1.1 and later.

---

*Last updated: December 3, 2025*

