import { CONNECTION, ensureTables, boardExists, stamp, pause } from './_lib.js';

/* ============================================================
   api/enter.js — the key screen's Go button

   The sales team's key is checked here, in the same process that
   holds the database connection. The front door used to ask this
   question over an HTTP call to itself, and anything that went
   wrong with that call came back looking like a wrong key.

   On success: the cookie for that board, and off to the board.
   On failure: back to the key screen with a reason, so what went
   wrong is never a guess.
   ============================================================ */

const THIRTY_DAYS = 60 * 60 * 24 * 30;

function backToKeyScreen(response, reason) {
  response.setHeader('location', '/sales-team?e=' + reason);
  response.status(303).end();
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('location', '/sales-team');
    response.status(303).end();
    return;
  }

  if (!CONNECTION) { backToKeyScreen(response, 'nodb'); return; }

  /* The form posts as a normal HTML form, so the body may arrive parsed
     or as raw text depending on the content type. */
  let entered = '';
  try {
    const body = request.body;
    if (typeof body === 'string') {
      entered = new URLSearchParams(body).get('secret') || '';
    } else if (body && typeof body === 'object') {
      entered = body.secret || '';
    }
  } catch (error) {
    entered = '';
  }

  entered = String(entered).trim().toUpperCase();
  if (!entered) { backToKeyScreen(response, 'empty'); return; }

  try {
    await ensureTables();
    if (!(await boardExists(entered))) {
      await pause(1000);                    // guessing should cost something
      backToKeyScreen(response, 'nokey');
      return;
    }
  } catch (error) {
    console.error('key check failed', error);
    backToKeyScreen(response, 'nodb');
    return;
  }

  response.setHeader('set-cookie', [
    'ia_board=' + stamp(entered, 'board') + '; Path=/; Secure; SameSite=Lax; Max-Age=' + THIRTY_DAYS,
    'ia_role=team; Path=/; Secure; SameSite=Lax; Max-Age=' + THIRTY_DAYS
  ]);
  response.setHeader('location', '/sales-team/' + entered);
  response.status(303).end();
}
