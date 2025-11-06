/**
 * Comprehensive Security Audit for KILN Teleburn Protocol
 * 
 * Tests actual implementation against security best practices.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

interface SecurityCheck {
  id: string;
  category: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PASS' | 'FAIL' | 'WARNING';
  details: string;
  recommendation: string;
  location?: string;
}

class ComprehensiveSecurityAuditor {
  private checks: SecurityCheck[] = [];
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Run comprehensive security audit
   */
  async runFullAudit(): Promise<void> {
    console.log('🔒 KILN Comprehensive Security Audit\n');
    console.log('=' .repeat(80) + '\n');

    // Phase 1: Dependency Security
    this.checkDependencies();

    // Phase 2: Secrets Management
    this.checkSecretsManagement();

    // Phase 3: Input Validation
    this.checkInputValidation();

    // Phase 4: Authentication & Authorization
    this.checkAuthentication();

    // Phase 5: API Security
    this.checkAPISecurity();

    // Phase 6: Transaction Security
    this.checkTransactionSecurity();

    // Phase 7: Cryptography
    this.checkCryptography();

    // Phase 8: Logging & Privacy
    this.checkLogging();

    // Phase 9: Error Handling
    this.checkErrorHandling();

    // Phase 10: Configuration
    this.checkConfiguration();

    // Print results
    this.printResults();
  }

  /**
   * Check dependencies
   */
  private checkDependencies(): void {
    console.log('📦 Checking dependencies...');

    // Check for package.json
    const packageJsonPath = join(this.projectRoot, 'package.json');
    if (!existsSync(packageJsonPath)) {
      this.addCheck('DEPS-001', 'Dependencies', 'package.json not found', 'CRITICAL', 'FAIL', '', 'Create package.json', packageJsonPath);
      return;
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

    // Check for security-related dependencies
    const hasZod = !!packageJson.dependencies?.zod || !!packageJson.devDependencies?.zod;
    if (hasZod) {
      this.addCheck('DEPS-002', 'Dependencies', 'Zod validation library present', 'LOW', 'PASS', 'Input validation library found', 'Verify all inputs use Zod schemas');
    }

    // Check for @solana/web3.js
    const hasSolana = !!packageJson.dependencies?.['@solana/web3.js'];
    if (hasSolana) {
      this.addCheck('DEPS-003', 'Dependencies', 'Solana Web3.js library present', 'LOW', 'PASS', 'Solana SDK found', 'Keep dependencies updated');
    }

    // Try to run audit (pnpm or npm)
    try {
      execSync('pnpm audit --json', { encoding: 'utf-8', cwd: this.projectRoot, stdio: 'pipe' });
      this.addCheck('DEPS-004', 'Dependencies', 'pnpm audit executable', 'LOW', 'PASS', 'Dependency audit available', 'Run pnpm audit regularly');
    } catch {
      this.addCheck('DEPS-005', 'Dependencies', 'Could not run dependency audit', 'MEDIUM', 'WARNING', 'pnpm audit may have found issues', 'Review dependencies manually');
    }
  }

  /**
   * Check secrets management
   */
  private checkSecretsManagement(): void {
    console.log('🔐 Checking secrets management...');

    // Check for .env.example
    const envExamplePath = join(this.projectRoot, '.env.example');
    if (existsSync(envExamplePath)) {
      this.addCheck('SECRETS-001', 'Secrets', '.env.example present', 'LOW', 'PASS', 'Environment variable template found', 'Verify all secrets documented');
    } else {
      this.addCheck('SECRETS-002', 'Secrets', '.env.example missing', 'MEDIUM', 'WARNING', 'No environment variable template', 'Create .env.example');
    }

    // Check .gitignore
    const gitignorePath = join(this.projectRoot, '.gitignore');
    if (existsSync(gitignorePath)) {
      const gitignore = readFileSync(gitignorePath, 'utf-8');
      if (gitignore.includes('.env')) {
        this.addCheck('SECRETS-003', 'Secrets', '.env in .gitignore', 'LOW', 'PASS', 'Environment files excluded from git', 'Verify .env.local also excluded');
      } else {
        this.addCheck('SECRETS-004', 'Secrets', '.env not in .gitignore', 'HIGH', 'FAIL', 'Environment files may be committed', 'Add .env* to .gitignore');
      }
    }

    // Check for hardcoded secrets in code
    const srcFiles = this.getAllSourceFiles();
    for (const file of srcFiles) {
      const content = readFileSync(file, 'utf-8');
      
      // Check for hardcoded API keys
      if (this.hasHardcodedSecrets(content)) {
        this.addCheck('SECRETS-005', 'Secrets', 'Potential hardcoded secrets', 'CRITICAL', 'FAIL', `Found in ${file}`, 'Remove hardcoded secrets, use environment variables', file);
      }

      // Check for private key storage
      if (content.includes('secretKey') && !content.includes('// DO NOT STORE') && !content.includes('// Never store')) {
        // Check if it's just type definitions
        if (!content.includes('type') && !content.includes('interface')) {
          this.addCheck('SECRETS-006', 'Secrets', 'Private key handling detected', 'CRITICAL', 'WARNING', `Found in ${file}`, 'Verify private keys are never stored', file);
        }
      }
    }
  }

  /**
   * Check input validation
   */
  private checkInputValidation(): void {
    console.log('✅ Checking input validation...');

    // Check schemas.ts
    const schemasPath = join(this.projectRoot, 'src/lib/schemas.ts');
    if (existsSync(schemasPath)) {
      const content = readFileSync(schemasPath, 'utf-8');
      
      if (content.includes('z.object') && content.includes('z.string')) {
        this.addCheck('INPUT-001', 'Input Validation', 'Zod schemas present', 'LOW', 'PASS', 'Input validation library configured', 'Verify all API routes use these schemas');
      }

      // Check for specific validators
      if (content.includes('InscriptionIdSchema')) {
        this.addCheck('INPUT-002', 'Input Validation', 'Inscription ID validation', 'LOW', 'PASS', 'Inscription ID schema found', 'Verify used in all routes');
      }

      if (content.includes('PublicKeySchema')) {
        this.addCheck('INPUT-003', 'Input Validation', 'Public key validation', 'LOW', 'PASS', 'Public key schema found', 'Verify used in all routes');
      }
    }

    // Check API routes use validation
    const apiRoutes = [
      'src/app/api/tx/seal/route.ts',
      'src/app/api/tx/retire/route.ts',
      'src/app/api/tx/burn-memo/route.ts',
    ];

    for (const route of apiRoutes) {
      const routePath = join(this.projectRoot, route);
      if (!existsSync(routePath)) continue;

      const content = readFileSync(routePath, 'utf-8');
      
      if (content.includes('.parse(') || content.includes('Schema.parse')) {
        this.addCheck(`INPUT-004-${route}`, 'Input Validation', `Validation in ${route}`, 'LOW', 'PASS', 'Schema validation found', 'Verify all inputs validated');
      } else {
        this.addCheck(`INPUT-005-${route}`, 'Input Validation', `Missing validation in ${route}`, 'HIGH', 'FAIL', 'No schema validation found', 'Add Zod schema validation', route);
      }
    }
  }

  /**
   * Check authentication and authorization
   */
  private checkAuthentication(): void {
    console.log('🔐 Checking authentication & authorization...');

    // Check rate limiter
    const rateLimiterPath = join(this.projectRoot, 'src/lib/rate-limiter.ts');
    if (existsSync(rateLimiterPath)) {
      this.addCheck('AUTH-001', 'Authentication', 'Rate limiter implemented', 'LOW', 'PASS', 'Rate limiting module found', 'Verify limits are appropriate');
    } else {
      this.addCheck('AUTH-002', 'Authentication', 'Rate limiter missing', 'HIGH', 'FAIL', 'No rate limiting found', 'Implement rate limiting');
    }

    // Check emergency shutdown
    const shutdownPath = join(this.projectRoot, 'src/lib/emergency-shutdown.ts');
    if (existsSync(shutdownPath)) {
      this.addCheck('AUTH-003', 'Authentication', 'Emergency shutdown implemented', 'LOW', 'PASS', 'Emergency shutdown feature found', 'Test shutdown procedure');
    }

    // Check API routes use rate limiting
    const apiRoutes = [
      'src/app/api/tx/seal/route.ts',
      'src/app/api/tx/retire/route.ts',
    ];

    for (const route of apiRoutes) {
      const routePath = join(this.projectRoot, route);
      if (!existsSync(routePath)) continue;

      const content = readFileSync(routePath, 'utf-8');
      
      if (content.includes('checkRateLimit')) {
        this.addCheck(`AUTH-004-${route}`, 'Authentication', `Rate limiting in ${route}`, 'LOW', 'PASS', 'Rate limiting implemented', 'Verify limits are appropriate');
      } else {
        this.addCheck(`AUTH-005-${route}`, 'Authentication', `No rate limiting in ${route}`, 'HIGH', 'FAIL', 'Rate limiting missing', 'Add rate limiting', route);
      }

      if (content.includes('checkEmergencyShutdown')) {
        this.addCheck(`AUTH-006-${route}`, 'Authentication', `Emergency shutdown in ${route}`, 'LOW', 'PASS', 'Emergency shutdown check found', 'Test shutdown procedure');
      }
    }
  }

  /**
   * Check API security
   */
  private checkAPISecurity(): void {
    console.log('🌐 Checking API security...');

    const apiRoutes = [
      'src/app/api/tx/seal/route.ts',
      'src/app/api/tx/retire/route.ts',
      'src/app/api/tx/burn-memo/route.ts',
    ];

    for (const route of apiRoutes) {
      const routePath = join(this.projectRoot, route);
      if (!existsSync(routePath)) continue;

      const content = readFileSync(routePath, 'utf-8');

      // Check CORS
      if (content.includes('getCorsHeaders') || content.includes('isOriginAllowed')) {
        this.addCheck(`API-001-${route}`, 'API Security', `CORS handling in ${route}`, 'LOW', 'PASS', 'CORS headers configured', 'Verify CORS policy is restrictive');
      } else {
        this.addCheck(`API-002-${route}`, 'API Security', `No CORS in ${route}`, 'MEDIUM', 'WARNING', 'CORS not explicitly handled', 'Add CORS headers', route);
      }

      // Check error handling
      if (content.includes('try {') && content.includes('catch')) {
        this.addCheck(`API-003-${route}`, 'API Security', `Error handling in ${route}`, 'LOW', 'PASS', 'Try-catch blocks found', 'Verify errors don\'t leak sensitive info');
      }
    }
  }

  /**
   * Check transaction security
   */
  private checkTransactionSecurity(): void {
    console.log('💸 Checking transaction security...');

    const builderPath = join(this.projectRoot, 'src/lib/transaction-builder.ts');
    if (!existsSync(builderPath)) return;

    const content = readFileSync(builderPath, 'utf-8');

    // Check for recent blockhash
    if (content.includes('getLatestBlockhash')) {
      this.addCheck('TX-001', 'Transaction Security', 'Recent blockhash usage', 'LOW', 'PASS', 'Transactions use recent blockhash', 'Verify blockhash expiry handled');
    }

    // Check for frozen account detection
    if (content.includes('checkNFTFrozenStatus') || content.includes('frozen')) {
      this.addCheck('TX-002', 'Transaction Security', 'Frozen account detection', 'LOW', 'PASS', 'Frozen account checks implemented', 'Verify all frozen accounts handled');
    }

    // Check for transaction size validation
    if (content.includes('validateTransactionSize')) {
      this.addCheck('TX-003', 'Transaction Security', 'Transaction size validation', 'LOW', 'PASS', 'Transaction size limits enforced', 'Verify limits match Solana requirements');
    }

    // Check for priority fees
    if (content.includes('addPriorityFee') || content.includes('addDynamicPriorityFee')) {
      this.addCheck('TX-004', 'Transaction Security', 'Priority fees implemented', 'LOW', 'PASS', 'Priority fee handling found', 'Verify fees are appropriate');
    }

    // Check for RPC failover
    if (content.includes('withRpcFailover') || content.includes('rpc-failover')) {
      this.addCheck('TX-005', 'Transaction Security', 'RPC failover implemented', 'LOW', 'PASS', 'RPC failover found', 'Verify failover works correctly');
    }
  }

  /**
   * Check cryptography
   */
  private checkCryptography(): void {
    console.log('🔑 Checking cryptography...');

    const srcFiles = this.getAllSourceFiles();

    for (const file of srcFiles) {
      const content = readFileSync(file, 'utf-8');

      // Check for Math.random (bad)
      if (content.includes('Math.random()') && !content.includes('// Test')) {
        this.addCheck('CRYPTO-001', 'Cryptography', 'Insecure random generation', 'HIGH', 'FAIL', `Math.random() found in ${file}`, 'Use crypto.randomBytes() or crypto.getRandomValues()', file);
      }

      // Check for crypto APIs (good)
      if (content.includes('crypto.subtle') || content.includes('crypto.randomBytes') || content.includes('createHash')) {
        this.addCheck('CRYPTO-002', 'Cryptography', 'Secure crypto APIs used', 'LOW', 'PASS', `Secure crypto found in ${file}`, 'Verify proper usage', file);
      }
    }
  }

  /**
   * Check logging
   */
  private checkLogging(): void {
    console.log('📝 Checking logging & privacy...');

    const srcFiles = this.getAllSourceFiles();

    for (const file of srcFiles) {
      const content = readFileSync(file, 'utf-8');

      // Check for logging private keys
      if (content.includes('console.log') && (
        content.includes('secretKey') ||
        content.includes('privateKey') ||
        content.includes('mnemonic')
      )) {
        this.addCheck('LOG-001', 'Logging', 'Potential sensitive data in logs', 'CRITICAL', 'FAIL', `Found in ${file}`, 'Never log private keys or secrets', file);
      }

      // Check for logging sensitive data
      if (content.includes('console.log') && content.includes('password')) {
        this.addCheck('LOG-002', 'Logging', 'Potential password in logs', 'HIGH', 'WARNING', `Found in ${file}`, 'Review logging statements', file);
      }
    }
  }

  /**
   * Check error handling
   */
  private checkErrorHandling(): void {
    console.log('⚠️  Checking error handling...');

    const apiRoutes = [
      'src/app/api/tx/seal/route.ts',
      'src/app/api/tx/retire/route.ts',
    ];

    for (const route of apiRoutes) {
      const routePath = join(this.projectRoot, route);
      if (!existsSync(routePath)) continue;

      const content = readFileSync(routePath, 'utf-8');

      // Check for error handling
      if (content.includes('catch') && content.includes('error')) {
        this.addCheck(`ERROR-001-${route}`, 'Error Handling', `Error handling in ${route}`, 'LOW', 'PASS', 'Try-catch blocks found', 'Verify errors are sanitized');
      }

      // Check for stack traces
      if (content.includes('error.stack') && !content.includes('// Debug')) {
        this.addCheck(`ERROR-002-${route}`, 'Error Handling', 'Stack traces in errors', 'MEDIUM', 'WARNING', `Found in ${route}`, 'Don\'t expose stack traces to users', route);
      }
    }
  }

  /**
   * Check configuration
   */
  private checkConfiguration(): void {
    console.log('⚙️  Checking configuration...');

    // Check for .env.example
    const envExamplePath = join(this.projectRoot, '.env.example');
    if (existsSync(envExamplePath)) {
      this.addCheck('CONFIG-001', 'Configuration', '.env.example present', 'LOW', 'PASS', 'Environment template found', 'Verify all required vars documented');
    }

    // Check for README security section
    const readmePath = join(this.projectRoot, 'README.md');
    if (existsSync(readmePath)) {
      const readme = readFileSync(readmePath, 'utf-8');
      if (readme.includes('security') || readme.includes('Security')) {
        this.addCheck('CONFIG-002', 'Configuration', 'Security documentation', 'LOW', 'PASS', 'Security section in README', 'Keep documentation updated');
      }
    }
  }

  /**
   * Get all source files
   */
  private getAllSourceFiles(): string[] {
    const files: string[] = [];
    const srcDir = join(this.projectRoot, 'src');

    if (!existsSync(srcDir)) return files;

    const walkDir = (dir: string): void => {
      const entries = readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Skip node_modules and .next
          if (!entry.name.includes('node_modules') && !entry.name.includes('.next')) {
            walkDir(fullPath);
          }
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          files.push(fullPath);
        }
      }
    };

    walkDir(srcDir);
    return files;
  }

  /**
   * Check for hardcoded secrets
   */
  private hasHardcodedSecrets(content: string): boolean {
    const secretPatterns = [
      /api[_-]?key['"\s]*[:=]['"\s]*[a-zA-Z0-9]{20,}/i,
      /private[_-]?key['"\s]*[:=]['"\s]*[a-zA-Z0-9]{32,}/i,
      /secret['"\s]*[:=]['"\s]*[a-zA-Z0-9]{20,}/i,
      /password['"\s]*[:=]['"\s]*[^'"]{8,}/i,
      /token['"\s]*[:=]['"\s]*[a-zA-Z0-9]{20,}/i,
    ];

    // Skip comments, test files, and documentation
    if (
      content.includes('// Example') ||
      content.includes('// Test') ||
      content.includes('example.com') ||
      content.includes('// NOTE:') ||
      content.includes('// DO NOT') ||
      content.includes('process.env') || // Environment variables are OK
      content.includes('NEXT_PUBLIC_') // Public env vars are OK
    ) {
      return false;
    }

    // Check if it's in a comment or string literal that's clearly documentation
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip comment lines
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) {
        continue;
      }
      // Check actual code
      if (secretPatterns.some(pattern => pattern.test(trimmed))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Add security check
   */
  private addCheck(
    id: string,
    category: string,
    title: string,
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
    status: 'PASS' | 'FAIL' | 'WARNING',
    details: string,
    recommendation: string,
    location?: string
  ): void {
    this.checks.push({
      id,
      category,
      title,
      severity,
      status,
      details,
      recommendation,
      location,
    });
  }

  /**
   * Print results
   */
  private printResults(): void {
    const critical = this.checks.filter(c => c.severity === 'CRITICAL' && c.status === 'FAIL').length;
    const high = this.checks.filter(c => c.severity === 'HIGH' && c.status === 'FAIL').length;
    const medium = this.checks.filter(c => c.severity === 'MEDIUM' && c.status === 'FAIL').length;
    const low = this.checks.filter(c => c.severity === 'LOW' && c.status === 'FAIL').length;
    const warnings = this.checks.filter(c => c.status === 'WARNING').length;
    const passed = this.checks.filter(c => c.status === 'PASS').length;

    const total = this.checks.length;
    const failures = critical + high + medium + low;
    const securityScore = total > 0 ? Math.round(((passed / total) * 100) - (critical * 15) - (high * 10) - (warnings * 2)) : 100;

    console.log('\n' + '='.repeat(80));
    console.log('📊 SECURITY AUDIT RESULTS');
    console.log('='.repeat(80));
    console.log(`\n📈 Security Score: ${Math.max(0, securityScore)}/100`);
    console.log(`\n📋 Summary:`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ⚠️  Warnings: ${warnings}`);
    console.log(`   🔴 Critical Failures: ${critical}`);
    console.log(`   🟠 High Failures: ${high}`);
    console.log(`   🟡 Medium Failures: ${medium}`);
    console.log(`   🟢 Low Failures: ${low}`);
    console.log(`   📊 Total Checks: ${total}`);

    if (failures > 0) {
      console.log(`\n⚠️  FAILURES:`);
      this.checks
        .filter(c => c.status === 'FAIL')
        .forEach((check, i) => {
          console.log(`\n   ${i + 1}. [${check.severity}] ${check.title}`);
          console.log(`      Category: ${check.category}`);
          if (check.location) console.log(`      Location: ${check.location}`);
          console.log(`      ${check.details}`);
          console.log(`      💡 ${check.recommendation}`);
        });
    }

    if (warnings > 0) {
      console.log(`\n⚠️  WARNINGS:`);
      this.checks
        .filter(c => c.status === 'WARNING')
        .slice(0, 5) // Show first 5 warnings
        .forEach((check, i) => {
          console.log(`\n   ${i + 1}. [${check.severity}] ${check.title}`);
          if (check.location) console.log(`      Location: ${check.location}`);
          console.log(`      💡 ${check.recommendation}`);
        });
      if (warnings > 5) {
        console.log(`\n   ... and ${warnings - 5} more warnings`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`Status: ${securityScore >= 90 ? '✅ SECURE' : securityScore >= 70 ? '⚠️  NEEDS IMPROVEMENT' : '❌ INSECURE'}`);
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Get all checks
   */
  getChecks(): SecurityCheck[] {
    return this.checks;
  }
}

// Main execution
async function main() {
  const auditor = new ComprehensiveSecurityAuditor();
  await auditor.runFullAudit();
}

if (require.main === module) {
  main().catch(console.error);
}

export { ComprehensiveSecurityAuditor, SecurityCheck };

