/**
 * popup/popup.js
 * Popup UI controller — communicates with service_worker.js via sendMessage.
 * All email-derived text is sanitized with escapeHtml() before DOM insertion.
 */

'use strict';

const btnSignIn  = document.getElementById('btn-sign-in');
const btnRefresh = document.getElementById('btn-refresh');
const taskList   = document.getElementById('task-list');
const emptyState = document.getElementById('empty-state');
const statusBar  = document.getElementById('status-bar');

document.addEventListener('DOMContentLoaded', loadQueue);
btnSignIn.addEventListener('click', handleSignIn);
btnRefresh.addEventListener('click', loadQueue);

async function handleSignIn() {
  setStatus('Signing in…');
  const res = await send({ type: 'SIGN_IN' });
  if (res?.ok) { setStatus('Signed in.', 'success'); await loadQueue(); }
  else         { setStatus(res?.error || 'Sign-in failed.', 'error'); }
}

async function loadQueue() {
  setStatus('Loading…');
  const res = await send({ type: 'GET_QUEUE' });
  if (!res?.ok) { setStatus(res?.error || 'Failed to load.', 'error'); return; }
  renderQueue(res.queue || []);
  setStatus('');
}

async function handleApprove(task, card) {
  setCardBusy(card, true);
  const res = await send({ type: 'APPROVE_TASK', task });
  if (res?.ok) {
    card.remove(); checkEmpty();
    setStatus(`"${escapeHtml(task.title.slice(0, 40))}" saved to MecCollab.`, 'success');
  } else {
    setCardBusy(card, false);
    setStatus(res?.error || 'Failed to save.', 'error');
  }
}

async function handleReject(gmailId, card) {
  setCardBusy(card, true);
  const res = await send({ type: 'REJECT_TASK', gmailId });
  if (res?.ok) { card.remove(); checkEmpty(); }
  else         { setCardBusy(card, false); setStatus(res?.error || 'Failed.', 'error'); }
}

function renderQueue(queue) {
  taskList.innerHTML = '';
  if (!queue.length) { emptyState.hidden = false; return; }
  emptyState.hidden = true;
  queue.forEach((t) => taskList.appendChild(buildCard(t)));
}

function buildCard(task) {
  const card = document.createElement('article');
  card.className = 'task-card';
  card.dataset.gmailId = task.gmailId || '';
  const pc = `priority-${task.priority || 'medium'}`;
  card.innerHTML = `
    <div class="task-card-header">
      <span class="task-title">${escapeHtml(task.title || 'Untitled')}</span>
      <span class="priority-badge ${pc}">${escapeHtml(task.priority || 'medium')}</span>
    </div>
    <div class="task-meta">
      ${task.emailFrom ? `<span>✉️ ${escapeHtml(task.emailFrom)}</span>` : ''}
      ${task.assignee  ? `<span>👤 ${escapeHtml(task.assignee)}</span>`  : ''}
      ${task.dueDate   ? `<span>📅 ${escapeHtml(task.dueDate)}</span>`   : ''}
      ${task.project   ? `<span>📁 ${escapeHtml(task.project)}</span>`   : ''}
    </div>
    <div class="task-actions">
      <button class="btn btn-danger  btn-reject"  aria-label="Reject task">Reject</button>
      <button class="btn btn-success btn-approve" aria-label="Save task to MecCollab">Approve → MecCollab</button>
    </div>`;
  card.querySelector('.btn-approve').addEventListener('click', () => handleApprove(task, card));
  card.querySelector('.btn-reject' ).addEventListener('click', () => handleReject(task.gmailId, card));
  return card;
}

function checkEmpty() { if (!taskList.children.length) emptyState.hidden = false; }
function setCardBusy(card, busy) { card.querySelectorAll('button').forEach((b) => { b.disabled = busy; }); }
function setStatus(msg, type = '') {
  statusBar.textContent = msg;
  statusBar.className = `status-bar${type ? ' ' + type : ''}`;
}
function escapeHtml(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
           .replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}
function send(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (r) => {
      resolve(chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : r);
    });
  });
}
