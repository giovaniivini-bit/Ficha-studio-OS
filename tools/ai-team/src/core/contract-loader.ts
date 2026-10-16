// I/O do Gate 1: le slots + DESIGN-SPECs + SHARED-CONTRACT do disco e monta o VerifyInput.
// Separado das funcoes puras pra ser reusado pelo comando CLI e pelo gate do run.ts (DRY).
import fs from 'node:fs/promises';
import path from 'node:path';
import { SLOTS_DIR } from './paths.ts';
import { loadConfig } from './config.ts';
import { scanSlots } from './slot-scanner.ts';
import type { SlotContract, VerifyInput } from './contract-verifier.ts';

async function readOr(p: string, fallback = ''): Promise<string> {
  try {
    return await fs.readFile(p, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    throw err;
  }
}

export async function loadContractInput(milestone?: string): Promise<VerifyInput> {
  const cfg = loadConfig();
  const universe = await scanSlots(); // todos os milestones — resolve deps cross-milestone
  const scoped = milestone ? universe.filter((s) => s.milestone === milestone) : universe;

  const slots: SlotContract[] = await Promise.all(
    scoped.map(async (s) => ({
      id: s.id,
      milestone: s.milestone,
      designSpec: await readOr(path.join(s.path, 'DESIGN-SPEC.md')),
      territory: s.territory,
      dependsOn: s.dependsOn,
    })),
  );
  const allSlots: SlotContract[] = universe.map((s) => ({
    id: s.id,
    milestone: s.milestone,
    designSpec: '',
    territory: s.territory,
    dependsOn: s.dependsOn,
  }));

  const milestones = [...new Set(scoped.map((s) => s.milestone))];
  const sharedContract = (
    await Promise.all(milestones.map((m) => readOr(path.join(SLOTS_DIR, m, 'SHARED-CONTRACT.md'))))
  ).join('\n');

  return { slots, sharedContract, neutralZones: cfg.neutralZones, allSlots };
}
