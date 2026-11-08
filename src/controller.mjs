/** Sessão de edição local; nenhum conteúdo é persistido implicitamente. */
import {
  createProject, validateProject, updateProject, updateScene, addScene,
  moveScene, duplicateScene, removeScene, ProjectError,
} from './model.mjs';

export function createController(initial = createProject()) {
  let project = validateProject(initial), selectedId = project.scenes[0]?.id ?? null;
  let mode = 'narrative', version = 0, busy = false, undo = null;
  const issues = new Map(), subscribers = new Set();
  const fail = (code, message) => { throw new ProjectError(code, message); };
  const ready = () => { if (issues.size) fail('DRAFT_INVALID', 'Corrija os campos destacados antes de continuar.'); };
  const emit = () => { for (const subscriber of [...subscribers]) subscriber(snapshot()); };
  const snapshot = () => Object.freeze({ project, selectedId, mode, version, busy,
    canUndo: undo !== null, issues: Object.freeze(Object.fromEntries(issues)) });
  function commit(next, selection = selectedId, { preserveUndo = false } = {}) {
    project = validateProject(next);
    selectedId = project.scenes.some(scene => scene.id === selection) ? selection : project.scenes[0]?.id ?? null;
    if (!preserveUndo) undo = null;
    version += 1;
    emit();
    return snapshot();
  }
  async function load(loader, apply) {
    ready();
    if (busy) fail('LOAD_BUSY', 'Aguarde o carregamento atual terminar.');
    if (typeof loader !== 'function') fail('LOAD_INVALID', 'Não foi possível iniciar o carregamento.');
    const expected = version;
    busy = true; emit();
    try {
      const value = await loader();
      if (expected !== version) fail('LOAD_STALE', 'O roteiro mudou durante a leitura. As alterações foram preservadas; abra o arquivo novamente.');
      ready();
      return apply(value);
    } finally { busy = false; emit(); }
  }
  return Object.freeze({
    snapshot,
    subscribe(listener) {
      if (typeof listener !== 'function') fail('LISTENER_INVALID', 'O observador deve ser uma função.');
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
    requireReady: ready,
    setIssue(key, message = null) {
      if (!['project', 'scene'].includes(key) || (message !== null && typeof message !== 'string')) fail('ISSUE_INVALID', 'Estado de edição inválido.');
      const previous = issues.get(key);
      if (message === null) issues.delete(key); else issues.set(key, message);
      if (previous !== issues.get(key)) { version += 1; emit(); }
    },
    editProject(patch) {
      const next = updateProject(project, patch);
      issues.delete('project');
      return commit(next);
    },
    editScene(patch) {
      if (selectedId === null) fail('SCENE_REQUIRED', 'Adicione uma cena para editar.');
      const next = updateScene(project, selectedId, patch);
      issues.delete('scene');
      return commit(next);
    },
    select(id) {
      ready();
      if (!project.scenes.some(scene => scene.id === id)) fail('SCENE_UNKNOWN', 'A cena não foi encontrada.');
      if (selectedId !== id) { selectedId = id; version += 1; emit(); }
      return snapshot();
    },
    setMode(next) {
      ready();
      if (!['narrative', 'recording'].includes(next)) fail('VIEW_INVALID', 'Escolha uma visão válida.');
      if (mode !== next) { mode = next; version += 1; emit(); }
      return snapshot();
    },
    add(id) { ready(); return commit(addScene(project, id, selectedId), id); },
    move(delta) { ready(); return commit(moveScene(project, selectedId, delta)); },
    duplicate(id) { ready(); return commit(duplicateScene(project, selectedId, id), id); },
    remove() {
      ready();
      if (selectedId === null) fail('SCENE_REQUIRED', 'Escolha uma cena para remover.');
      const before = project, oldId = selectedId;
      const position = project.scenes.findIndex(scene => scene.id === selectedId);
      const next = removeScene(project, selectedId);
      undo = { project: before, selectedId: oldId };
      return commit(next, next.scenes[Math.min(position, next.scenes.length - 1)]?.id ?? null, { preserveUndo: true });
    },
    undoRemove() {
      ready();
      if (undo === null) fail('UNDO_EMPTY', 'Não há remoção para desfazer.');
      const previous = undo;
      return commit(previous.project, previous.selectedId);
    },
    replace(value) {
      ready();
      const next = validateProject(value);
      issues.clear();
      return commit(next, next.scenes[0]?.id ?? null);
    },
    replaceAsync(loader) {
      return load(loader, value => {
        const next = validateProject(value);
        return commit(next, next.scenes[0]?.id ?? null);
      });
    },
    referenceAsync(loader) {
      const originalId = selectedId;
      if (originalId === null) fail('SCENE_REQUIRED', 'Escolha uma cena antes de adicionar a referência.');
      return load(loader, reference => commit(updateScene(project, originalId, { reference }), originalId));
    },
  });
}
