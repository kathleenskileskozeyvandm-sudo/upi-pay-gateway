# UPI Pay Gateway

Act as a Principal Full-Stack Engineer. Build a self-hosted UPI payment verification gateway using Node.js (Express) with a local JSON file (database.json) for storage. The frontend must be clean, vanilla HTML/CSS/JS served from a public directory.
### 1. API Endpoints (`server.js`)

    Settings & Syncing:
        GET & POST /api/admin/settings: Store/retrieve configuration (target_package, secret_token, template, upi_vpa).
        POST /api/admin/sync-apps: Protected by x-gateway-secret header. Accepts a JSON array of apps { apps: [{ name, package }] } sent from an Android app, and saves it to the database.
        GET /api/admin/installed-apps: Returns the synced apps array.
        POST /api/admin/test-template: Accepts { template, sample_text }. Compiles the template into a Regex with named capture groups (?<amount>, ?<name>, ?<txid>) and returns the extracted fields.
    Gateway Logic:
        POST /api/checkout: Accepts { name, email, amount }. Generates a unique order_id, saves to DB as PENDING, and returns a upi://pay URL and a QR code image URL (using api.qrserver.com).
        POST /api/relay: Protected by the x-gateway-secret header. Accepts { packageName, title, text, postTime }. Verifies packageName matches the saved target, extracts the amount and transaction ID using the saved Regex template, and updates the oldest matching PENDING order to PAID.
        GET /api/status/:order_id: Returns the order status.

### 2. Frontend Views (in `public/`)

    admin.html:
        A dropdown for "Target Payment App" populated dynamically by fetching from /api/admin/installed-apps.
        Inputs for UPI VPA, Secret Token, and Message Template.
        A Regex Testing Sandbox where users paste raw text and see extracted variables instantly.
    checkout.html:
        A form for Name, Email, and Amount.
        On submit, fetch the QR code, hide the form, and display the QR.
        Poll /api/status/:order_id every 3 seconds. Redirect to success.html or failed.html based on the status.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c78f3c2d-8756-449c-9eb8-43762dbf7c96).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
