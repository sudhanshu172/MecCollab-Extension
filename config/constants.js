/**
 * config/constants.js
 * Public configuration constants — NO secrets, service account keys, or tokens.
 * OAuth tokens are managed at runtime by chrome.identity API.
 */

'use strict';

export const CONFIG = Object.freeze({
  // Firebase (public Web config — safe for client)
  FIREBASE_PROJECT_ID: 'YOUR_FIREBASE_PROJECT_ID',
  FIREBASE_API_KEY:    'YOUR_FIREBASE_WEB_API_KEY',
  FIRESTORE_BASE_URL:  'https://firestore.googleapis.com/v1',

  // Firestore collection names (must match MecCollab)
  COLLECTION_TASKS:    'tasks',
  COLLECTION_USERS:    'users',
  COLLECTION_PROJECTS: 'projects',

  // Gmail polling
  GMAIL_POLLING_INTERVAL_MS: 60_000,
  GMAIL_MAX_RESULTS:         10,
  GMAIL_QUERY:               'is:unread label:inbox',

  // Task defaults
  DEFAULT_PRIORITY:    'medium',
  DEFAULT_DUE_DAYS:    3,
  TASK_SOURCE_TAG:     'email-auto',

  // UI
  POPUP_MAX_TASKS:     20,
  NOTIFICATION_TITLE:  'MecCollab',
  BADGE_COLOR:         '#6366f1',
});
