import { adminClient, body, send, caller } from './_supabase.js';

/* ============================================================
   api/profile.js — your own profile picture
   Owner and admins, each for themselves only.

     avatar   save a picture (already cropped and shrunk in the browser)
     remove   take it away

   Pictures live in a public Storage bucket called "avatars", one file
   per person, named after their account. The bucket is created the
   first time anyone uploads, so there is nothing to set up.
   ============================================================ */

const BUCKET = 'avatars';
const MAX_BYTES = 600 * 1024;

async function ensureBucket(db) {
  const { data } = await db.storage.getBucket(BUCKET);
  if (data) return;
  const { error } = await db.storage.createBucket(BUCKET, {
    public: true, fileSizeLimit: MAX_BYTES, allowedMimeTypes: ['image/jpeg']
  });
  if (error && !/already exists/i.test(error.message || '')) throw error;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return send(response, 405, { error: 'Use POST' });

  let who;
  try { who = await caller(request); } catch (e) { who = null; }
  if (!who) return send(response, 401, { error: 'Sign in first.' });
  if (who.kind !== 'person') return send(response, 403, { error: 'Team logins have no profile.' });

  const input = body(request);
  const db = adminClient();
  const file = who.id + '.jpg';

  try {
    if (input.action === 'avatar') {
      const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(input.image || ''));
      if (!match) return send(response, 400, { error: 'That picture could not be read.' });
      const bytes = Buffer.from(match[1], 'base64');
      if (bytes.length > MAX_BYTES) return send(response, 400, { error: 'That picture is too large.' });

      await ensureBucket(db);
      const { error } = await db.storage.from(BUCKET).upload(file, bytes, {
        contentType: 'image/jpeg', upsert: true, cacheControl: '3600'
      });
      if (error) throw error;

      const { data } = db.storage.from(BUCKET).getPublicUrl(file);
      /* A new address on every upload, so browsers show the new picture at once. */
      return send(response, 200, { url: data.publicUrl + '?v=' + Date.now() });
    }

    if (input.action === 'remove') {
      await db.storage.from(BUCKET).remove([file]);
      return send(response, 200, { ok: true });
    }

    return send(response, 400, { error: 'Unknown action.' });
  } catch (error) {
    console.error('profile', error);
    return send(response, 500, { error: 'That did not work: ' + (error.message || 'unknown error') });
  }
}
