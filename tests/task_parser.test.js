/**
 * tests/task_parser.test.js
 * Unit tests for lib/task_parser.js — 13 cases covering normal, edge, and security scenarios.
 * Run: npm test
 */

import { parseEmailToTask } from '../lib/task_parser.js';

const BASE = {
  subject: 'Urgent: Review blast furnace report by 15/07/2026',
  body:    'Please assign to Sudhanshu. High priority. Deadline: 15/07/2026.',
  from:    'manager@mecon.co.in',
  date:    'Fri, 10 Jul 2026 10:00:00 +0530',
  gmailId: 'abc123xyz',
};

describe('parseEmailToTask', () => {
  test('returns valid task object', () => {
    const t = parseEmailToTask(BASE);
    expect(t).toMatchObject({ source: 'email-auto', autoAssigned: true, status: 'pending', gmailId: 'abc123xyz' });
  });

  test('strips Re:/Fwd: prefix', () => {
    expect(parseEmailToTask({ ...BASE, subject: 'Re: Fwd: Fix issue' }).title).toBe('Fix issue');
  });

  test('detects high priority', () => {
    expect(parseEmailToTask(BASE).priority).toBe('high');
  });

  test('detects low priority (FYI)', () => {
    expect(parseEmailToTask({ ...BASE, subject: 'FYI: Report', body: 'No rush.' }).priority).toBe('low');
  });

  test('defaults to medium priority', () => {
    expect(parseEmailToTask({ ...BASE, subject: 'Meeting notes', body: 'Attached.' }).priority).toBe('medium');
  });

  test('extracts assignee from body', () => {
    expect(parseEmailToTask(BASE).assignee).toMatch(/sudhanshu/i);
  });

  test('parses due date', () => {
    expect(parseEmailToTask(BASE).dueDate).toMatch(/2026/);
  });

  test('handles empty subject', () => {
    const t = parseEmailToTask({ ...BASE, subject: '' });
    expect(t.title).toBe('');
    expect(t).not.toBeNull();
  });

  test('handles empty body', () => {
    expect(parseEmailToTask({ ...BASE, body: '' }).description).toContain('manager@mecon.co.in');
  });

  test('sanitizes XSS in subject', () => {
    expect(parseEmailToTask({ ...BASE, subject: '<script>alert(1)</script> Task' }).title).not.toContain('<script>');
  });

  test('SQL injection input does not throw', () => {
    expect(parseEmailToTask({ ...BASE, body: "'; DROP TABLE tasks; --" }).status).toBe('pending');
  });

  test('title capped at 120 chars', () => {
    expect(parseEmailToTask({ ...BASE, subject: 'A'.repeat(200) }).title.length).toBeLessThanOrEqual(120);
  });

  test('sanitizes email from header', () => {
    expect(parseEmailToTask({ ...BASE, from: '"John" <john@mecon.co.in>' }).emailFrom).toBe('john@mecon.co.in');
  });

  test('provides future default due date', () => {
    const t = parseEmailToTask({ ...BASE, body: 'No deadline here.' });
    expect(new Date(t.dueDate).getTime()).toBeGreaterThan(Date.now());
  });
});
