/**
 * lib/gmail_api.js
 * Wrapper around Gmail REST API v1.
 * Uses chrome.identity for OAuth — no passwords or tokens stored in code.
 */

'use strict';

import { CONFIG } from '../config/constants.js';

const GMAIL_BASE = 'https://www.googleapis.com/gmail/v1/users/me';

async function getAccessToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error('GmailAPI: Failed to get auth token — user may need to sign in.'));
      } else {
        resolve(token);
      }
    });
  });
}

async function gmailFetch(endpoint) {
  const token = await getAccessToken();
  const response = await fetch(`${GMAIL_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`GmailAPI HTTP ${response.status}: ${errText.slice(0, 200)}`);
  }
  return response.json();
}

export async function fetchUnreadMessageIds() {
  const query = encodeURIComponent(CONFIG.GMAIL_QUERY);
  const data = await gmailFetch(`/messages?q=${query}&maxResults=${CONFIG.GMAIL_MAX_RESULTS}`);
  return data.messages || [];
}

export async function fetchMessageDetail(messageId) {
  if (!messageId || typeof messageId !== 'string') {
    throw new TypeError('GmailAPI: messageId must be a non-empty string.');
  }
  const safeId = messageId.replace(/[^a-zA-Z0-9]/g, '');
  return gmailFetch(`/messages/${safeId}?format=full`);
}

export function extractEmailBody(message) {
  const payload = message?.payload;
  if (!payload) return '';
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  const parts = payload.parts || [];
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return decodeBase64Url(part.body.data);
    }
  }
  return '';
}

export function extractHeader(message, headerName) {
  const headers = message?.payload?.headers || [];
  const header = headers.find((h) => h.name.toLowerCase() === headerName.toLowerCase());
  return header?.value || '';
}

function decodeBase64Url(data) {
  try {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(escape(atob(base64)));
  } catch {
    return '';
  }
}
