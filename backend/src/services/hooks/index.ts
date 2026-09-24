export { hookService } from './hookService';
export { processNormalizedAlert } from './alertIngest';
export { getSourceMapping, listSourceMappings, HOOK_SOURCE_MAPPINGS, adaptGeneric } from './hookMappings';
export type {
  HookEvent,
  HookAction,
  HookSource,
  HookIngestResult,
  HookAlertResult,
  HookWakeRequest,
  HookAgentRequest,
} from './types';