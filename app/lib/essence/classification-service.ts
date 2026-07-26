/**
 * Essence · Classification Service
 *
 * Implements EssenceClassificationAPI. Phase 1A ships a deterministic stub —
 * all calls return status:'unsupported' so callers get a typed result rather
 * than a runtime exception. A real classifier replaces this in Phase 2.
 */

import type { AgentName } from './access';
import type { ClassificationResult, EssenceClassificationAPI } from './api';

export class EssenceClassificationService implements EssenceClassificationAPI {
  async classifyInformation(
    _content: string,
    _requestedBy: AgentName,
  ): Promise<ClassificationResult> {
    return {
      status: 'unsupported',
      reason: 'Automatic classification is not available in this version. Provide nodeId explicitly.',
    };
  }
}
