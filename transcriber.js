/* ============================================================
   transcriber.js — the Audio Transcriber tab on a sales board
   ------------------------------------------------------------
   For setters writing their handoffs: drop the call recording from
   Close, wait a few seconds, copy the transcript.

     1. the browser asks the server for a one-time upload address
     2. the recording uploads straight to private storage
     3. the server sends it to Groq, returns the words, deletes the file

   A Loom at the top explains it; the owner sets that link here, and
   every offer shows the same one.
   ============================================================ */

const TRANSCRIBE = { busy: false, lastText: '' };

/* The handoff form every offer starts with. The owner can change it for
   all offers, or give one offer its own. */
const DEFAULT_HANDOFF = [
  'LEAD',
  'Name:',
  'Contact (IG / phone):',
  'Call date + time (their timezone):',
  '',
  'THEIR SITUATION',
  'What they\'re currently struggling with:',
  'How long they\'ve been struggling with it:',
  'What they do for work:',
  'How long they\'ve been doing that:',
  '',
  'WHAT THEY NEED',
  'What they said they need help with:',
  'What it\'s costing them to not fix it:',
  '',
  'WHAT THEY WANT',
  'What they want to achieve:',
  'Why it matters to them:',
  '',
  'CAPITAL',
  'What they have set aside to invest in the program:',
  'What they have set aside to work with once they\'re in:'
].join('\n');

const HANDOFF_KEY = 'handoff-form';

const CLAUDE_INSTRUCTION = 'Using only what was said in this call transcript, fill out the handoff form below. ' +
  'If something wasn\'t mentioned, write "Not mentioned". Keep each answer short and specific.';

function offerHandoff() {
  const own = CACHE.board && CACHE.board.directory && CACHE.board.directory.repHub && CACHE.board.directory.repHub[HANDOFF_KEY];
  return typeof own === 'string' && own.trim() ? own : null;
}

function sharedHandoff() {
  const saved = CACHE.repHub && CACHE.repHub.handoffForm;
  return typeof saved === 'string' && saved.trim() ? saved : DEFAULT_HANDOFF;
}

const currentHandoff = () => offerHandoff() || sharedHandoff();

function renderHandoff() {
  const owner = CACHE.role === 'owner';
  const own = offerHandoff();
  $('#trHandoffText').textContent = currentHandoff();
  $('#trHandoffEdit').classList.toggle('hidden', !owner);
  $('#trHandoffSub').textContent = owner
    ? (own ? 'This offer’s own form — other offers use the shared one' : 'Shared by every offer')
    : 'What Claude fills out from the call';
}

function openHandoffEditor() {
  $('#trHandoffInput').value = currentHandoff();
  $('#trHandoffScope').value = offerHandoff() ? 'offer' : 'all';
  paintScopeNote();
  $('#trHandoffText').classList.add('hidden');
  $('#trHandoffEditor').classList.remove('hidden');
  $('#trHandoffEdit').classList.add('hidden');
  $('#trHandoffInput').focus();
}

function closeHandoffEditor() {
  $('#trHandoffEditor').classList.add('hidden');
  $('#trHandoffText').classList.remove('hidden');
  renderHandoff();
}

function paintScopeNote() {
  $('#trHandoffScopeNote').textContent = $('#trHandoffScope').value === 'offer'
    ? 'Only ' + ((CACHE.board && CACHE.board.name) || 'this offer') + ' uses this form. Every other offer keeps the shared one.'
    : 'Every offer uses this form' + (offerHandoff() ? ' — this offer’s own form will be removed.' : '.');
}

async function saveHandoff() {
  const text = $('#trHandoffInput').value.replace(/\s+$/, '');
  if (!text.trim()) { notify('The form can’t be empty.'); return; }
  const scope = $('#trHandoffScope').value;
  const button = $('#trHandoffSave');
  button.disabled = true;
  try {
    if (scope === 'offer') {
      await saveOfferHubValue(HANDOFF_KEY, text);
    } else {
      CACHE.repHub.handoffForm = text;
      await saveRepHubTemplate();
      if (offerHandoff()) await saveOfferHubValue(HANDOFF_KEY, null);
    }
  } catch (err) {
    console.error(err);
    notify("Couldn't save the form — check your connection.");
    return;
  } finally {
    button.disabled = false;
  }
  closeHandoffEditor();
  notify(scope === 'offer' ? 'Saved for this offer only.' : 'Saved for every offer.');
}

async function copyText(text, button, doneLabel) {
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try { document.execCommand('copy'); } catch (e) { /* nothing more to try */ }
    area.remove();
  }
  button.textContent = doneLabel || 'Copied ✓';
  button.classList.add('is-copied');
  setTimeout(() => { button.textContent = original; button.classList.remove('is-copied'); }, 2200);
}
const AUDIO_TYPES = /\.(mp3|m4a|wav|webm|ogg|oga|mp4|mpeg|mpga|flac|aac)$/i;
const AUDIO_LIMIT = 25 * 1024 * 1024;

function formatDuration(seconds) {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? m + ' min ' + String(s).padStart(2, '0') + ' s' : s + ' s';
}

function formatSize(bytes) {
  return bytes > 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + ' MB' : Math.round(bytes / 1024) + ' KB';
}

/* ---------- the Loom at the top ---------- */
function renderTranscriberGuide() {
  const host = $('#transcriberGuide');
  host.textContent = '';
  const url = (CACHE.repHub && CACHE.repHub.transcriberLoom) || '';
  const embed = url ? embedFor(url) : '';

  if (embed) {
    const frame = document.createElement('iframe');
    frame.src = embed;
    frame.title = 'How to use the Audio Transcriber';
    frame.loading = 'lazy';
    frame.allowFullscreen = true;
    frame.setAttribute('allow', 'fullscreen; picture-in-picture');
    frame.className = 'hub-frame tr-video';
    host.appendChild(frame);
  }

  if (CACHE.role === 'owner') {
    const row = el('div', 'tr-guide-edit');
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Paste the Loom explaining how to use this (shown on every offer)';
    input.value = url;
    input.setAttribute('aria-label', 'Loom link for the Audio Transcriber');
    input.addEventListener('change', async () => {
      CACHE.repHub.transcriberLoom = input.value.trim();
      try {
        await saveRepHubTemplate();
        notify(input.value.trim() ? 'Loom saved.' : 'Loom removed.');
      } catch (err) {
        console.error(err);
        notify("Couldn't save the Loom — check your connection.");
      }
      renderTranscriberGuide();
    });
    row.appendChild(input);
    host.appendChild(row);
  }
  host.classList.toggle('hidden', !embed && CACHE.role !== 'owner');
}

/* ---------- the three states: waiting, working, done ---------- */
function showTranscriberState(name) {
  ['trDrop', 'trWorking', 'trResult'].forEach((id) => $('#' + id).classList.toggle('hidden', id !== name));
}

function setTranscriberStep(step, label) {
  $('#trStepLabel').textContent = label;
  document.querySelectorAll('#trWorking .tr-step').forEach((s) => {
    const order = ['upload', 'transcribe'];
    s.classList.toggle('is-active', s.dataset.step === step);
    s.classList.toggle('is-done', order.indexOf(s.dataset.step) < order.indexOf(step));
  });
}

function transcriberError(message) {
  TRANSCRIBE.busy = false;
  showTranscriberState('trDrop');
  const box = $('#trError');
  box.textContent = message;
  box.classList.remove('hidden');
}

async function transcribeFile(file) {
  if (TRANSCRIBE.busy || !file) return;
  $('#trError').classList.add('hidden');

  const looksLikeAudio = (file.type && file.type.indexOf('audio/') === 0) || AUDIO_TYPES.test(file.name);
  if (!looksLikeAudio) return transcriberError('That isn’t an audio file. Use the MP3 recording downloaded from Close.');
  if (file.size > AUDIO_LIMIT) return transcriberError('That file is ' + formatSize(file.size) + '. The limit is 25 MB — calls under about 20 minutes fit.');

  TRANSCRIBE.busy = true;
  $('#trFileName').textContent = file.name;
  $('#trFileSize').textContent = formatSize(file.size);
  showTranscriberState('trWorking');
  setTranscriberStep('upload', 'Uploading the recording…');

  try {
    const slot = await serverAction('/api/transcribe', { action: 'upload', name: file.name, size: file.size });
    const { error: uploadError } = await sb.storage.from('call-audio').uploadToSignedUrl(slot.path, slot.token, file, {
      contentType: file.type || 'audio/mpeg'
    });
    if (uploadError) throw new Error('The upload didn’t go through. Check your connection and try again.');

    setTranscriberStep('transcribe', 'Transcribing — usually a few seconds…');
    const result = await serverAction('/api/transcribe', { action: 'transcribe', path: slot.path });

    TRANSCRIBE.busy = false;
    TRANSCRIBE.lastText = result.text || '';
    if (!TRANSCRIBE.lastText.trim()) return transcriberError('No speech was found in that recording.');
    showTranscript(file, result);
  } catch (err) {
    console.error(err);
    transcriberError(err.message || 'Something went wrong. Please try again.');
  }
}

function showTranscript(file, result) {
  const words = TRANSCRIBE.lastText.trim().split(/\s+/).length;
  $('#trResultName').textContent = file.name;
  $('#trResultMeta').textContent = [formatDuration(result.duration), words.toLocaleString('en-US') + ' words'].filter(Boolean).join(' · ');
  $('#trText').textContent = TRANSCRIBE.lastText;
  $('#trCopy').textContent = 'Copy transcript';
  $('#trCopy').classList.remove('is-copied');
  $('#trCopyClaude').textContent = 'Copy for Claude';
  $('#trCopyClaude').classList.remove('is-copied');
  showTranscriberState('trResult');
}

function copyTranscript() {
  return copyText(TRANSCRIBE.lastText, $('#trCopy'));
}

/* Everything Claude needs in one paste: what to do, the form, the call. */
function copyForClaude() {
  const prompt = CLAUDE_INSTRUCTION + '\n\nHANDOFF FORM:\n' + currentHandoff() + '\n\nCALL TRANSCRIPT:\n' + TRANSCRIBE.lastText;
  return copyText(prompt, $('#trCopyClaude'), 'Copied — paste into Claude');
}

function initTranscriber() {
  const drop = $('#trDrop');
  if (!drop || drop.dataset.wired) { if (drop) { renderTranscriberGuide(); renderHandoff(); } return; }
  drop.dataset.wired = '1';

  const input = $('#trInput');
  $('#trChoose').addEventListener('click', () => input.click());
  drop.addEventListener('click', (e) => { if (e.target === drop || e.target.closest('.tr-drop-inner') && !e.target.closest('button')) input.click(); });
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  input.addEventListener('change', () => { const f = input.files && input.files[0]; input.value = ''; transcribeFile(f); });

  ['dragenter', 'dragover'].forEach((type) => drop.addEventListener(type, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'dragend'].forEach((type) => drop.addEventListener(type, () => drop.classList.remove('is-over')));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('is-over');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    transcribeFile(f);
  });

  /* dropping a file anywhere on the tab works too, instead of the browser opening it */
  const panel = document.querySelector('[data-panel="transcriber"]');
  panel.addEventListener('dragover', (e) => e.preventDefault());
  panel.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!$('#trDrop').classList.contains('hidden')) transcribeFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
  });

  $('#trCopy').addEventListener('click', copyTranscript);
  $('#trCopyClaude').addEventListener('click', copyForClaude);
  $('#trHandoffCopy').addEventListener('click', () => copyText(currentHandoff(), $('#trHandoffCopy')));
  $('#trHandoffEdit').addEventListener('click', openHandoffEditor);
  $('#trHandoffCancel').addEventListener('click', closeHandoffEditor);
  $('#trHandoffSave').addEventListener('click', saveHandoff);
  $('#trHandoffScope').addEventListener('change', paintScopeNote);
  $('#trAgain').addEventListener('click', () => { $('#trError').classList.add('hidden'); showTranscriberState('trDrop'); });

  renderTranscriberGuide();
  renderHandoff();
}
