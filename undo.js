/* ============================================================
   undo.js — one Ctrl+Z for the whole portal
   ------------------------------------------------------------
   Every page that can lose work says how to put it back. This
   holds the key handler and the shared history, so each page
   only has to describe its own state.

     Ctrl+Z        step back
     Ctrl+Shift+Z  step forward again (or Ctrl+Y)

   While the cursor is inside a box, Ctrl+Z stays the browser's
   own undo for what is being typed — that is what anyone expects
   mid-word. Everywhere else on the page it is the portal's.
   ============================================================ */

const UNDOERS = [];

/* { when: () => true while this page is the one on screen,
     undo, redo, label } */
function registerUndo(entry) {
  UNDOERS.push(entry);
}

function activeUndoer() {
  return UNDOERS.find((u) => {
    try { return u.when(); } catch (e) { return false; }
  }) || null;
}

/* A little history, kept the same way by every page that uses it:
   a baseline of the last state we knew, pushed aside when it changes. */
function makeHistory(read, write, limit) {
  const past = [];
  const future = [];
  let baseline = null;
  const copy = (v) => JSON.parse(JSON.stringify(v));
  const cap = limit || 60;

  return {
    /* Start again from whatever is on screen now. */
    reset() {
      baseline = copy(read());
      past.length = 0;
      future.length = 0;
    },
    /* Call after a change has been made. */
    remember() {
      const now = copy(read());
      if (baseline !== null) {
        if (JSON.stringify(baseline) === JSON.stringify(now)) return;   // nothing moved
        past.push(baseline);
        if (past.length > cap) past.shift();
        future.length = 0;
      }
      baseline = now;
    },
    step(from, to) {
      if (!from.length) return false;
      const was = from.pop();
      to.push(copy(read()));
      baseline = copy(was);
      write(was);
      return true;
    },
    undo() { return this.step(past, future); },
    redo() { return this.step(future, past); },
    get depth() { return past.length; }
  };
}

document.addEventListener('keydown', (e) => {
  const key = String(e.key || '').toLowerCase();
  if (key !== 'z' && key !== 'y') return;
  if (!(e.ctrlKey || e.metaKey)) return;

  const node = document.activeElement;
  if (node && (/^(input|textarea)$/i.test(node.tagName) || node.isContentEditable)) return;

  const who = activeUndoer();
  if (!who) return;

  e.preventDefault();
  const forward = key === 'y' || e.shiftKey;
  if (forward) { if (who.redo) who.redo(); }
  else who.undo();
});

const shellShown = (id) => {
  const node = document.getElementById(id);
  return !!node && !node.classList.contains('hidden');
};
