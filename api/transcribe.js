import { adminClient, body, send, caller } from './_supabase.js';

/* ============================================================
   api/transcribe.js — Audio Transcriber
   For anyone signed in to a sales board: reps with the team code,
   admins and the owner.

     upload       a one-time address the browser uploads the recording to
     transcribe   send that recording to Groq, return the transcript,
                  and delete the recording straight away

   Recordings go to a private Storage bucket first because a web
   request through Vercel can't carry more than 4.5 MB, and a call
   recording is usually bigger. Nothing is kept: the file is deleted
   as soon as it has been transcribed, whether that worked or not.

   The Groq key is read from Vercel's settings (GROQ_API_KEY) and
   never reaches a browser.
   ============================================================ */

const BUCKET = 'call-audio';
const MAX_BYTES = 25 * 1024 * 1024;               // Groq's free-plan limit per file
const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const MODEL = 'whisper-large-v3';

async function ensureBucket(db) {
  const { data } = await db.storage.getBucket(BUCKET);
  if (data) return;
  const { error } = await db.storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_BYTES });
  if (error && !/already exists/i.test(error.message || '')) throw error;
}

/* Split the words into readable paragraphs at natural pauses. */
function paragraphs(segments, fallback) {
  if (!Array.isArray(segments) || !segments.length) return String(fallback || '').trim();
  const out = [];
  let current = '';
  let lastEnd = 0;
  segments.forEach((s) => {
    const text = String(s.text || '').trim();
    if (!text) return;
    const pause = (s.start || 0) - lastEnd;
    if (current && (pause >= 1.2 || current.length > 420)) {
      out.push(current.trim());
      current = '';
    }
    current += (current ? ' ' : '') + text;
    lastEnd = s.end || lastEnd;
  });
  if (current.trim()) out.push(current.trim());
  return out.join('\n\n');
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return send(response, 405, { error: 'Use POST' });

  let who;
  try { who = await caller(request); } catch (e) { who = null; }
  if (!who) return send(response, 401, { error: 'Sign in first.' });
  /* reps (the team login), the owner, and admins who have the sales boards */
  const onABoard = who.isOwner || who.kind === 'team' || (who.sections || []).indexOf('sales') !== -1;
  if (!onABoard) return send(response, 403, { error: 'The Audio Transcriber is for people on a sales board.' });
  if (!process.env.GROQ_API_KEY) return send(response, 500, { error: 'The transcriber isn’t connected yet (GROQ_API_KEY is missing in Vercel).' });

  const input = body(request);
  const db = adminClient();

  try {
    /* ---------- a one-time upload address ---------- */
    if (input.action === 'upload') {
      const size = Number(input.size) || 0;
      if (size > MAX_BYTES) return send(response, 400, { error: 'That file is over 25 MB. Recordings under about 20 minutes fit.' });
      const ext = (String(input.name || '').match(/\.([a-z0-9]{2,5})$/i) || [, 'mp3'])[1].toLowerCase();
      const path = who.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 10) + '.' + ext;
      await ensureBucket(db);
      const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error) throw error;
      return send(response, 200, { path, token: data.token });
    }

    /* ---------- transcribe, then delete ---------- */
    if (input.action === 'transcribe') {
      const path = String(input.path || '');
      if (!path.startsWith(who.id + '/') || path.includes('..')) return send(response, 403, { error: 'That recording isn’t yours.' });

      try {
        const { data: file, error: downloadError } = await db.storage.from(BUCKET).download(path);
        if (downloadError || !file) return send(response, 404, { error: 'The upload didn’t arrive. Please try again.' });

        const form = new FormData();
        form.append('file', new Blob([await file.arrayBuffer()], { type: file.type || 'audio/mpeg' }), path.split('/').pop());
        form.append('model', MODEL);
        form.append('response_format', 'verbose_json');
        form.append('temperature', '0');

        const answer = await fetch(GROQ_URL, {
          method: 'POST',
          headers: { authorization: 'Bearer ' + process.env.GROQ_API_KEY },
          body: form
        });
        const result = await answer.json().catch(() => ({}));

        if (!answer.ok) {
          const message = (result.error && result.error.message) || '';
          console.error('transcribe: Groq said', answer.status, message);
          if (answer.status === 429) return send(response, 429, { error: 'Too many transcriptions at once. Wait a minute and try again.' });
          if (answer.status === 401) return send(response, 500, { error: 'The transcriber’s key was rejected. The owner needs to check GROQ_API_KEY in Vercel.' });
          if (/format|decode|invalid.*file|media/i.test(message)) return send(response, 400, { error: 'That file couldn’t be read as audio. Try the MP3 straight from Close.' });
          return send(response, 502, { error: 'Transcription didn’t work this time. Please try again.' });
        }

        return send(response, 200, {
          text: paragraphs(result.segments, result.text),
          duration: Math.round(Number(result.duration) || 0),
          language: result.language || ''
        });
      } finally {
        /* never keep a recording */
        await db.storage.from(BUCKET).remove([path]).catch(() => {});
      }
    }

    return send(response, 400, { error: 'Unknown action.' });
  } catch (error) {
    console.error('transcribe', error);
    return send(response, 500, { error: 'That didn’t work: ' + (error.message || 'unknown error') });
  }
}
