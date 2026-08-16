# Local Development Setup Guide

This guide will walk you through setting up the Custom Marketing CRM Suite on your local machine.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Overview](#project-overview)
3. [Environment Variables Setup](#environment-variables-setup)
4. [Database Setup](#database-setup)
5. [Installation Steps](#installation-steps)
6. [Running the Application](#running-the-application)
7. [Development Workflow](#development-workflow)
8. [Troubleshooting](#troubleshooting)
9. [API Documentation](#api-documentation)

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 18.x ([Download](https://nodejs.org/))
- **npm** >= 7.24.2 (comes with Node.js)
- **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop))
- **Git** ([Download](https://git-scm.com/))
- **PowerShell** (for Windows users - comes pre-installed)

### Verify Installation

```bash
node --version    # Should be >= 18
npm --version     # Should be >= 7.24.2
docker --version  # Should be installed and running
```

---

## Project Overview

This is a **Turborepo monorepo** with the following structure:

```
custom-marketing-crm-suite/
├── apps/
│   ├── api/              # Express 5 Backend API (Port 4000)
│   └── web/              # Next.js 15 Frontend (Port 3000)
├── packages/
│   ├── db/               # Shared Prisma Database Package
│   ├── ui/               # Shared UI Component Library
│   ├── eslint-config/    # Shared ESLint Configuration
│   └── typescript-config/ # Shared TypeScript Configuration
├── scripts/              # Build and environment switching scripts
├── docs/                 # Documentation
├── .env                  # Active environment configuration
└── .env.example          # Template for environment variables
```

### Tech Stack

**Frontend (apps/web):**

- Next.js 15.5 with App Router
- React 19
- Tailwind CSS 4
- TanStack Query
- Chart.js for analytics

**Backend (apps/api):**

- Express 5
- Prisma ORM
- JWT Authentication
- AWS S3 for file storage
- MSG91 for WhatsApp/SMS
- Brevo for Email

**Database:**

- PostgreSQL 15
- Prisma 5.21.1

---

## Environment Variables Setup

### Centralized Environment Configuration

This project uses a **single centralized `.env` file** at the root of the monorepo for all environment variables. This simplifies configuration management and ensures consistency across all packages and apps.

**Location:** `<project-root>/.env`

This **single environment file** contains all configuration for:

- Database credentials (PostgreSQL)
- Backend API configuration (Express)
- Frontend configuration (Next.js - `NEXT_PUBLIC_*` variables)
- Third-party service credentials (AWS S3, MSG91, Plunk, GST API)
- JWT secrets and encryption keys
- Feature flags and optional settings

**Files in root:**

- `.env` - Currently active environment
- `.env.example` - Template with all variables

**How it works:**

- The **API** (`apps/api`) loads the root `.env` via `dotenv.config({ path: '../../.env' })`
- The **Frontend** (`apps/web`) loads the root `.env` via `dotenv` in `next.config.js`
- The **Database package** (`packages/db`) uses `dotenv-cli` to load the root `.env`
- All apps and packages share the same environment configuration

### Setting Up Environment Variables

#### Step 1: Create Root Environment File

```bash
# Copy the example file
cp .env.example .env
```

#### Step 2: Configure Root Variables

Open `.env` and fill in the required values. See the [Environment Variables Reference](#environment-variables-reference) below.

**Minimal Required Variables for Local Development:**

```bash
# Database (Local Docker)
DATABASE_URL="postgresql://postgres:password@localhost:5433/innovun_crm?pgbouncer=true"
DIRECT_URL="postgresql://postgres:password@localhost:5433/innovun_crm"

# JWT Secret (Change this!)
JWT_SECRET="your-super-secret-jwt-key-change-me"
JWT_EXPIRES_IN="24h"

# Encryption
ENCRYPTION_KEY="your-32-character-encryption-key"

# Admin Creation
TEST_ADMIN_SECRET="your-admin-secret"
ADMIN_SECRET="your-admin-secret"

# Server
PORT=4000
NODE_ENV="development"

# Developer Access (Default Credentials)
DEVELOPER_LOGIN_EMAIL="developer@example.com"
DEVELOPER_LOGIN_PASSWORD="admin123"
DEVELOPER_LOGIN_NAME="Developer Access"
```

**Frontend Variables (included in root `.env`):**

The root `.env` file also includes frontend-specific variables:

```bash
# Company Configuration
NEXT_PUBLIC_COMPANY_NAME="InnoCRM"

# API Configuration
NEXT_PUBLIC_API_URL="http://localhost:4000"

# Feature Flags
NEXT_PUBLIC_WHATSAPP_TEXT_ONLY_MVP=false
NEXT_PUBLIC_ALLOW_AUTH_TEMPLATES=false
NEXT_PUBLIC_ALLOW_UTILITY_TEMPLATES=false
```

#### Step 3: Optional Third-Party Services

For full functionality, configure these optional services:

**AWS S3 (Required for WhatsApp campaigns with media):**

```bash
AWS_REGION="ap-southeast-2"
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
S3_BUCKET_NAME="your-bucket-name"
```

**MSG91 (Required for WhatsApp/SMS):**

```bash
MSG91_BASE_URL="https://control.msg91.com/api/v5"
MSG91_AUTH_KEY="your-msg91-auth-key"
MSG91_OTP_TEMPLATE_ID="your-template-id"
```

**Plunk (Required for email campaigns):**

```bash
PLUNK_API_KEY="your-plunk-api-key"
PLUNK_FROM_EMAIL="no-reply@yourdomain.com"
PLUNK_FROM_NAME="Your Company CRM"
```

**GST API (Required for subdealer GST verification):**

```bash
GST_API_URL="https://sheet.gstincheck.co.in/check/"
GST_API_KEY="your-gst-api-key"
```

### Environment Variables Reference

See `.env.example` for a complete list of all available environment variables with descriptions.

---

## Database Setup

### Option 1: Local Docker PostgreSQL (Recommended for Development)

#### Start PostgreSQL Container

```bash
# Start the Docker container
docker-compose up -d

# Verify it's running
docker ps
```

This will start PostgreSQL on **port 5433** (to avoid conflicts with system PostgreSQL).

**Database Details:**

- **Host:** localhost
- **Port:** 5433
- **Database:** innovun_crm
- **User:** postgres
- **Password:** password

#### Configure Database Environment

**⚠️ Warning:** Be careful when working with production data!

---

## Installation Steps

### 1. Clone the Repository

```bash
git clone <repository-url>
cd custom-marketing-crm-suite
```

### 2. Install Dependencies

```bash
# Install all dependencies for the monorepo
npm install
```

This will install dependencies for:

- Root workspace
- apps/api
- apps/web
- All packages (db, ui, etc.)

### 3. Setup Environment Variables

Follow the [Environment Variables Setup](#environment-variables-setup) section above.

**Quick Setup:**

```bash
# Create root .env.local from the template
cp .env.example .env

# Edit .env.local with your values
# This single file contains ALL environment variables for the entire monorepo
# including frontend (NEXT_PUBLIC_*), backend, and database configuration
```

**Note:** All apps and packages now use the centralized root `.env` file. No need to create separate `.env` files in `apps/web` or `packages/db`.

### 4. Start Local Database

```bash
# Start PostgreSQL in Docker
docker-compose up -d

# Verify it's running
docker ps
```

### 5. Generate Prisma Client

```bash
# Generate Prisma client and TypeScript types
npm run db:generate
```

### 6. Run Database Migrations

```bash
# Apply all migrations to create database schema
npm run db:deploy
```

### 7. Seed the Database (Required for User Accounts)

```bash
# Populate database with test data and create user accounts
npm run db:seed
```

**This creates:**

- ✅ **SYSTEM_ADMIN** user (superadmin@example.com)
- ✅ **ADMIN** user (admin@example.com)
- ✅ **DEVELOPER** user (developer@example.com)
- ✅ **SALES** users (sarah.sales@example.com, liam.sales@example.com, etc.)
- Sample leads and contacts
- Sample campaigns
- Sample products and orders

**After running the seed, you'll see all login credentials printed in the terminal. Copy and save them for easy access!**

### 8. Configure Developer Login (Important!)

The seed script creates a developer account, but for the **Developer Login feature** to work, you need to add these credentials to your `.env` file:

**Add to your `.env`:**

```bash
# Developer Login Configuration
DEVELOPER_LOGIN_EMAIL="developer@innovun.com"
DEVELOPER_LOGIN_PASSWORD="admin123"
DEVELOPER_LOGIN_NAME="Developer Access"
```

**How Developer Login Works:**

- The developer login matches credentials from your `.env` file
- When you login with developer credentials, the system:
  - Creates the developer user if it doesn't exist
  - Updates the user to SYSTEM_ADMIN role if it exists
  - Syncs the password with `DEVELOPER_LOGIN_PASSWORD` from `.env`
- This allows you to quickly access the system with admin privileges

**To use developer login:**

1. Add the credentials above to your `.env` file
2. Start the app: `npm run dev`
3. Navigate to: http://localhost:3000
4. Use the developer login option with the credentials from your `.env`

**Note:** The seeded developer account uses password `admin123` by default. Make sure `DEVELOPER_LOGIN_PASSWORD` in your `.env` matches this, or the developer login will update it to match your `.env` value.

---

## Additional Setup (Optional)

### 9. Create Additional Admin Accounts via API

You can create additional SYSTEM_ADMIN or ADMIN users using API endpoints. This is useful for production or when you need custom admin accounts.

#### Option A: Create Test Admin (Quick - For Development)

**Endpoint:** `POST /api/auth/create-test-admin`

This creates a fixed test admin account: `superadmin@example.com` / `admin123`

**Using cURL:**

```bash
# Start the API server first
npm run dev

# In another terminal:
curl -X POST http://localhost:4000/api/auth/create-test-admin \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "your-admin-secret"
  }'
```

**Using Postman:**

1. **Method:** `POST`
2. **URL:** `http://localhost:4000/api/auth/create-test-admin`
3. **Headers:**
   - `Content-Type`: `application/json`
4. **Body (JSON):**
   ```json
   {
     "secret": "your-admin-secret"
   }
   ```
5. **Replace** `"your-admin-secret"` with the value of `TEST_ADMIN_SECRET` from your `.env` file

**Success Response:**

```json
{
  "message": "Test admin created successfully"
}
```

**Created Account:**

- Email: `superadmin@example.com`
- Password: `admin123`
- Role: `SYSTEM_ADMIN`

---

#### Option B: Create Production Developer/Admin (Custom Details)

**Endpoint:** `POST /api/auth/create-system-admin`

This creates a custom admin with your specified details and a randomly generated password sent via email.

**Using cURL:**

```bash
curl -X POST http://localhost:4000/api/auth/create-system-admin \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: your-admin-secret" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@company.com",
    "phone": "9876543210",
    "role": "SYSTEM_ADMIN"
  }'
```

**Using Postman:**

1. **Method:** `POST`
2. **URL:** `http://localhost:4000/api/auth/create-system-admin`
3. **Headers:**
   - `Content-Type`: `application/json`
   - `x-admin-secret`: `your-admin-secret` (from `.env` ADMIN_SECRET)
4. **Body (JSON):**
   ```json
   {
     "firstName": "John",
     "lastName": "Doe",
     "email": "john.doe@company.com",
     "phone": "9876543210",
     "role": "SYSTEM_ADMIN"
   }
   ```

**Available Roles:**

- `SYSTEM_ADMIN` - Full system access (manage users, products, orders, etc.)
- `ADMIN` - Admin access (manage leads, campaigns, contacts - cannot manage users)

**Success Response:**

```json
{
  "message": "System admin created successfully",
  "user": {
    "id": 123,
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@company.com",
    "role": "SYSTEM_ADMIN"
  },
  "tempPassword": "AbCd1234EfGh"
}
```

**Important:**

- A random password is generated
- Password is returned in the response (save it!)
- An email is sent to the user with login credentials (if email service is configured)
- User should change password after first login

---

### 10. Configure Third-Party Integrations (MSG91 & Brevo)

After creating your admin account, you can configure MSG91 (WhatsApp/SMS) and Brevo (Email) integrations via the Integration Manager.

#### Prerequisites

1. **Developer/System Admin Login Required:**
   - You need to be logged in as SYSTEM_ADMIN or Developer
   - Regular ADMIN users cannot access integration settings

2. **API Keys Required:**
   - **MSG91:** Sign up at https://msg91.com/ and get your Auth Key
   - **Brevo:** Sign up at https://www.brevo.com/ and get your API Key

#### Step-by-Step Configuration

**Step 1: Login as Developer/System Admin**

```bash
# Ensure app is running
npm run dev

# Navigate to frontend
http://localhost:3000

# Login with developer credentials
Email: developer@example.com
Password: admin123 (or your DEVELOPER_LOGIN_PASSWORD)
```

**Step 2: Access Integration Manager**

After successful developer login, you'll be redirected to:

```
http://localhost:3000/integration-manager
```

Or navigate manually:

- Click on your profile/menu
- Select "Integration Manager" or "Settings"

#### Configure MSG91 (WhatsApp & SMS)

**In Integration Manager:**

1. **Find MSG91 Section**
   - Look for "MSG91 Configuration" or "WhatsApp/SMS Settings"

2. **Enter Credentials:**
   - **Auth Key:** Your MSG91 authentication key
   - **Base URL:** `https://control.msg91.com/api/v5` (usually pre-filled)
   - **OTP Template ID:** Your MSG91 OTP template ID (optional)

3. **Test Connection:**
   - Click "Test Connection" to verify credentials
   - Should show success message if configured correctly

4. **Save Configuration:**
   - Click "Save" to store credentials
   - Credentials are encrypted and stored in the database

**Getting MSG91 Credentials:**

1. Go to https://msg91.com/
2. Sign up or login
3. Navigate to "API" section
4. Copy your "Auth Key"
5. For WhatsApp: Set up WhatsApp templates in MSG91 dashboard

#### Configure Brevo (Email Marketing)

**In Integration Manager:**

1. **Find Brevo Section**
   - Look for "Brevo Configuration" or "Email Settings"

2. **Enter Credentials:**
   - **API Key:** Your Brevo API key
   - **From Email:** Default sender email (e.g., `no-reply@yourdomain.com`)
   - **From Name:** Default sender name (e.g., `Your Company CRM`)

3. **Test Connection:**
   - Click "Test Connection" to verify credentials
   - Should show success message if configured correctly

4. **Save Configuration:**
   - Click "Save" to store credentials
   - Credentials are encrypted and stored in the database

**Getting Brevo Credentials:**

1. Go to https://www.brevo.com/
2. Sign up or login
3. Navigate to "SMTP & API" → "API Keys"
4. Create new API key or copy existing one
5. Make sure the API key has permission to send emails

#### Alternative: Configure via Environment Variables

You can also configure these services directly in your `.env` file (see [Environment Variables Setup](#environment-variables-setup)):

**MSG91:**

```bash
MSG91_BASE_URL="https://control.msg91.com/api/v5"
MSG91_AUTH_KEY="your-msg91-auth-key"
MSG91_OTP_TEMPLATE_ID="your-template-id"
```

**Brevo/Plunk:**

```bash
PLUNK_API_KEY="your-plunk-or-brevo-api-key"
PLUNK_FROM_EMAIL="no-reply@yourdomain.com"
PLUNK_FROM_NAME="Your Company CRM"
```

**Note:** Integration Manager settings take precedence over environment variables.

#### Verify Configuration

**Test MSG91:**

1. Go to "Campaigns" → "Create Campaign"
2. Select "WhatsApp" or "SMS" as channel
3. Try sending a test message
4. Check MSG91 dashboard for delivery status

**Test Brevo:**

1. Go to "Campaigns" → "Create Campaign"
2. Select "Email" as channel
3. Try sending a test email
4. Check Brevo dashboard for delivery status

---

## Running the Application

### Start All Services (Recommended)

```bash
# Start both frontend and backend in development mode
npm run dev
```

This will start:

- **Backend API:** http://localhost:4000
- **Frontend:** http://localhost:3000

### Start Services Individually

If you prefer to run them separately:

```bash
# Terminal 1: Start backend API
cd apps/api
npm run dev

# Terminal 2: Start frontend
cd apps/web
npm run dev
```

### Access the Application

1. **Frontend:** Open http://localhost:3000 in your browser
2. **API:** Backend API available at http://localhost:4000

### Default Login Credentials

After running `npm run db:seed`, all user credentials are printed in the terminal. Here's a quick reference:

**🔑 Main Accounts Created by Seed:**

**1. SYSTEM_ADMIN (Full Access):**

- Email: `superadmin@example.com`
- Password: `admin123`
- Use this for: Full system access, managing users, products, orders

**2. ADMIN (Admin Access):**

- Email: `admin@example.com`
- Password: `admin123`
- Use this for: Managing leads, campaigns, contacts (cannot manage users)

**3. DEVELOPER (Developer Login - SYSTEM_ADMIN):**

- Email: `developer@example.com`
- Password: `admin123` (seeded)
- Use this for: Developer access via environment-based login
- **Important:** Configure in `.env` (see [Step 8](#8-configure-developer-login-important))

**4. SALES USERS:**

- Emails: `sarah.sales@example.com`, `liam.sales@example.com`, etc.
- Password: `admin123` (all sales users)
- Use this for: Testing sales functionality

**💡 Quick Tip:** Copy the credentials from the terminal output after seeding for easy reference!

---

## Development Workflow

### Daily Development Flow

```bash
# 1. Ensure Docker is running
docker-compose up -d

# 2. Switch to local database (if needed)
npm run db:switch:local

# 3. Apply any new migrations
npm run db:deploy

# 4. Start development servers
npm run dev
```

### Database Management

```bash
# Generate Prisma client after schema changes
npm run db:generate

# Create a new migration
cd packages/db
npx prisma migrate dev --name your_migration_name

# Apply migrations
npm run db:deploy

# Reset database (⚠️ deletes all data)
npm run db:reset

# Open Prisma Studio (Database GUI)
npm run db:studio
```

### Building for Production

```bash
# Build all apps and packages
npm run build

# Run production build
cd apps/api && npm start
cd apps/web && npm start
```

### Code Quality

```bash
# Lint all code
npm run lint

# Format all code with Prettier
npm run format

# Type check all TypeScript
npm run check-types
```

---

## Troubleshooting

### Database Connection Issues

**Problem:** Cannot connect to PostgreSQL

**Solution:**

```bash
# Check if Docker is running
docker ps

# Restart Docker container
docker-compose down
docker-compose up -d

# Verify DATABASE_URL in .env matches docker-compose.yml
# Should be: postgresql://postgres:password@localhost:5433/innovun_crm
```

### Port Already in Use

**Problem:** Port 3000 or 4000 is already in use

**Solution:**

```bash
# Find process using the port (Windows)
netstat -ano | findstr :3000
netstat -ano | findstr :4000

# Kill the process by PID
taskkill /PID <pid> /F

# Or change the port in root .env file
# For frontend: Change NEXT_PUBLIC_API_URL if needed
# For backend: Change PORT variable
```

### Prisma Client Generation Fails

**Problem:** `@prisma/client` not found

**Solution:**

```bash
# Clean install
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules
npm install

# Regenerate Prisma client
npm run db:generate
```

### Migration Issues

**Problem:** Migration conflicts or schema drift

**Solution:**

```bash
# Reset database (⚠️ loses all data)
npm run db:reset

# Or manually fix
cd packages/db
npx prisma migrate resolve --applied <migration_name>
npx prisma migrate deploy
```

### Environment Variables Not Loading

**Problem:** Application can't read environment variables

**Solution:**

```bash
# Verify root .env file exists
ls -la .env

# Ensure the .env file is in the root directory
# All apps and packages load from this single centralized file

# Check if you have .env.local or .env.production instead
# If so, copy one of them to .env:
cp .env.local .env

# Restart the development servers
npm run dev
```

### Docker Issues on Windows

**Problem:** Docker Desktop not starting or WSL2 errors

**Solution:**

1. Ensure WSL2 is installed and updated
2. Enable "Use WSL 2 based engine" in Docker Desktop settings
3. Restart Docker Desktop
4. Run: `wsl --update`

### Build Errors

**Problem:** TypeScript or build errors

**Solution:**

```bash
# Clean all builds
rm -rf apps/*/dist
rm -rf apps/*/.next
rm -rf packages/*/dist

# Reinstall and rebuild
npm install
npm run db:generate
npm run build
```

---

## API Documentation

### Quick Access

All API documentation and Postman collections are stored in the **`/docs/postman/`** folder in the repository:

```
custom-marketing-crm-suite/
├── docs/
│   └── postman/
│       ├── README.md                                     # Quick start guide
│       ├── crm-backend.postman_collection.json          # API collection
│       └── *.postman_environment.json                    # Environment files
```

**📦 To use the API documentation:**

1. Navigate to the `/docs/postman/` folder in the repository
2. Follow the instructions in `/docs/postman/README.md`
3. Import the Postman collection (`crm-backend.postman_collection.json`) into your Postman application

**For detailed setup instructions, see the [Postman folder README](./postman/README.md).**

---

## Additional Documentation

- **[API Documentation](../postman/README.md)** - Postman collection and API testing guide
- **[WHATSAPP_S3_SETUP.md](./WHATSAPP_S3_SETUP.md)** - Complete guide for setting up WhatsApp campaigns with S3
- **[../README.md](../README.md)** - Main project README

---

## Quick Reference Commands

```bash
# Development
npm run dev                    # Start all services
npm run build                  # Build all packages
npm run lint                   # Lint all code
npm run format                 # Format with Prettier

# Database
npm run db:generate            # Generate Prisma client
npm run db:migrate             # Create new migration
npm run db:deploy              # Apply migrations
npm run db:studio              # Open Prisma Studio
npm run db:seed                # Seed database
npm run db:reset               # Reset database


# Docker
docker-compose up -d           # Start PostgreSQL
docker-compose down            # Stop PostgreSQL
docker-compose logs -f         # View logs
docker ps                      # List running containers

# API Endpoints (via cURL)
# Create test admin (quick)
curl -X POST http://localhost:4000/api/auth/create-test-admin \
  -H "Content-Type: application/json" \
  -d '{"secret": "your-admin-secret"}'

# Create production admin (custom)
curl -X POST http://localhost:4000/api/auth/create-system-admin \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: your-admin-secret" \
  -d '{"firstName": "John", "lastName": "Doe", "email": "john@company.com", "role": "SYSTEM_ADMIN"}'
```

---

## Need Help?

- Check existing documentation in the `/docs` folder
- Review code comments in the source files
- Open an issue in the project repository
- Contact the development team

---

**Happy Coding! 🚀**
