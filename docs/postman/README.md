# API Collection for Postman

This folder contains the Postman collection for the Custom Marketing CRM Suite API.

## Quick Start

### 1. Import Collection

**Option A: Import from File (Recommended)**

1. Open Postman Desktop or Postman Web
2. Click **"Import"** button (top left)
3. Drag and drop `crm-backend.postman_collection.json` or click "Upload Files"
4. Collection will appear in your sidebar under "Collections"

**Option B: Import via File Browser**

1. In Postman, click **"Import"**
2. Click **"files"** tab
3. Browse to this folder and select `crm-backend.postman_collection.json`
4. Click **"Import"**

### 2. Configure Environment Variables

Before making requests, set up your environment variables:

**Method 1: Create Environment in Postman**

1. Click **"Environments"** in the left sidebar (or the environment dropdown in top-right)
2. Click **"+"** to create a new environment
3. Name it: **"Local Development"**
4. Add the following variables:

| Variable            | Initial Value            | Current Value            | Description                         |
| ------------------- | ------------------------ | ------------------------ | ----------------------------------- |
| `base_url`          | `http://localhost:4000`  | `http://localhost:4000`  | API base URL                        |
| `admin_secret`      | `your-admin-secret`      | `your-admin-secret`      | Admin secret from `.env`            |
| `test_admin_secret` | `your-test-admin-secret` | `your-test-admin-secret` | Test admin secret from `.env`       |
| `token`             | (leave empty)            | (leave empty)            | JWT token (auto-filled after login) |

5. Click **"Save"**
6. Select **"Local Development"** from the environment dropdown (top-right)

**Method 2: Import Environment File (if provided)**

If you have a `.postman_environment.json` file:

1. Click **"Import"** button
2. Select the environment file (e.g., `Local-Development.postman_environment.json`)
3. Select environment from dropdown

### 3. Start the API Server

Before testing the API, ensure the backend is running:

```bash
# From project root
npm run dev

# Or start API individually
cd apps/api
npm run dev
```

The API should be running at `http://localhost:4000`

### 4. Test the API

**Step 1: Create or Login to Admin Account**

Use one of these methods:

**A. Login with Existing Account** (if you've run `npm run db:seed`):

- Navigate to: **Auth → Login**
- Use credentials:
  - Email: `superadmin@example.com`
  - Password: `admin123`
- Click **"Send"**
- Token will be automatically saved to `{{token}}` variable

**B. Developer Login** (if configured in `.env`):

- Navigate to: **Auth → Developer Login**
- Use your developer credentials from `.env`
- Click **"Send"**

**C. Create Test Admin** (first time setup):

- Navigate to: **Auth → Create Test Admin**
- Update `admin_secret` in request body with value from your `.env`
- Click **"Send"**
- Login with: `superadmin@example.com` / `admin123`

**Step 2: Make Authenticated Requests**

Once logged in, the JWT token is automatically saved and included in all requests.

Try these requests:

- **Users → Get All Users** - View all users
- **Leads → Get All Leads** - View all leads
- **Campaigns → Get All Campaigns** - View all campaigns

## Collection Structure

The collection is organized into the following folders:

```
CRM API
├── Auth
│   ├── Login
│   ├── Developer Login
│   ├── Create Test Admin
│   └── Create System Admin
├── Users
│   ├── Get All Users
│   ├── Get User by ID
│   ├── Create User
│   ├── Update User
│   └── Delete User
├── Leads
│   ├── Get All Leads
│   ├── Get Lead by ID
│   ├── Create Lead
│   ├── Update Lead
│   ├── Delete Lead
│   └── Import Leads (CSV)
├── Contacts
│   ├── Get All Contacts
│   ├── Create Contact
│   └── Update Contact
├── Campaigns
│   ├── Get All Campaigns
│   ├── Create Campaign
│   ├── Update Campaign
│   ├── Send Campaign
│   └── Get Campaign Analytics
├── Products
│   ├── Get All Products
│   ├── Create Product
│   └── Update Product
├── Orders
│   ├── Get All Orders
│   ├── Create Order
│   └── Update Order Status
└── Integrations
    ├── MSG91 Configuration
    ├── Brevo Configuration
    └── Test Integration
```

## Environment Variables

The collection uses these variables (configured via Postman Environments):

| Variable            | Description                    | Example                 |
| ------------------- | ------------------------------ | ----------------------- |
| `base_url`          | API base URL                   | `http://localhost:4000` |
| `admin_secret`      | Secret for creating admins     | From your `.env` file   |
| `test_admin_secret` | Secret for test admin endpoint | From your `.env` file   |
| `token`             | JWT authentication token       | Auto-set after login    |

## Authentication

Most endpoints require JWT authentication:

1. **Login First**: Use any login endpoint (Auth folder)
2. **Token Auto-Save**: The collection automatically saves the token from login response
3. **Auto-Include**: All authenticated requests automatically include the token in the `Authorization` header

**Manual Token Setup** (if needed):

If the token isn't auto-saved, you can set it manually:

1. Copy token from login response
2. Go to Environment variables
3. Set `token` variable to the copied value

## Common API Workflows

### Workflow 1: Create and Manage Leads

1. **Login** → Auth → Login
2. **View Leads** → Leads → Get All Leads
3. **Create Lead** → Leads → Create Lead
4. **Update Lead** → Leads → Update Lead
5. **Import Bulk Leads** → Leads → Import Leads (CSV)

### Workflow 2: Create and Send Campaign

1. **Login** → Auth → Login
2. **View Contacts** → Contacts → Get All Contacts
3. **Create Campaign** → Campaigns → Create Campaign
4. **Send Campaign** → Campaigns → Send Campaign
5. **View Analytics** → Campaigns → Get Campaign Analytics

### Workflow 3: User Management

1. **Login as Admin** → Auth → Login (with SYSTEM_ADMIN account)
2. **View Users** → Users → Get All Users
3. **Create User** → Users → Create User
4. **Update User Role** → Users → Update User

### Workflow 4: Configure Integrations

1. **Login as System Admin** → Auth → Developer Login
2. **Configure MSG91** → Integrations → MSG91 Configuration
3. **Configure Brevo** → Integrations → Brevo Configuration
4. **Test Integration** → Integrations → Test Integration

## Troubleshooting

### Issue: "Could not get response" or Connection Refused

**Solution:**

- Ensure the API is running: `npm run dev`
- Check the API is on port 4000: `http://localhost:4000`
- Verify `base_url` environment variable is set correctly

### Issue: "401 Unauthorized" Error

**Solution:**

- You need to login first to get a JWT token
- Run any login request from the Auth folder
- Token should be auto-saved to `{{token}}` variable
- If not, manually copy token from response and set in environment

### Issue: "403 Forbidden" Error

**Solution:**

- Your account doesn't have permission for this action
- Login with SYSTEM_ADMIN account for full access
- Use: `superadmin@example.com` / `admin123` (after seeding)

### Issue: Environment Variables Not Working

**Solution:**

- Ensure you've created an environment in Postman
- Select the environment from the dropdown (top-right)
- Click the eye icon (👁) to verify variables are set
- Use `{{variable_name}}` syntax in requests

### Issue: "Cannot find module @repo/db" or Prisma Errors

**Solution:**

```bash
# Regenerate Prisma client
npm run db:generate

# Restart the API server
npm run dev
```

## Getting Environment Variable Values

Your environment variables come from the `.env` file in the project root:

```bash
# View your .env file
cat .env

# Look for these values:
# - ADMIN_SECRET
# - TEST_ADMIN_SECRET
# - JWT_SECRET
```

Copy these values into your Postman environment.

## Updating the Collection

When API endpoints change:

1. **Update requests** in Postman
2. **Export the collection**:
   - Right-click collection → Export
   - Choose "Collection v2.1"
   - Save to this folder as `crm-backend.postman_collection.json`
3. **Commit to Git** to share with team

## Sharing with Team

Team members can import this collection by:

1. **Cloning the repository**
2. **Opening Postman**
3. **Importing** `docs/postman/crm-backend.postman_collection.json`
4. **Creating their own environment** with their local values

No Postman account required for basic usage!

## Additional Resources

- **[Local Setup Guide](../LOCAL_SETUP.md)** - Complete setup instructions
- **[Main README](../../README.md)** - Project overview

## Need Help?

- Check the [Local Setup Guide](../LOCAL_SETUP.md) for environment setup
- Ensure Docker PostgreSQL is running: `docker-compose up -d`
- Verify database is seeded: `npm run db:seed`
- Check API logs in the terminal where `npm run dev` is running

---

**Happy Testing! 🚀**
