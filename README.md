# MicroEarn Server

This is the backend server for the MicroEarn application. It provides RESTful APIs for user management, task operations, payment processing, and email notifications.

## 🚀 Technologies
*   **Runtime:** Node.js
*   **Framework:** Express.js
*   **Database:** MongoDB
*   **Authentication:** Firebase Admin SDK & JWT
*   **Payments:** Stripe
*   **Email:** Nodemailer

## 🛠️ Setup

1.  Install dependencies: `npm install`
2.  Configure `.env` with:
    *   `DB_USER`, `DB_PASS`
    *   `ACCESS_TOKEN_SECRET`
    *   `STRIPE_SECRET_KEY`
    *   `EMAIL_USER`, `EMAIL_PASS`
3.  Run: `npm start` or `nodemon index.js`
