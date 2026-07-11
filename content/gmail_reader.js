/**
 * content/gmail_reader.js
 * Injected on mail.google.com — observes DOM for opened email threads.
 * Notifies background service worker with subject + sender only.
 * SECURITY: No email body is read from DOM; full content fetched via API.
 */

'use strict';

(function mecCollabGmailObserver() {
  let lastSubject = '';

  const observer = new MutationObserver(debounce(onDomChange, 800));
  observer.observe(document.body, { childList: true, subtree: true });

  function onDomChange() {
    const subjectEl = document.querySelector(
      'h2[data-legacy-thread-subject], .hP, [role="main"] h2'
    );
    if (!subjectEl) return;
    const subject = subjectEl.textContent?.trim();
    if (!subject || subject === lastSubject) return;
    lastSubject = subject;

    const fromEl   = document.querySelector('.go, .gD, [email]');
    const fromAddr = fromEl?.getAttribute('email') || fromEl?.textContent?.trim() || '';

    chrome.runtime.sendMessage({
      type:    'GMAIL_PAGE_OPEN',
      subject: subject.slice(0, 200),
      from:    fromAddr.slice(0, 100),
    });
  }

  function debounce(fn, ms) {
    let t;
    return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
  }
}());
