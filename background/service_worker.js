/**
 * background/service_worker.js
 * Chrome Extension Service Worker — Manifest V3.
 * Polls Gmail every 60s, parses emails into tasks, queues for user review.
 * SECURITY: No sensitive data logged. Tokens managed by Chrome.
 */

'use strict';

import { CONFIG }                                                    from '../config/constants.js';
import { fetchUnreadMessageIds, fetchMessageDetail,
         extractEmailBody, extractHeader }                           from '../lib/gmail_api.js';
import { parseEmailToTask }                                          from '../lib/task_parser.js';
import { createTask }                                                from '../lib/firebase_client.js';

const ALARM_NAME            = 'meccollab_email_poll';
const KEY_QUEUE             = 'pendingTaskQueue';
const KEY_PROCESSED         = 'processedGmailIds';

// ── Lifecycle ───────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: CONFIG.GMAIL_POLLING_INTERVAL_MS / 60_000 });
  chrome.action.setBadgeBackgroundColor({ color: CONFIG.BADGE_COLOR });
  console.info('[MecCollab] Installed. Polling alarm set.');
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    pollGmailAndQueueTasks().catch((e) => console.warn('[MecCollab] Poll error:', e.message));
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (!msg?.type) { respond({ ok: false, error: 'No message type.' }); return true; }
  switch (msg.type) {
    case 'GET_QUEUE':    handleGetQueue(respond);                      break;
    case 'APPROVE_TASK': handleApproveTask(msg.task, respond);         break;
    case 'REJECT_TASK':  handleRejectTask(msg.gmailId, respond);       break;
    case 'SIGN_IN':      handleSignIn(respond);                        break;
    default: respond({ ok: false, error: 'Unknown message type.' });
  }
  return true;
});

// ── Polling ──────────────────────────────────────────────────────────────────

async function pollGmailAndQueueTasks() {
  const refs      = await fetchUnreadMessageIds();
  if (!refs.length) return;

  const processed = await getProcessedIds();
  const fresh     = refs.filter((r) => !processed.has(r.id));
  if (!fresh.length) return;

  const tasks = [];
  for (const ref of fresh) {
    try {
      const detail  = await fetchMessageDetail(ref.id);
      const subject = extractHeader(detail, 'Subject');
      const from    = extractHeader(detail, 'From');
      const date    = extractHeader(detail, 'Date');
      const body    = extractEmailBody(detail);
      if (!subject && !body) continue;
      tasks.push(parseEmailToTask({ subject, body, from, date, gmailId: ref.id }));
    } catch (e) {
      console.warn(`[MecCollab] Skipped ${ref.id.slice(0,8)}…: ${e.message}`);
    }
  }

  if (tasks.length) {
    await enqueue(tasks);
    await setBadge(tasks.length);
    notify(tasks.length);
  }
}

// ── Message handlers ─────────────────────────────────────────────────────────

async function handleGetQueue(respond) {
  const d = await chrome.storage.local.get(KEY_QUEUE);
  respond({ ok: true, queue: d[KEY_QUEUE] || [] });
}

async function handleApproveTask(task, respond) {
  try {
    await createTask(task);
    await dequeue(task.gmailId);
    await markProcessed(task.gmailId);
    await refreshBadge();
    respond({ ok: true });
  } catch (e) { respond({ ok: false, error: e.message }); }
}

async function handleRejectTask(gmailId, respond) {
  await dequeue(gmailId);
  await markProcessed(gmailId);
  await refreshBadge();
  respond({ ok: true });
}

async function handleSignIn(respond) {
  chrome.identity.getAuthToken({ interactive: true }, (token) => {
    if (chrome.runtime.lastError || !token) {
      respond({ ok: false, error: 'Sign-in failed or cancelled.' });
    } else {
      respond({ ok: true });
    }
  });
}

// ── Storage helpers ───────────────────────────────────────────────────────────

async function enqueue(tasks) {
  const d = await chrome.storage.local.get(KEY_QUEUE);
  const merged = [...(d[KEY_QUEUE] || []), ...tasks].slice(-CONFIG.POPUP_MAX_TASKS);
  await chrome.storage.local.set({ [KEY_QUEUE]: merged });
}

async function dequeue(gmailId) {
  const d = await chrome.storage.local.get(KEY_QUEUE);
  await chrome.storage.local.set({ [KEY_QUEUE]: (d[KEY_QUEUE] || []).filter((t) => t.gmailId !== gmailId) });
}

async function getProcessedIds() {
  const d = await chrome.storage.local.get(KEY_PROCESSED);
  return new Set(d[KEY_PROCESSED] || []);
}

async function markProcessed(gmailId) {
  const s = await getProcessedIds();
  s.add(gmailId);
  await chrome.storage.local.set({ [KEY_PROCESSED]: [...s].slice(-500) });
}

// ── Badge & Notifications ─────────────────────────────────────────────────────

async function setBadge(count) {
  await chrome.action.setBadgeText({ text: count > 99 ? '99+' : String(count) });
}

async function refreshBadge() {
  const d = await chrome.storage.local.get(KEY_QUEUE);
  await setBadge((d[KEY_QUEUE] || []).length);
}

function notify(count) {
  chrome.notifications.create({
    type: 'basic', iconUrl: 'icons/icon_128.png',
    title: CONFIG.NOTIFICATION_TITLE,
    message: `${count} new task${count > 1 ? 's' : ''} detected from email. Click to review.`,
    priority: 1,
  });
}
