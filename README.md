# CreditFlow

CreditFlow is a team project. It is a web app that shows supplier credit repaying itself:
customers pay on a shop's UPI QR, a pre-agreed share of every sale goes to the lender, and the
rest stays with the shop. Three portals share one app — Merchant, Lender and Operations — and all
of them run on mock data, so no payment provider or backend is needed to try it.

## Run it locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:3000. `/` is the marketing landing page; **Open demo** leads to
`/login`, where you pick Merchant, Lender or Operations before entering a number.

Any valid 10-digit mobile number works. The next screen shows the demo OTP — type it or press
**Autofill** to continue.

| Portal     | Picker label | Home route  |
| ---------- | ------------ | ----------- |
| Merchant   | Merchant     | `/merchant` |
| Lender     | Lender       | `/lender`   |
| Operations | Operations   | `/admin`    |

## Sign-in and OTP

`src/lib/otp.ts` owns the flow. Codes live in memory, expire after 3 minutes and allow 5
attempts. There is no server, so the client generates and checks the code itself.

Three delivery paths, in priority order:

1. **Backend** — set `VITE_OTP_ENDPOINT` (see `.env.example`) to a service that sends SMS or
   triggers Truecaller. The request/response contract is documented in that file.
2. **Truecaller one-tap** — used when `window.Truecaller.verify` exists, i.e. inside the native
   Android wrapper. Truecaller has no browser SDK, so the web build cannot open the one-tap
   sheet on its own.
3. **Demo** — no channel configured: the code is generated in the browser and shown on the OTP
   screen. This is what the deployed demo uses.

Pressing **Verify with Truecaller** without a channel falls back to SMS/demo automatically and
says so in the UI.

## Scripts

| Command             | What it does                        |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Start the dev server on port 3000   |
| `npm run build`     | Type-check and build for production |
| `npm run preview`   | Serve the production build          |
| `npm run typecheck` | Run TypeScript without emitting     |
| `npm run lint`      | Run ESLint                          |
