import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, addScene, updateScene, updateProject, serializeProject } from '../src/model.mjs';
import { createController } from '../src/controller.mjs';
import { editDraft } from '../src/draft.mjs';

test('unrelated edits preserve imported newlines, CRLF and tabs in every untouched field', () => {
  const original = updateScene(addScene(updateProject(createProject(), { title:'Parte 1\nParte 2', objective:'A\r\nB', notes:'Um\rdois' }), 'first'), 'first', { title:'Plano\nDetalhe', visual:'A\r\nB', audio:'Fala\rSom', location:'Local\nA', setup:'Tripé\rBaixo' });
  const controller = createController(original);
  editDraft(controller, 'project', 'project-target', '45', new Map());
  editDraft(controller, 'scene', 'scene-framing', 'close', new Map());
  const expected = updateScene(updateProject(original, { targetMs:45000 }), 'first', { framing:'close' });
  assert.equal(serializeProject(controller.snapshot().project), serializeProject(expected));
});

test('editing another valid field cannot hide an invalid duration or export the old value', () => {
  const controller = createController(addScene(createProject(), 'first')), errors = new Map();
  editDraft(controller, 'scene', 'scene-duration', '1:99', errors);
  assert.equal(errors.has('scene-duration'), true);
  editDraft(controller, 'scene', 'scene-title', 'Título válido', errors);
  assert.equal(controller.snapshot().project.scenes[0].title, 'Título válido');
  assert.throws(() => controller.requireReady(), { code:'DRAFT_INVALID' });
  assert.throws(() => controller.select('first'), { code:'DRAFT_INVALID' });
  editDraft(controller, 'scene', 'scene-duration', '1:09', errors);
  controller.requireReady();
  assert.equal(controller.snapshot().project.scenes[0].durationMs, 69000);
  assert.equal(errors.size, 0);
});

test('project drafts remain independent and a corrected title does not clear an invalid target', () => {
  const controller = createController(), errors = new Map();
  editDraft(controller, 'project', 'project-title', '', errors);
  editDraft(controller, 'project', 'project-target', '-1', errors);
  editDraft(controller, 'project', 'project-title', 'Roteiro novo', errors);
  assert.equal(errors.size, 1);
  assert.throws(() => controller.requireReady(), { code:'DRAFT_INVALID' });
  editDraft(controller, 'project', 'project-target', '2:00:00', errors);
  controller.requireReady();
  assert.equal(controller.snapshot().project.targetMs, 7200000);
});

test('only the intentionally edited single-line text is normalized by the browser caller', () => {
  const controller = createController(addScene(updateProject(createProject(), { title:'Primeiro\nSegundo' }), 'first'));
  editDraft(controller, 'project', 'project-title', 'PrimeiroSegundo editado', new Map());
  assert.equal(controller.snapshot().project.title, 'PrimeiroSegundo editado');
  assert.equal(controller.snapshot().project.scenes[0].durationMs, null);
});
