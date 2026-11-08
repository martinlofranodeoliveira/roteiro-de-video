import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, addScene, updateScene, serializeProject } from '../src/model.mjs';
import { createController } from '../src/controller.mjs';

const sample = () => updateScene(addScene(createProject(), 'first'), 'first', { title: 'Primeira', durationMs: 2000 });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test('invalid visible draft blocks selection, export and replacement until corrected', () => {
  const controller = createController(addScene(sample(), 'second'));
  controller.setIssue('scene', 'Duração inválida');
  const before = serializeProject(controller.snapshot().project);
  for (const operation of [() => controller.select('second'), () => controller.setMode('recording'), () => controller.requireReady(), () => controller.replace(createProject()), () => controller.remove()]) assert.throws(operation, { code: 'DRAFT_INVALID' });
  assert.equal(serializeProject(controller.snapshot().project), before);
  controller.editScene({ durationMs: 3000 });
  controller.select('second');
  assert.equal(controller.snapshot().selectedId, 'second');
});

test('failed asynchronous import preserves document and selection', async () => {
  const controller = createController(sample());
  const original = controller.snapshot().project;
  await assert.rejects(controller.replaceAsync(async () => { throw new Error('invalid PNG'); }));
  assert.strictEqual(controller.snapshot().project, original);
  assert.equal(controller.snapshot().selectedId, 'first');
  assert.equal(controller.snapshot().busy, false);
});

test('stale import never replaces newer edits or an invalid draft', async () => {
  for (const edit of [c => c.editScene({ title: 'Alterado durante a leitura' }), c => c.setIssue('scene', 'Duração inválida')]) {
    const controller = createController(sample()), wait = deferred();
    const pending = controller.replaceAsync(() => wait.promise);
    edit(controller);
    const current = controller.snapshot().project;
    wait.resolve(createProject());
    await assert.rejects(pending, { code: 'LOAD_STALE' });
    assert.strictEqual(controller.snapshot().project, current);
    assert.equal(controller.snapshot().busy, false);
  }
});

test('one load at a time and no stuck busy flag on invalid documents', async () => {
  const controller = createController(sample()), wait = deferred();
  const first = controller.replaceAsync(() => wait.promise);
  await assert.rejects(controller.replaceAsync(async () => createProject()), { code: 'LOAD_BUSY' });
  wait.resolve({ schemaVersion: 999 });
  await assert.rejects(first);
  assert.equal(controller.snapshot().busy, false);
  assert.equal(controller.snapshot().project.title, 'Meu roteiro');
});

test('selection changes also invalidate an image or document in flight', async () => {
  const controller = createController(addScene(sample(), 'second')), wait = deferred();
  const first = controller.referenceAsync(() => wait.promise);
  controller.select('second');
  wait.resolve(null);
  await assert.rejects(first, { code: 'LOAD_STALE' });
  assert.equal(controller.snapshot().selectedId, 'second');
});

test('remove and undo restore exact portable content and original selection', () => {
  const controller = createController(addScene(sample(), 'second'));
  const original = serializeProject(controller.snapshot().project);
  controller.remove();
  assert.equal(controller.snapshot().selectedId, 'second');
  assert.equal(controller.snapshot().canUndo, true);
  controller.undoRemove();
  assert.equal(serializeProject(controller.snapshot().project), original);
  assert.equal(controller.snapshot().selectedId, 'first');
  assert.equal(controller.snapshot().canUndo, false);
});

test('new edits clear old remove undo and keep metadata draft issues separate', () => {
  const controller = createController(addScene(sample(), 'second'));
  controller.remove();
  controller.setIssue('project', 'Meta inválida');
  controller.editScene({ title: 'Cena editada' });
  assert.equal(controller.snapshot().canUndo, false);
  assert.deepEqual(controller.snapshot().issues, { project: 'Meta inválida' });
  controller.editProject({ targetMs: 12000 });
  assert.deepEqual(controller.snapshot().issues, {});
});

test('notifications expose immutable snapshots and unsubscribe works', () => {
  const controller = createController(sample()), seen = [];
  const off = controller.subscribe(state => seen.push(state));
  controller.duplicate('copy');
  off(); controller.move(-1);
  assert.equal(seen.length, 1);
  assert.ok(Object.isFrozen(seen[0]));
  assert.ok(Object.isFrozen(seen[0].project));
  assert.equal(seen[0].selectedId, 'copy');
  assert.deepEqual(controller.snapshot().project.scenes.map(x => x.id), ['copy', 'first']);
});
