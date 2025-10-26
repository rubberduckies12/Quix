mtd-tax-bridge/
├── src/
│   ├── routes/
│   │   ├── auth.js              # Login/register
│   │   ├── upload.js            # File upload
│   │   └── submissions.js       # Tax submissions
│   ├── services/
│   │   ├── spreadsheet.js       # Parse Excel/CSV
│   │   ├── categorization.js    # Business logic for categorization
│   │   ├── submission.js        # Submission business logic
│   │   ├── notification.js      # Notification orchestration
│   │   └── tax-period.js        # Tax year/quarter calculations & deadlines
│   ├── external/
│   │   ├── vertex-ai.js         # Google Vertex AI API calls
│   │   ├── hmrc-api.js          # HMRC API calls (when ready)
│   │   └── file-storage.js      # Cloud storage API (if needed)
│   ├── models/
│   │   ├── User.js              # User model
│   │   ├── Upload.js            # File uploads
│   │   └── Submission.js        # Tax submissions
│   ├── middleware/
│   │   ├── auth.js              # JWT auth
│   │   └── upload.js            # File validation
│   └── utils/
│       ├── validation.js        # Input validation
│       ├── errors.js            # Error handling
│       ├── mailer.js            # Email utilities
│       ├── sms.js               # SMS utilities
│       └── date.js              # Date calculations & formatting
├── uploads/                     # Temporary file storage
├── .env
├── server.js                    # Express app
└── package.json