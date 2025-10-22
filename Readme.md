# Gemini Backend Clone

This Gemini backend clone uses Gemini's API and answers user's questions.

## Deployment Link

http://localhost:3000

## Postman API Documentation

https://documenter.getpostman.com/view/32924110/2sB3QQK85m

---

## Setup Instructions

### 1. Expected Package Versions

- Node.js v22.14.0
- npm v10.9.2

### 2. Clone the Repository

```bash
git clone https://github.com/PrabhatDongare/Gemini-Backend-Clone.git
cd Gemini-Backend-Clone
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Create .env file

Add the following environment variables to a `.env` file:

```
PORT
JWT_SECRET
DATABASE_URL
REDIS_URL
BACKEND_BASE_URL
GEMINI_API_KEY
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
STRIPE_PRO_PLAN_PRICE_ID
STRIPE_WEBHOOK_SECRET
```

### 5. Run the Development Server

```bash
npm run start
```

### 6. Create a Production Build and Run

```bash
npm run build
npm run serve
```

---

## Architecture Overview

Features include JWT authentication with OTP-based verification; users can also reset and change passwords. Relevant user details can be retrieved.

Users can interact with the Gemini clone and have a daily limit of 5 prompts. Users can upgrade for $30 to get unlimited chats. Payment integration uses Stripe, and a webhook updates the backend. Subscription status can be viewed.

Users can create multiple chatrooms to segregate chats. Caching of chatrooms is done using Redis hashmaps, improving response time from 1.2 s to 20 ms. When a user sends a prompt, an asynchronous task is enqueued and processed by two BullMQ workers.

All APIs are tested using Postman. The backend is hosted on Render.

---

## Queue System Explanation

BullMQ is used for asynchronous task processing. BullMQ is built around Redis and follows a Producer → Queue → Worker model. Heavy lifting is offloaded to workers with two retry attempts. The system can scale horizontally if needed.

---

## Gemini API Integration Overview

Google provides the Gemini API and integration documentation, which is used here. Additional error handling is added so that if a wrong response is returned or something goes wrong, the user receives a clearer message.

---

## Assumptions / Design Decisions

All design is done per the provided documentation; assumptions taken:

1. For the daily soft limit, an additional case is added in the API.
2. Responses are returned to the user only after the Gemini API fully returns a response.

---

## How to Test via Postman

All expected outputs for each API are attached. Import the Postman collection from the documentation link above, update the `baseURL` variables, and test the endpoints.

---

## Access / Deployment Instructions

The deployment link for the backend is shared above. Deployment is done on a free Render account, and the URL is publicly accessible.