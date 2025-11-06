# Integration Tests

Integration tests for production features that test multiple components working together.

## Test Files

- `api-rate-limiting.test.ts` - Rate limiting across API routes
- `api-emergency-shutdown.test.ts` - Emergency shutdown across API routes
- `rpc-failover.test.ts` - RPC failover in transaction building
- `transaction-building.test.ts` - Transaction building with all features
- `inscription-verification.test.ts` - Inscription verification with resilience

## Running Integration Tests

```bash
# Run all integration tests
npm test -- tests/integration

# Run specific test
npm test -- tests/integration/api-rate-limiting.test.ts
```

## Test Coverage

Integration tests verify:
- ✅ Rate limiting works across all API endpoints
- ✅ Emergency shutdown blocks all routes
- ✅ RPC failover works in transaction building
- ✅ Frozen account detection prevents invalid transactions
- ✅ Transaction size validation prevents oversized transactions
- ✅ Inscription caching improves performance
- ✅ Inscription immutability tracking works end-to-end

