import { loadContractInput } from '../core/contract-loader.ts';
import { verifyContract } from '../core/contract-verifier.ts';

export async function verifyContractCmd(milestone?: string): Promise<void> {
  const input = await loadContractInput(milestone);
  const result = verifyContract(input);
  for (const f of result.findings) {
    const tag = f.severity === 'critical' ? 'CRITICAL' : 'warning';
    console.log(`[${tag}] ${f.rule}${f.slot ? ` ${f.slot}` : ''}: ${f.message}`);
  }
  if (result.ok) {
    console.log(`\ncontrato OK (${result.findings.length} aviso(s)).`);
    process.exit(0);
  }
  console.error('\ncontrato REPROVADO - Arquiteto precisa re-specar antes do fan-out.');
  process.exit(1);
}
