/** Cada evento altera apenas seu campo; os demais textos importados permanecem intactos. */
import { parseDuration, LIMITS, ProjectError } from './model.mjs';

const maps = Object.freeze({
  project: Object.freeze({ 'project-title': 'title', 'project-objective': 'objective', 'project-notes': 'notes', 'project-aspect': 'aspectRatio', 'project-target': 'targetMs' }),
  scene: Object.freeze({ 'scene-title': 'title', 'scene-visual': 'visual', 'scene-audio': 'audio', 'scene-duration': 'durationMs', 'scene-framing': 'framing', 'scene-location': 'location', 'scene-setup': 'setup', 'scene-notes': 'notes' }),
});

export function editDraft(controller, scope, field, value, errors) {
  if (!Object.hasOwn(maps, scope) || !Object.hasOwn(maps[scope], field) || !(errors instanceof Map)) throw new ProjectError('DRAFT_FIELD', 'Campo de edição não reconhecido.');
  try {
    const key = maps[scope][field];
    const parsed = key === 'targetMs' ? parseDuration(value, { maxMs: LIMITS.maxTargetMs }) : key === 'durationMs' ? parseDuration(value) : value;
    if (scope === 'project') controller.editProject({ [key]: parsed });
    else controller.editScene({ [key]: parsed });
    errors.delete(field);
  } catch (error) {
    errors.set(field, error instanceof ProjectError ? error.message : 'Não foi possível aplicar este campo. Confira o valor e tente novamente.');
  }
  controller.setIssue(scope, errors.values().next().value ?? null);
  return errors.size === 0;
}
