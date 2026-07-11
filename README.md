# MecCollab Extension

A Chrome Browser Extension that extends [MecCollab](https://github.com/sudhanshu172/MecCollab) by automatically reading Gmail emails and assigning tasks to team members in the MecCollab Firestore backend.

---

## Features

- 📧 **Gmail Integration** — reads unread emails via Gmail API
- 🤖 **Auto Task Assignment** — parses email subject/body to extract task details
- 🔥 **Firestore Sync** — pushes tasks directly to MecCollab's Firebase Firestore
- 🔔 **Badge Notifications** — shows pending email-task count on the extension icon
- 🔒 **OAuth 2.0** — secure Google Sign-In, no passwords stored
- ✅ **Manual Override** — confirm or reject auto-assignments before saving

---

## Architecture

```
MecCollab-Extension/
├── manifest.json              # Chrome Extension Manifest V3
├── config/
│   └── constants.js           # App constants (no secrets)
├── background/
│   └── service_worker.js      # Background polling + Gmail API calls
├── popup/
│   ├── popup.html             # Extension popup UI
│   ├── popup.css              # Styles (MecCollab indigo theme)
│   └── popup.js               # Popup logic
├── content/
│   └── gmail_reader.js        # Content script injected on Gmail pages
├── lib/
│   ├── gmail_api.js           # Gmail REST API wrapper
│   ├── task_parser.js         # Local NLP: extract task info from email
│   └── firebase_client.js     # Firestore REST client (no SDK needed)
└── tests/
    └── task_parser.test.js    # 13 unit tests
```

---

## Setup

### Prerequisites
- Google Chrome 114+
- Firebase project (same as MecCollab)
- Gmail API enabled in Google Cloud Console
- OAuth 2.0 Client ID for Chrome Extension type

### Installation

1. Clone this repo:
   ```bash
   git clone https://github.com/sudhanshu172/MecCollab-Extension.git
   ```

2. Open Chrome → `chrome://extensions/` → Enable **Developer Mode**

3. Click **Load unpacked** → select the `MecCollab-Extension/` folder

4. Fill in `config/constants.js`:
   ```js
   FIREBASE_PROJECT_ID: 'your-project-id',
   FIREBASE_API_KEY: 'your-web-api-key',
   ```

5. In [Google Cloud Console](https://console.cloud.google.com):
   - Enable **Gmail API**
   - Create OAuth 2.0 credentials → **Chrome Extension** type
   - Paste Client ID into `manifest.json` → `oauth2.client_id`

6. Click the extension icon → **Sign In with Google**

---

## Security Design

| Concern | Mitigation |
|---|---|
| No secrets in code | OAuth tokens managed by `chrome.identity` API |
| XSS in popup | All email content runs through `escapeHtml()` before `innerHTML` |
| Input injection | `task_parser.js` strips control chars, caps lengths |
| Firestore access | Server-side Security Rules enforced; no Admin SDK |
| Token persistence | Tokens in `chrome.storage.session` only, cleared on browser close |
| Content Security Policy | Strict `script-src 'self'` in manifest |

---

## Running Tests

```bash
npm install
npm test
```

---

## License

MIT
