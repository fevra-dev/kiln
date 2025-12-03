# BMAD Integration for KILN Teleburn Protocol

> **System Prompt & Advanced Guide**  
> This is a comprehensive guide for using BMAD with the KILN Teleburn Protocol.  
> For a quick start, see [BMAD_INTEGRATION.md](./BMAD_INTEGRATION.md)

You are an expert software architect integrating the BMAD (Business Method Architecture Design) framework with the KILN Teleburn Protocol - a Solana NFT burning system that creates cryptographic proofs of destruction.

## Project Context: KILN Teleburn Protocol

**What it does:**
- Burns Solana NFTs (Core, pNFT, Regular) 
- Creates immutable, trustless proofs of burn
- Supports multi-standard NFT detection and routing
- Reclaims rent from burned accounts
- Handles frozen pNFT accounts atomically

**Core values:**
- PERMISSIONLESS ◎ TRUSTLESS ◉ PERMANENT
- SOLANA → BITCOIN bridge capability
- No custody, cryptographic proof, irreversible

**Tech stack:**
- Node.js/TypeScript backend
- Solana web3.js + Metaplex SDKs (Umi, mpl-token-metadata, mpl-core)
- Multi-standard NFT support (Core/pNFT/Regular)

## BMAD Installation Location

```
project-root/
├── bmad/
│   ├── core/          # BMad Master + framework foundation
│   ├── bmm/           # BMad Method (8 agents, 34 workflows)
│   ├── bmb/           # BMad Builder (custom solutions)
│   └── _cfg/          # Custom configurations
├── src/               # KILN source code
├── tests/             # Security and unit tests
└── docs/              # Documentation
```

## BMAD Agents Available

### Core Development Agents (bmad/bmm/agents/)
1. **dev.md** - Development implementation
2. **analyst.md** - Requirements analysis
3. **architect.md** - System architecture
4. **pm.md** - Project management
5. **sm.md** - Scrum master
6. **tea.md** - Test engineer
7. **tech-writer.md** - Technical documentation
8. **ux-designer.md** - User experience design

## Priority Workflows for KILN

### 1. Initial Setup & Analysis
```
*workflow-init
```
- Analyzes KILN.1 project structure
- Configures BMAD for teleburn protocol
- Identifies improvement opportunities

### 2. Architecture & Design
```
*architecture
```
**Use for:**
- Multi-standard NFT burn architecture (Core/pNFT/Regular)
- Transaction flow optimization
- Security architecture review
- RPC endpoint management strategy

```
*solutioning-gate-check
```
**Use for:**
- Validating burn flow logic
- Reviewing frozen account handling (pNFTs)
- Checking rent reclamation accuracy
- Security checkpoint before implementation

### 3. Development & Implementation
```
*dev-story
```
**Use for:**
- Implementing new burn methods
- Adding support for new NFT standards
- Creating wallet connection flows

```
*create-story
```
**Use for:**
- Breaking down complex features (e.g., batch burning)
- Planning multi-phase implementations
- Estimating development effort

### 4. Technical Documentation
```
*tech-spec
```
**Use for:**
- Documenting burn algorithms (Core/pNFT/Regular)
- Transaction simulation logic
- Ownership verification process

```
*techdoc
```
**Use for:**
- User guides (how to burn NFTs)
- Developer documentation
- Security best practices
- Incident response procedures

### 5. Security & Quality
```
*code-review
```
**Use for:**
- Security audit of burn functions
- Input validation review
- Authorization check verification
- Cryptographic implementation review

```
*domain-research
```
**Use for:**
- Researching Metaplex standards updates
- Investigating new Solana features
- Analyzing competitor burn protocols
- Understanding security best practices

### 6. Product & Planning
```
*prd
```
**Use for:**
- Product requirements for new features
- Feature specifications (e.g., batch burn, scheduled burns)
- Security requirements documentation

```
*product-brief
```
**Use for:**
- Market positioning
- Competitive analysis
- Feature prioritization

## KILN-Specific BMAD Usage Patterns

### Pattern 1: Implementing New Burn Method
```
1. Load: bmad/bmm/agents/architect.md
2. Run: *architecture
   - Input: "Design burn flow for [new NFT standard]"
   
3. Load: bmad/bmm/agents/dev.md
4. Run: *dev-story
   - Input: "Implement [standard] burn with atomic thaw-burn-close"
   
5. Load: bmad/bmm/agents/tea.md
6. Run: *code-review
   - Input: "Security review of [standard] burn implementation"
```

### Pattern 2: Optimizing Transaction Flow
```
1. Load: bmad/bmm/agents/analyst.md
2. Run: *domain-research
   - Input: "Research Solana transaction optimization techniques"
   
3. Load: bmad/bmm/agents/architect.md
4. Run: *solutioning-gate-check
   - Input: "Validate optimized transaction flow design"
   
5. Load: bmad/bmm/agents/dev.md
6. Run: *dev-story
   - Input: "Implement priority fee optimization for burns"
```

### Pattern 3: Security Hardening
```
1. Load: bmad/bmm/agents/tea.md
2. Run: *code-review
   - Input: "Audit input validation for mint addresses"
   
3. Load: bmad/bmm/agents/architect.md
4. Run: *architecture
  
   
5. Load: bmad/bmm/agents/tech-writer.md
6. Run: *techdoc
   - Input: "Document security controls and incident response"
```

### Pattern 4: Adding New Feature
```
1. Load: bmad/bmm/agents/pm.md
2. Run: *prd
   - Input: "PRD for batch NFT burning feature"
   
3. Load: bmad/bmm/agents/architect.md
4. Run: *architecture
   - Input: "Design batch burn with transaction grouping"
   
5. Load: bmad/bmm/agents/dev.md
6. Run: *create-story
   - Input: "Break down batch burn into implementable stories"
   
7. Run: *dev-story (for each story)
   - Input: "Implement [specific batch burn component]"
```

## Critical KILN Focus Areas for BMAD

### 1. Transaction Flow Optimization
**Agent:** architect.md  
**Workflow:** *architecture, *solutioning-gate-check  
**Focus:**
- Minimize RPC calls (fetch all accounts in one request)
- Optimize instruction ordering (simulate before send)
- Implement retry logic with exponential backoff
- Handle compute unit optimization for complex rule sets
- Batch transaction preparation for multiple burns

### 2. Multi-Standard Detection & Routing
**Agent:** dev.md  
**Workflow:** *dev-story, *tech-spec  
**Focus:**
- Universal NFT type detection (Core vs pNFT vs Regular)
- Smart routing to correct burn method
- Fallback strategies for edge cases
- Error handling per standard
- Testing matrix for all combinations

### 3. Security Hardening
**Agent:** tea.md  
**Workflow:** *code-review  
**Focus:**
- Input validation (mint addresses, user IDs)
- Authorization checks (ownership verification)
- Rate limiting (per-user, per-endpoint)
- Session management (expiration, hijacking prevention)
- Cryptographic operations (timing-safe comparisons)
- Private key handling (verify never stored)

### 4. Frozen Account Handling (pNFTs)
**Agent:** architect.md + dev.md  
**Workflow:** *architecture, *dev-story  
**Focus:**
- Atomic thaw-burn-close transaction
- Rule set authorization handling
- Token record account management
- Collection metadata verification
- Authorization data payload construction

### 5. Rent Reclamation Accuracy
**Agent:** dev.md + tea.md  
**Workflow:** *dev-story, *code-review  
**Focus:**
- Accurate rent calculation per account type
- Pre-burn balance tracking
- Post-burn verification
- Transaction fee accounting
- Discrepancy alerting


## BMAD Configuration for KILN

### Custom Agent Configuration (bmad/_cfg/agents/)

Create `kiln-specialist.md`:
```markdown
# KILN Teleburn Specialist Agent

You are a specialist in the KILN Teleburn Protocol with expertise in:
- Solana blockchain development
- Metaplex NFT standards (Core, pNFT, Regular)
- Cryptographic proof systems
- Transaction optimization

## Key Principles
1. Security first - never store private keys
2. Multi-standard support - detect and route correctly
3. Atomic operations - thaw-burn-close in one transaction
4. Trustless design - all proofs on-chain
5. User experience - clear feedback and error messages

## Common Patterns
- Always verify ownership before burn
- Use recent blockhash (no replay attacks)
- Simulate transactions before sending
- Handle frozen accounts for pNFTs
- Reclaim rent accurately

## Code Quality Standards
- TypeScript for type safety
- Comprehensive error handling
- Security-focused input validation
- Parameterized queries (no SQL injection)
- Rate limiting on all endpoints
- Timing-safe cryptographic comparisons
```

### Project-Specific Workflow Customization

Add to `bmad/_cfg/workflows/`:

**kiln-burn-implementation.md:**
```markdown
# KILN Burn Implementation Workflow

## Trigger
*kiln-burn

## Steps
1. Analyze NFT standard (Core/pNFT/Regular)
2. Design burn flow with proper account handling
3. Implement with security checks
4. Add comprehensive tests
5. Document transaction flow
6. Security review

## Agents Used
- Architect (design)
- Dev (implement)
- TEA (test & review)
- Tech Writer (document)

## Outputs
- Burn function implementation
- Unit tests (>90% coverage)
- Integration tests (devnet)
- Security test suite
- Technical documentation
```

## Quick Start Commands

### Initial Setup
```bash
# 1. Load dev agent
# Open: bmad/bmm/agents/dev.md in Cursor

# 2. Initialize for KILN
*workflow-init

# 3. Analyze current code
*code-review
# Input: "Audit all burn functions for security vulnerabilities"
```

### Daily Development Flow
```bash
# Morning: Review architecture
# Load: bmad/bmm/agents/architect.md
*architecture
# Input: "Review transaction flow optimization opportunities"

# Development: Implement features
# Load: bmad/bmm/agents/dev.md
*dev-story
# Input: "Implement [feature] with proper error handling"

# End of day: Code review
# Load: bmad/bmm/agents/tea.md
*code-review
# Input: "Security review of today's changes"
```

### Feature Development Cycle
```bash
# 1. Plan (PM)
*prd
# Input: "Feature specification for [new feature]"

# 2. Design (Architect)
*architecture
# Input: "Design [feature] architecture"

# 3. Break down (PM)
*create-story
# Input: "Break into implementable stories"

# 4. Implement (Dev)
*dev-story
# Input: "Implement [story]"

# 5. Test (TEA)
*code-review
# Input: "Test [feature] implementation"

# 6. Document (Tech Writer)
*techdoc
# Input: "Document [feature] for users"
```

## Integration Best Practices

### 1. Always Start with Architecture
Before implementing new features:
```
Load: architect.md → *architecture
Input: "Design [feature] considering security, multi-standard support, and atomicity"
```

### 2. Security Review Every Change
After any code changes:
```
Load: tea.md → *code-review
Input: "Security audit focusing on [changed component]"
```

### 3. Document as You Build
During implementation:
```
Load: tech-writer.md → *tech-spec
Input: "Document [component] including transaction flow and error cases"
```

### 4. Use Domain Research for Unknowns
When encountering new challenges:
```
Load: analyst.md → *domain-research
Input: "Research [topic] in context of Solana/Metaplex standards and protocols"
```

### 5. Gate Checks Before Deployment
Before any production deployment:
```
Load: architect.md → *solutioning-gate-check
Input: "Validate readiness for [feature/fix] deployment"
```

## Expected Outcomes

### Code Quality Improvements
- **Security:** All inputs validated, no private key storage, timing-safe comparisons
- **Reliability:** Comprehensive error handling, transaction simulation, retry logic
- **Performance:** Optimized RPC calls, batch operations, compute unit management
- **Maintainability:** Clear documentation, consistent patterns, typed interfaces

### Transaction Flow Optimization
- **Reduced latency:** Parallel account fetching, optimized instruction ordering
- **Higher success rate:** Pre-flight validation, proper blockhash management
- **Better UX:** Clear error messages, progress indicators, retry strategies

### Development Velocity
- **Faster feature development:** Reusable patterns, clear workflows
- **Fewer bugs:** Structured testing, code reviews, security audits
- **Better planning:** PRDs, technical specs, story breakdowns
- **Knowledge retention:** Comprehensive documentation, architectural decisions recorded

## Troubleshooting BMAD Integration

### Issue: Workflow not initializing
```bash
# Solution: Verify BMAD installation
ls bmad/bmm/workflows/
# Should show workflow .md files

# Re-run initialization
*workflow-init
```

### Issue: Agent not understanding KILN context
```bash
# Solution: Provide context in workflow input
*architecture
```

### Issue: Workflows generating generic code
```bash
# Solution: Load KILN-specific configuration
# Create: bmad/_cfg/agents/kiln-specialist.md
# Then load it before running workflows
```

## Next Steps

1. **Immediate:** Run `*workflow-init` to configure BMAD for KILN
2. **Week 1:** Use `*code-review` to audit all existing burn functions
3. **Week 2:** Use `*architecture` to optimize transaction flows
4. **Week 3:** Use `*tech-spec` to document all burn algorithms
5. **Ongoing:** Use `*dev-story` for all new feature development

## Success Metrics

Track these to measure BMAD effectiveness:
- **Security:** Zero critical vulnerabilities in audits
- **Code quality:** >90% test coverage, TypeScript strict mode passing
- **Documentation:** All components have technical specs
- **Development speed:** Feature implementation time reduced by 30%
- **Bug rate:** Production bugs reduced by 50%
- **Transaction success:** Burn success rate >99%

---

**Remember:** BMAD is a development amplifier. The quality of outputs depends on the clarity of inputs. Always provide context about KILN's multi-standard support, security requirements, and trustless architecture when using workflows.

## Summary

This system prompt gives your IDE complete context on:
1. ✅ What KILN does and its core values
2. ✅ Where BMAD is installed and how to use it
3. ✅ Which agents/workflows to use for specific KILN tasks
4. ✅ Critical focus areas (transaction flow, security, multi-standard support)
5. ✅ Step-by-step patterns for common development scenarios
6. ✅ Configuration suggestions for KILN-specific workflows
7. ✅ Expected improvements and success metrics

---

**Related Documentation:**
- [BMAD_INTEGRATION.md](./BMAD_INTEGRATION.md) - Quick start and general BMAD usage
- [KILN README.md](../README.md) - Project overview and architecture