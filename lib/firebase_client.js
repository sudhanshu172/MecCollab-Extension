/**
 * lib/firebase_client.js
 * Lightweight Firestore REST API client.
 * Authenticated via chrome.identity OAuth token — no service account keys.
 * Firestore Security Rules are enforced server-side.
 */

'use strict';

import { CONFIG } from '../config/constants.js';

const FIRESTORE_URL = `${CONFIG.FIRESTORE_BASE_URL}/projects/${CONFIG.FIREBASE_PROJECT_ID}/databases/(default)/documents`;

async function getToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error('Firestore: OAuth token unavailable.'));
      } else {
        resolve(token);
      }
    });
  });
}

async function firestoreFetch(path, method = 'GET', body = null) {
  const token = await getToken();
  const options = {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(`${FIRESTORE_URL}${path}`, options);
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Firestore ${method} ${path} → HTTP ${response.status}: ${err.slice(0, 200)}`);
  }
  return response.json();
}

export async function createTask(task) {
  validateTask(task);
  return firestoreFetch(`/${CONFIG.COLLECTION_TASKS}`, 'POST', { fields: toFirestoreFields(task) });
}

export async function listTasks(limit = 20) {
  const n = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
  const data = await firestoreFetch(`/${CONFIG.COLLECTION_TASKS}?pageSize=${n}`);
  return (data.documents || []).map(fromFirestoreDocument);
}

export async function updateTaskStatus(docId, status) {
  const ALLOWED = ['pending', 'in-progress', 'done', 'rejected'];
  if (!ALLOWED.includes(status)) throw new RangeError(`Invalid status '${status}'.`);
  const safeId = docId.replace(/[^a-zA-Z0-9_\-]/g, '');
  return firestoreFetch(
    `/${CONFIG.COLLECTION_TASKS}/${safeId}?updateMask.fieldPaths=status`,
    'PATCH',
    { fields: { status: { stringValue: status } } }
  );
}

function validateTask(task) {
  if (!task || typeof task !== 'object') throw new TypeError('Task must be an object.');
  if (!task.title?.trim()) throw new RangeError('Task title is required.');
  if (task.title.length > 120) throw new RangeError('Task title exceeds 120 characters.');
}

function toFirestoreFields(obj) {
  const f = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    if (typeof v === 'string')  f[k] = { stringValue: v };
    if (typeof v === 'boolean') f[k] = { booleanValue: v };
    if (typeof v === 'number')  f[k] = { integerValue: String(v) };
  }
  return f;
}

function fromFirestoreDocument(doc) {
  const r = { _id: doc.name?.split('/').pop() || '' };
  for (const [k, v] of Object.entries(doc.fields || {})) {
    r[k] = v.stringValue ?? v.booleanValue ?? v.integerValue ?? null;
  }
  return r;
}
