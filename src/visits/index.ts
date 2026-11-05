/**
 * Guided visit checklists (src/visits). Contract: CONTRACTS.md, "Visits".
 */
export { buildVisitChecklist, checklistToEvents, dueTemplateId, evaluateFindings, findingsFor, findingsToAlerts, isItemActive, plainVaccines, referralAlerts, vaccinePlan, VACCINE_PLAIN } from './build';
export type { BuildOptions } from './build';
export { CATALOGUE, VISIT_TEMPLATES, TEMPLATE_BY_ID, SECTION_TITLES, SECTION_ORDER } from './catalogue';
export type { VisitTemplate, CatalogueItem } from './catalogue';
export { CDC_MILESTONES, WHO_MOTOR_WINDOWS, milestoneSetFor, nextMilestoneSet } from './milestones';
export type { Milestone, MilestoneSet, MotorWindow } from './milestones';
export { VISIT_TEXT, renderVisitText, visitTemplate } from './text';
export { VISIT_CITATIONS } from './sources';
export type { VisitChecklist, ChecklistItem, ChecklistResult, ChecklistSection, Finding, FindingSpec, FindingAction, ItemInput, VisitSection } from './types';
export { VisitChecklist as VisitChecklistView } from './components/VisitChecklist';
export type { VisitChecklistProps } from './components/VisitChecklist';
