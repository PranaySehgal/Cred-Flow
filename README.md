# CreditFlow

CreditFlow is a web application for managing merchant credit and repayment workflows. It connects merchants, lenders, field agents, and platform administrators through role-specific experiences backed by a FastAPI service.

## Overview

CreditFlow supports the key workflows involved in merchant financing, from account access and merchant profile management to credit agreements, repayment tracking, and operational review.

### Key capabilities

- Role-based access for merchants, lenders, field agents, and super admins
- Email verification codes as a second factor during sign-in
- Merchant and lender account registration and approval workflows
- Merchant profile and inventory management
- Lender contract creation and repayment updates
- Merchant transaction recording and support issue management
- Agent assignment review and response
- Super-admin account, account-request, issue, and contract management
- Optional merchant ranking with TinyFish

## Technology

- **Frontend:** HTML, CSS, and JavaScript
- **Backend:** Python and FastAPI
- **Database access:** SQLAlchemy
- **Authentication:** Password verification, email-based one-time codes, and bearer-token sessions
- **Merchant ranking:** TinyFish

## Project structure

```text
.
├── api.py                 # FastAPI application and API routes
├── *.py                   # Authentication, database, and domain services
└── vanilla/
    ├── *.html             # Application pages
    ├── css/styles.css     # Shared styles
    └── js/                # Frontend behavior and API client
```

## Prerequisites

- Python 3.10 or newer
- A SQLAlchemy-supported database and its Python driver
- Mailgun API credentials for email verification
- A modern web browser

## Configuration

Create a `.env` file in the project root:

```dotenv
DATABASE_PATH=<SQLAlchemy database URL>
MAILGUN=<Mailgun API key>
TINYFISH_API_KEY=<TinyFish API key>
```

`DATABASE_PATH` specifies the database used by the backend. Configure the database schema and account data for the environment before starting the application. `MAILGUN` provides email delivery for sign-in verification codes. `TINYFISH_API_KEY` enables optional merchant ranking.

## Run locally

### 1. Create a Python environment

From the project root, create and activate a virtual environment:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Install the backend packages:

```powershell
python -m pip install fastapi "uvicorn[standard]" sqlalchemy python-dotenv requests argon2-cffi
```

Install the Python driver for the database configured in `DATABASE_PATH`.

To enable merchant ranking, install the TinyFish SDK and configure `TINYFISH_API_KEY`:

```powershell
python -m pip install tinyfish
```

### 2. Configure services

Set the database URL and service credentials in the root `.env` file.

### 3. Start the API

From the project root, run:

```powershell
python -m uvicorn api:app --reload --host 127.0.0.1 --port 8000
```

The API is available at `http://127.0.0.1:8000`. Interactive API documentation is available at `http://127.0.0.1:8000/docs`.

### 4. Start the frontend

Open a second terminal, serve the `vanilla` directory, and navigate to the local address:

```powershell
cd vanilla
python -m http.server 3000 --bind 127.0.0.1
```

Open `http://127.0.0.1:3000` and select **Sign in**. The frontend connects to the API at `http://127.0.0.1:8000` by default. To use a different API URL, set it in the browser before loading the frontend:

```js
localStorage.setItem('creditflow-api-url', 'https://your-api-host')
```

## Authentication and accounts

Choose an account type and sign in with the account's email address and password. After credential verification, CreditFlow sends a six-digit verification code by email. The code is valid for five minutes, with up to five verification attempts and three resend requests per challenge.

Merchant and lender accounts can be requested from the sign-in page. Account types that require review must be approved by a super admin before sign-in. Agent and super-admin accounts are managed through platform operations.

## API overview

The FastAPI application serves the frontend's backend requests. Request and response schemas are available at `/docs`.

| Area | Representative routes |
| --- | --- |
| Authentication | `/auth/login`, `/auth/verify-otp`, `/auth/resend-otp`, `/auth/logout`, `/auth/createAccount` |
| Profiles | `/getUserProfile`, `/updateUserProfile` |
| Merchant | `/infoMerchant`, `/merchant/inventory/list`, `/merchant/inventory/update`, `/addTransactions`, `/createIssue`, `/getIssues` |
| Lender | `/infoLender`, `/addContract`, `/updateContract` |
| Agent | `/agent/tasks`, `/agent/tasks/decision` |
| Super admin | `/superadmin/accounts`, `/superadmin/account-requests`, `/superadmin/issues`, `/superadmin/contracts` |

Most application operations use `POST` requests. Authenticated routes use the bearer token returned after successful code verification.
