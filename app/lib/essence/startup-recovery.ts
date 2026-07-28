/**
 * Essence · Startup Recovery Entry Point (M0-14)
 *
 * Called once from instrumentation.ts (Next.js register hook) on server startup.
 * Uses the singleton repositories shared with the API routes so the recovery
 * runner and the live routes operate over the same proposal store.
 */

import { getRepository } from './server-repository';
import { getProposalRepository } from './proposal-server-repository';
import { getTimelineRepository } from './timeline-server-repository';
import { EssenceProposalService } from './proposal-service';
import { PhilosReviewConsumer } from './philos-review-consumer';
import { EssenceRecoveryRunner } from './recovery-runner';
import { PipelineRunner } from './pipeline-runner';

export async function runStartupRecovery(): Promise<void> {
  const proposalRepo = getProposalRepository();
  const timelineRepo = getTimelineRepository();
  const svc = new EssenceProposalService(getRepository(), proposalRepo, new PipelineRunner(), undefined, undefined, timelineRepo);
  const philos = new PhilosReviewConsumer(svc, undefined, timelineRepo);
  const runner = new EssenceRecoveryRunner(proposalRepo, philos, undefined, timelineRepo);
  const report = await runner.run();
  console.log('[essence] startup recovery complete:', report);
}
