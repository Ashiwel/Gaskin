/**
 * Guided onboarding. The UI mounts <OnboardingWizard onComplete={…} /> when isSetupDone() is false,
 * and any screen can read the chosen setup with useSetup().
 */
export { QUESTIONS, visibleQuestions, NOT_SURE, WORKER_LANGUAGE_OPTIONS, MOTHER_LANGUAGE_LABELS } from './questions';
export type { Question, QuestionOption, QuestionKind, IconKey } from './questions';
export { recommendSetup, planChannels } from './recommend';
export { applySetupPlan } from './apply';
export type { ApplyOptions, ApplyProgress, ApplyResult, ApplyStepId } from './apply';
export { connectAssistant, setAssistantConnector, assistantConnectorReady, GASKIN_MCPB_URL, GASKIN_CONNECTOR_URL } from './assistant';
// The real MCP connector (mcp-server/): importing it replaces the stub above.
export { connectAssistant as connectAssistantDirect, setConnectorHubUrl, MCPB_FILE_NAME, LOCAL_CONNECTOR_URL } from './connectAssistant';
export type { AssistantKind, ConnectResult } from './connectAssistant';
export type { AssistantConnection, AssistantConnector } from './assistant';
export { detectSetupEnvironment, requestPosition } from './env';
export { useSetup, setupStore, getSetupPlan, isSetupDone, resetSetup, SETUP_KEY, AI_SETTINGS_KEY } from './store';
export type { SavedSetup } from './store';
export { st, langTag } from './strings';
export { OnboardingWizard } from './components/OnboardingWizard';
export type { OnboardingWizardProps } from './components/OnboardingWizard';
export { SetupIcon } from './components/icons';
export type * from './types';
