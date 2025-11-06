/**
 * Security Audit Runner for KILN Teleburn Protocol
 * 
 * Comprehensive security audit that tests all critical security controls
 * against the actual KILN implementation.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

interface SecurityFinding {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  title: string;
  description: string;
  location?: string;
  recommendation: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
}

interface AuditReport {
  timestamp: string;
  totalFindings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  securityScore: number;
  findings: SecurityFinding[];
  recommendations: string[];
}

class SecurityAuditor {
  private findings: SecurityFinding[] = [];
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Run comprehensive security audit
   */
  async runFullAudit(): Promise<AuditReport> {
    console.log('🔒 Starting KILN Security Audit...\n');

    // Phase 1: Dependency Security
    this.auditDependencies();

    // Phase 2: Code Security
    this.auditCodeSecurity();

    // Phase 3: Input Validation
    this.auditInputValidation();

    // Phase 4: Authentication & Authorization
    this.auditAuthAndAuthorization();

    // Phase 5: Cryptography
    this.auditCryptography();

    // Phase 6: Transaction Security
    this.auditTransactionSecurity();

    // Phase 7: API Security
    this.auditAPISecurity();

    // Phase 8: Logging & Privacy
    this.auditLoggingAndPrivacy();

    // Phase 9: Configuration Security
    this.auditConfiguration();

    // Generate report
    return this.generateReport();
  }

  /**
   * Audit dependencies for vulnerabilities
   */
  private auditDependencies(): void {
    console.log('📦 Auditing dependencies...');

    try {
      const auditOutput = execSync('npm audit --json', { encoding: 'utf-8', cwd: this.projectRoot });
      const audit = JSON.parse(auditOutput);

      if (audit.vulnerabilities) {
        const critical = audit.vulnerabilities.critical || 0;
        const high = audit.vulnerabilities.high || 0;

        if (critical > 0) {
          this.addFinding({
            severity: 'CRITICAL',
            category: 'Dependencies',
            title: 'Critical dependency vulnerabilities',
            description: `Found ${critical} critical vulnerabilities in dependencies`,
            recommendation: 'Run `npm audit fix` and review breaking changes',
            status: 'FAIL',
          });
        }

        if (high > 0) {
          this.addFinding({
            severity: 'HIGH',
            category: 'Dependencies',
            title: 'High severity dependency vulnerabilities',
            description: `Found ${high} high severity vulnerabilities`,
            recommendation: 'Update vulnerable packages immediately',
            status: 'WARNING',
          });
        }
      }
    } catch (error) {
      this.addFinding({
        severity: 'MEDIUM',
        category: 'Dependencies',
        title: 'Could not run npm audit',
        description: 'npm audit command failed',
        recommendation: 'Manually verify dependencies are up to date',
        status: 'WARNING',
      });
    }
  }

  /**
   * Audit code for security issues
   */
  private auditCodeSecurity(): void {
    console.log('🔍 Auditing code security...');

    const criticalFiles = [
      'src/lib/transaction-builder.ts',
      'src/lib/teleburn.ts',
      'src/app/api/tx/seal/route.ts',
      'src/app/api/tx/retire/route.ts',
    ];

    for (const file of criticalFiles) {
      const filePath = join(this.projectRoot, file);
      if (!existsSync(filePath)) continue;

      const content = readFileSync(filePath, 'utf-8');

      // Check for hardcoded secrets
      if (this.checkForHardcodedSecrets(content)) {
        this.addFinding({
          severity: 'CRITICAL',
          category: 'Code Security',
          title: 'Hardcoded secrets detected',
          description: `Potential hardcoded secrets in ${file}`,
          location: file,
          recommendation: 'Remove all hardcoded secrets, use environment variables',
          status: 'FAIL',
        });
      }

      // Check for eval/Function
      if (content.includes('eval(') || content.includes('new Function')) {
        this.addFinding({
          severity: 'CRITICAL',
          category: 'Code Security',
          title: 'Dangerous code execution',
          description: `eval() or Function() constructor found in ${file}`,
          location: file,
          recommendation: 'Remove eval/Function usage immediately',
          status: 'FAIL',
        });
      }

      // Check for private key storage
      if (content.includes('secretKey') && !content.includes('// DO NOT STORE')) {
        this.addFinding({
          severity: 'CRITICAL',
          category: 'Code Security',
          title: 'Potential private key storage',
          description: `Private key handling in ${file} - verify no storage`,
          location: file,
          recommendation: 'Ensure private keys are never stored',
          status: 'WARNING',
        });
      }
    }
  }

  /**
   * Check for hardcoded secrets
   */
  private checkForHardcodedSecrets(content: string): boolean {
    const secretPatterns = [
      /api[_-]?key['"\s]*[:=]['"\s]*[a-zA-Z0-9]{20,}/i,
      /private[_-]?key['"\s]*[:=]['"\s]*[a-zA-Z0-9]{32,}/i,
      /secret['"\s]*[:=]['"\s]*[a-zA-Z0-9]{20,}/i,
      /password['"\s]*[:=]['"\s]*[^'"]{8,}/i,
      /token['"\s]*[:=]['"\s]*[a-zA-Z0-9]{20,}/i,
    ];

    return secretPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Audit input validation
   */
  private auditInputValidation(): void {
    console.log('✅ Auditing input validation...');

    // Check schemas.ts for validation
    const schemasPath = join(this.projectRoot, 'src/lib/schemas.ts');
    if (existsSync(schemasPath)) {
      const content = readFileSync(schemasPath, 'utf-8');

      // Check for Zod schemas
      if (content.includes('z.object') && content.includes('z.string')) {
        this.addFinding({
          severity: 'LOW',
          category: 'Input Validation',
          title: 'Zod validation schemas present',
          description: 'Input validation using Zod schemas detected',
          location: 'src/lib/schemas.ts',
          recommendation: 'Verify all user inputs use these schemas',
          status: 'PASS',
        });
      } else {
        this.addFinding({
          severity: 'HIGH',
          category: 'Input Validation',
          title: 'Missing input validation',
          description: 'No validation schemas found',
          recommendation: 'Implement Zod schemas for all user inputs',
          status: 'FAIL',
        });
      }
    }
  }

  /**
   * Audit authentication and authorization
   */
  private auditAuthAndAuthorization(): void {
    console.log('🔐 Auditing authentication & authorization...');

    // Check rate limiter
    const rateLimiterPath = join(this.projectRoot, 'src/lib/rate-limiter.ts');
    if (existsSync(rateLimiterPath)) {
      this.addFinding({
        severity: 'LOW',
        category: 'Authorization',
        title: 'Rate limiting implemented',
        description: 'Rate limiter module found',
        location: 'src/lib/rate-limiter.ts',
        recommendation: 'Verify rate limits are appropriate for production',
        status: 'PASS',
      });
    } else {
      this.addFinding({
        severity: 'HIGH',
        category: 'Authorization',
        title: 'Rate limiting not found',
        description: 'No rate limiting implementation detected',
        recommendation: 'Implement rate limiting for all API endpoints',
        status: 'FAIL',
      });
    }

    // Check emergency shutdown
    const shutdownPath = join(this.projectRoot, 'src/lib/emergency-shutdown.ts');
    if (existsSync(shutdownPath)) {
      this.addFinding({
        severity: 'LOW',
        category: 'Authorization',
        title: 'Emergency shutdown mechanism present',
        description: 'Emergency shutdown feature implemented',
        location: 'src/lib/emergency-shutdown.ts',
        recommendation: 'Test emergency shutdown procedure',
        status: 'PASS',
      });
    }
  }

  /**
   * Audit cryptography
   */
  private auditCryptography(): void {
    console.log('🔑 Auditing cryptography...');

    // Check for crypto usage
    const teleburnPath = join(this.projectRoot, 'src/lib/teleburn.ts');
    if (existsSync(teleburnPath)) {
      const content = readFileSync(teleburnPath, 'utf-8');

      if (content.includes('crypto.subtle') || content.includes('createHash')) {
        this.addFinding({
          severity: 'LOW',
          category: 'Cryptography',
          title: 'Cryptographic functions used',
          description: 'Proper crypto APIs detected',
          location: 'src/lib/teleburn.ts',
          recommendation: 'Verify using secure random generators',
          status: 'PASS',
        });
      }

      // Check for Math.random (bad)
      if (content.includes('Math.random()')) {
        this.addFinding({
          severity: 'HIGH',
          category: 'Cryptography',
          title: 'Insecure random number generation',
          description: 'Math.random() found - not cryptographically secure',
          location: 'src/lib/teleburn.ts',
          recommendation: 'Use crypto.randomBytes() or crypto.getRandomValues()',
          status: 'FAIL',
        });
      }
    }
  }

  /**
   * Audit transaction security
   */
  private auditTransactionSecurity(): void {
    console.log('💸 Auditing transaction security...');

    const builderPath = join(this.projectRoot, 'src/lib/transaction-builder.ts');
    if (existsSync(builderPath)) {
      const content = readFileSync(builderPath, 'utf-8');

      // Check for recent blockhash
      if (content.includes('getLatestBlockhash')) {
        this.addFinding({
          severity: 'LOW',
          category: 'Transaction Security',
          title: 'Recent blockhash usage',
          description: 'Transactions use recent blockhash',
          location: 'src/lib/transaction-builder.ts',
          recommendation: 'Verify blockhash expiry is handled',
          status: 'PASS',
        });
      }

      // Check for frozen account detection
      if (content.includes('checkNFTFrozenStatus') || content.includes('frozen')) {
        this.addFinding({
          severity: 'LOW',
          category: 'Transaction Security',
          title: 'Frozen account detection',
          description: 'Frozen account checks implemented',
          location: 'src/lib/transaction-builder.ts',
          recommendation: 'Verify all frozen accounts are handled',
          status: 'PASS',
        });
      }

      // Check for transaction size validation
      if (content.includes('validateTransactionSize')) {
        this.addFinding({
          severity: 'LOW',
          category: 'Transaction Security',
          title: 'Transaction size validation',
          description: 'Transaction size limits enforced',
          location: 'src/lib/transaction-builder.ts',
          recommendation: 'Verify limits match Solana requirements',
          status: 'PASS',
        });
      }
    }
  }

  /**
   * Audit API security
   */
  private auditAPISecurity(): void {
    console.log('🌐 Auditing API security...');

    const apiRoutes = [
      'src/app/api/tx/seal/route.ts',
      'src/app/api/tx/retire/route.ts',
      'src/app/api/tx/burn-memo/route.ts',
    ];

    for (const route of apiRoutes) {
      const routePath = join(this.projectRoot, route);
      if (!existsSync(routePath)) continue;

      const content = readFileSync(routePath, 'utf-8');

      // Check for rate limiting
      if (content.includes('checkRateLimit')) {
        this.addFinding({
          severity: 'LOW',
          category: 'API Security',
          title: 'Rate limiting on API route',
          description: `Rate limiting implemented in ${route}`,
          location: route,
          recommendation: 'Verify rate limits are appropriate',
          status: 'PASS',
        });
      } else {
        this.addFinding({
          severity: 'HIGH',
          category: 'API Security',
          title: 'Missing rate limiting',
          description: `No rate limiting found in ${route}`,
          location: route,
          recommendation: 'Add rate limiting to all API routes',
          status: 'FAIL',
        });
      }

      // Check for emergency shutdown
      if (content.includes('checkEmergencyShutdown')) {
        this.addFinding({
          severity: 'LOW',
          category: 'API Security',
          title: 'Emergency shutdown on API route',
          description: `Emergency shutdown check in ${route}`,
          location: route,
          recommendation: 'Test emergency shutdown procedure',
          status: 'PASS',
        });
      }

      // Check for CORS
      if (content.includes('getCorsHeaders') || content.includes('Access-Control')) {
        this.addFinding({
          severity: 'LOW',
          category: 'API Security',
          title: 'CORS headers configured',
          description: `CORS handling in ${route}`,
          location: route,
          recommendation: 'Verify CORS policy is restrictive',
          status: 'PASS',
        });
      }
    }
  }

  /**
   * Audit logging and privacy
   */
  private auditLoggingAndPrivacy(): void {
    console.log('📝 Auditing logging & privacy...');

    // Check for sensitive data in logs
    const filesToCheck = [
      'src/lib/transaction-builder.ts',
      'src/app/api/tx/seal/route.ts',
    ];

    for (const file of filesToCheck) {
      const filePath = join(this.projectRoot, file);
      if (!existsSync(filePath)) continue;

      const content = readFileSync(filePath, 'utf-8');

      // Check for logging private keys
      if (content.includes('console.log') && content.includes('secretKey')) {
        this.addFinding({
          severity: 'CRITICAL',
          category: 'Logging & Privacy',
          title: 'Private keys in logs',
          description: `Potential private key logging in ${file}`,
          location: file,
          recommendation: 'Never log private keys or secrets',
          status: 'FAIL',
        });
      }

      // Check for logging sensitive data
      if (content.includes('console.log') && (
        content.includes('privateKey') ||
        content.includes('mnemonic') ||
        content.includes('seed')
      )) {
        this.addFinding({
          severity: 'HIGH',
          category: 'Logging & Privacy',
          title: 'Sensitive data in logs',
          description: `Potential sensitive data logging in ${file}`,
          location: file,
          recommendation: 'Review all console.log statements for sensitive data',
          status: 'WARNING',
        });
      }
    }
  }

  /**
   * Audit configuration
   */
  private auditConfiguration(): void {
    console.log('⚙️  Auditing configuration...');

    // Check for .env.example
    const envExamplePath = join(this.projectRoot, '.env.example');
    if (existsSync(envExamplePath)) {
      this.addFinding({
        severity: 'LOW',
        category: 'Configuration',
        title: '.env.example present',
        description: 'Environment variable template found',
        location: '.env.example',
        recommendation: 'Verify all required secrets are documented',
        status: 'PASS',
      });
    }

    // Check for .env in gitignore
    const gitignorePath = join(this.projectRoot, '.gitignore');
    if (existsSync(gitignorePath)) {
      const gitignore = readFileSync(gitignorePath, 'utf-8');
      if (gitignore.includes('.env')) {
        this.addFinding({
          severity: 'LOW',
          category: 'Configuration',
          title: '.env in .gitignore',
          description: 'Environment files excluded from git',
          location: '.gitignore',
          recommendation: 'Verify .env.local also excluded',
          status: 'PASS',
        });
      } else {
        this.addFinding({
          severity: 'HIGH',
          category: 'Configuration',
          title: '.env not in .gitignore',
          description: 'Environment files may be committed',
          location: '.gitignore',
          recommendation: 'Add .env* to .gitignore',
          status: 'FAIL',
        });
      }
    }
  }

  /**
   * Add security finding
   */
  private addFinding(finding: SecurityFinding): void {
    this.findings.push(finding);
  }

  /**
   * Generate security audit report
   */
  private generateReport(): AuditReport {
    const critical = this.findings.filter(f => f.severity === 'CRITICAL' && f.status === 'FAIL').length;
    const high = this.findings.filter(f => f.severity === 'HIGH' && f.status === 'FAIL').length;
    const medium = this.findings.filter(f => f.severity === 'MEDIUM' && f.status === 'FAIL').length;
    const low = this.findings.filter(f => f.severity === 'LOW' && f.status === 'FAIL').length;

    const totalFindings = this.findings.length;
    const passed = this.findings.filter(f => f.status === 'PASS').length;

    // Calculate security score (0-100)
    const securityScore = totalFindings > 0
      ? Math.round((passed / totalFindings) * 100 - (critical * 10) - (high * 5))
      : 100;

    const recommendations = this.generateRecommendations();

    const report: AuditReport = {
      timestamp: new Date().toISOString(),
      totalFindings,
      critical,
      high,
      medium,
      low,
      securityScore: Math.max(0, securityScore),
      findings: this.findings,
      recommendations,
    };

    return report;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    const criticalIssues = this.findings.filter(f => f.severity === 'CRITICAL' && f.status === 'FAIL');
    if (criticalIssues.length > 0) {
      recommendations.push(`🔴 CRITICAL: Fix ${criticalIssues.length} critical security issues before deployment`);
    }

    const highIssues = this.findings.filter(f => f.severity === 'HIGH' && f.status === 'FAIL');
    if (highIssues.length > 0) {
      recommendations.push(`🟠 HIGH: Address ${highIssues.length} high priority security issues`);
    }

    if (criticalIssues.length === 0 && highIssues.length === 0) {
      recommendations.push('✅ No critical or high severity issues found');
    }

    recommendations.push('📋 Review all findings and implement recommendations');
    recommendations.push('🧪 Run security tests in CI/CD pipeline');
    recommendations.push('🔍 Conduct manual penetration testing before mainnet launch');

    return recommendations;
  }

  /**
   * Save report to file
   */
  saveReport(report: AuditReport, outputPath: string): void {
    const reportPath = join(this.projectRoot, outputPath);
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: ${reportPath}`);
  }

  /**
   * Print report summary
   */
  printSummary(report: AuditReport): void {
    console.log('\n' + '='.repeat(80));
    console.log('🔒 KILN SECURITY AUDIT REPORT');
    console.log('='.repeat(80));
    console.log(`\n📅 Date: ${new Date(report.timestamp).toLocaleString()}`);
    console.log(`\n📊 Security Score: ${report.securityScore}/100`);

    console.log(`\n📋 Findings Summary:`);
    console.log(`   🔴 Critical: ${report.critical}`);
    console.log(`   🟠 High: ${report.high}`);
    console.log(`   🟡 Medium: ${report.medium}`);
    console.log(`   🟢 Low: ${report.low}`);
    console.log(`   ✅ Passed: ${report.findings.filter(f => f.status === 'PASS').length}`);

    console.log(`\n🎯 Recommendations:`);
    report.recommendations.forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec}`);
    });

    if (report.critical > 0 || report.high > 0) {
      console.log(`\n⚠️  Critical/High Findings:`);
      report.findings
        .filter(f => (f.severity === 'CRITICAL' || f.severity === 'HIGH') && f.status === 'FAIL')
        .forEach((finding, i) => {
          console.log(`\n   ${i + 1}. [${finding.severity}] ${finding.title}`);
          console.log(`      Location: ${finding.location || 'N/A'}`);
          console.log(`      ${finding.description}`);
          console.log(`      💡 ${finding.recommendation}`);
        });
    }

    console.log('\n' + '='.repeat(80));
    console.log(`Status: ${report.securityScore >= 90 ? '✅ SECURE' : report.securityScore >= 70 ? '⚠️  NEEDS IMPROVEMENT' : '❌ INSECURE'}`);
    console.log('='.repeat(80) + '\n');
  }
}

// Main execution
async function main() {
  const auditor = new SecurityAuditor();
  const report = await auditor.runFullAudit();
  
  auditor.printSummary(report);
  auditor.saveReport(report, 'security-reports/audit-report.json');

  // Exit with appropriate code
  if (report.critical > 0 || report.high > 5) {
    process.exit(1); // Fail CI/CD
  } else {
    process.exit(0); // Pass
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { SecurityAuditor };
export type { SecurityFinding, AuditReport };

