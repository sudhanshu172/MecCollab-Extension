/**
 * lib/task_parser.js
 * Local NLP-lite parser: extracts task metadata from email subject + body.
 * No external API calls — all processing is on-device for privacy.
 */

'use strict';

import { CONFIG } from '../config/constants.js';

const PRIORITY_KEYWORDS = {
  high: ['urgent', 'asap', 'critical', 'immediately', 'priority', 'p0', 'p1', 'high priority'],
  low:  ['fyi', 'low priority', 'when possible', 'no rush', 'p3', 'p4'],
};

const ASSIGNEE_PATTERNS = [
  /assign(?:ed)?\s+to[:\s]+([\w.\s]+?)(?:\.|,|\n|$)/i,
  /(?:please|kindly)?\s+([\w]+)\s+(?:please\s+)?(?:handle|take care|look into|review)/i,
  /(?:cc|to):[\s]*([\w.]+@[\w.]+)/i,
];

const DUE_DATE_PATTERNS = [
  /due\s+(?:by|on)?[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
  /by\s+(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s*\d{0,4})/i,
  /deadline[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
];

const PROJECT_PATTERNS = [
  /project[:\s]+([\w\s\-]+?)(?:\.|,|\n|$)/i,
  /re[:\s]+\[([\w\s\-]+?)\]/i,
];

/**
 * Parse an email into a MecCollab task object.
 * @param {{subject:string, body:string, from:string, date:string, gmailId:string}} params
 * @returns {object} MecCollab task document
 */
export function parseEmailToTask({ subject, body, from, date, gmailId }) {
  const safeSubject = sanitizeText(subject);
  const safeBody    = sanitizeText(body);
  const safeFrom    = sanitizeEmail(from);
  const combined    = `${safeSubject} ${safeBody}`;

  return {
    title:        buildTitle(safeSubject),
    description:  buildDescription(safeSubject, safeBody, safeFrom),
    priority:     detectPriority(combined),
    assignee:     detectAssignee(combined) || '',
    dueDate:      detectDueDate(combined)  || defaultDueDate(),
    project:      detectProject(combined)  || '',
    source:       CONFIG.TASK_SOURCE_TAG,
    gmailId:      gmailId || '',
    createdAt:    new Date().toISOString(),
    emailFrom:    safeFrom,
    emailDate:    date || '',
    status:       'pending',
    autoAssigned: true,
  };
}

function buildTitle(subject) {
  return subject.replace(/^(re|fwd|fw)[:\s]+/gi, '').trim().slice(0, 120);
}

function buildDescription(subject, body, from) {
  return `Auto-assigned from email.\nFrom: ${from}\nSubject: ${subject}\n\n${body.slice(0, 500).trim()}`;
}

function detectPriority(text) {
  const lower = text.toLowerCase();
  for (const kw of PRIORITY_KEYWORDS.high) { if (lower.includes(kw)) return 'high'; }
  for (const kw of PRIORITY_KEYWORDS.low)  { if (lower.includes(kw)) return 'low';  }
  return CONFIG.DEFAULT_PRIORITY;
}

function detectAssignee(text) {
  for (const p of ASSIGNEE_PATTERNS) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim().slice(0, 60);
  }
  return null;
}

function detectDueDate(text) {
  for (const p of DUE_DATE_PATTERNS) {
    const m = text.match(p);
    if (m?.[1]) {
      const d = new Date(m[1]);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
  }
  return null;
}

function detectProject(text) {
  for (const p of PROJECT_PATTERNS) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim().slice(0, 60);
  }
  return null;
}

function defaultDueDate() {
  const d = new Date();
  d.setDate(d.getDate() + CONFIG.DEFAULT_DUE_DAYS);
  return d.toISOString().split('T')[0];
}

function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/\s+/g, ' ').trim().slice(0, 5000);
}

function sanitizeEmail(email) {
  if (typeof email !== 'string') return '';
  const m = email.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : '';
}
