# bitespeed-identity-reconciliation
Submission for Bitespeed Identity Reconciliation Assignment. 

# Backend - Node.js API
## Tech Stack
- Node.js (v18+)
- Express.js
- PostgreSQL
- Prisma ORM
- Joi (validation)
- Helmet (security)
- Morgan (logging)

## Key Features
- RESTful API with secure, validated endpoints
- Rate limiting to prevent abuse
- Structured error handling for Prisma and general errors
- Database migrations and seeding with Prisma
- Graceful shutdown handling for server and database connections
- Configurable CORS with support for multiple origins
  
## How to Run

1. Clone repository, install dependencies:

   ```bash
   npm install
   ```
2. Create a `.env` file in the root and set environment variables (e.g. DATABASE_URL, PORT, CORS_ORIGIN).
3. Generate Prisma client and push schema to database:

   ```bash
   npm run db:generate
   npm run db:push
   ```
4. Run migrations if needed:

   ```bash
   npm run db:migrate
   ```
5. Start the server in development mode:

   ```bash
   npm run dev
   ```
6. Optionally, start the server in production mode:
   ```bash
   npm start
   ```
## Deployment
[https://bitespeed-api-vuvz.onrender.com/identify](https://bitespeed-api-vuvz.onrender.com/identify)

