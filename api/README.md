# TicketShield MongoDB API Server

This is the MongoDB REST API backend for the TicketShield event ticketing platform.

## Prerequisites

- **Node.js** (v16 or higher)
- **MongoDB** (v4.4 or higher)
- **npm** (comes with Node.js)

## Installation

### 1. Install MongoDB

**Windows:**
- Download from [mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
- Run the installer
- Choose "Install MongoDB as a Service"
- MongoDB will start automatically

**macOS (using Homebrew):**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://pgp.mongodb.com/server-6.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-archive-keyring.gpg
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-archive-keyring.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
```

### 2. Install Dependencies

Navigate to the API directory and install Node dependencies:

```bash
cd api
npm install
```

### 3. Configure Environment

Copy `.env.example` to `.env` and update if needed:

```bash
cp .env.example .env
```

Default `.env` settings:
```
MONGODB_URI=mongodb://localhost:27017/ticketshield
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=ticketshield_dev_secret_key_12345
```

## Running the Server

### Development Mode (with auto-reload)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The API will start on `http://localhost:3001`

## Verify Installation

Check if the server is running:
```bash
curl http://localhost:3001/health
```

You should see:
```json
{
  "status": "OK",
  "timestamp": "2026-03-11T...",
  "uptime": 12.345,
  "mongooseConnection": "connected"
}
```

## Database Schema

### Users Collection
Stores user profiles and authentication data.

```javascript
{
  _id: ObjectId,
  user_id: String (unique),
  email: String (unique, required),
  wallet_address: String (unique),
  full_name: String,
  avatar_url: String,
  phone: String,
  is_admin: Boolean,
  is_organizer: Boolean,
  kyc_status: String, // 'unverified', 'pending', 'approved', 'rejected'
  last_login: Date,
  created_at: Date,
  updated_at: Date
}
```

### KYC Collection
Stores Know-Your-Customer verification data.

```javascript
{
  _id: ObjectId,
  user_id: String (unique, required),
  wallet_address: String (required),
  full_name: String (required),
  date_of_birth: String (required),
  country: String (required),
  id_type: String, // 'passport', 'drivers_license', 'national_id', 'other'
  id_number: String,
  document_url: String,
  status: String, // 'unverified', 'pending', 'approved', 'rejected'
  rejection_reason: String,
  rejection_date: Date,
  submitted_at: Date,
  reviewed_at: Date,
  reviewed_by: String,
  ip_address: String,
  user_agent: String
}
```

### ResaleListing Collection
Stores secondary market listings.

```javascript
{
  _id: ObjectId,
  token_id: Number (required),
  event_id: Number (required),
  seller: String (required),
  buyer: String,
  price: String (required),
  original_price: String,
  platform_fee: String,
  status: String, // 'active', 'sold', 'cancelled'
  cancellation_reason: String,
  transaction_hash: String,
  created_at: Date,
  updated_at: Date,
  sold_at: Date
}
```

## API Endpoints

### Users

**List all users**
```
GET /api/users
Response: [{user}, ...]
```

**Get user by ID**
```
GET /api/users/:userId
Response: {user}
```

**Create user**
```
POST /api/users
Body: {
  email: "user@example.com",
  wallet_address: "0x...",
  full_name: "John Doe"
}
Response: {user}
```

**Update user**
```
PUT /api/users/:userId
Body: { full_name: "Jane Doe", ... }
Response: {updated user}
```

**Delete user**
```
DELETE /api/users/:userId
Response: { success: true }
```

### KYC

**List all KYC submissions**
```
GET /api/kyc
GET /api/kyc?status=pending,rejected
Response: [{kyc}, ...]
```

**Get KYC by ID**
```
GET /api/kyc/:id
Response: {kyc}
```

**Get KYC by user ID**
```
GET /api/kyc/user/:userId
Response: {kyc}
```

**Submit KYC**
```
POST /api/kyc
Body: {
  user_id: "user123",
  wallet_address: "0x...",
  full_name: "John Doe",
  date_of_birth: "1990-01-15",
  country: "US",
  id_type: "passport"
}
Response: {kyc}
```

**Update KYC status (Admin)**
```
PUT /api/kyc/:id/status
Body: {
  status: "approved",
  rejection_reason: "" // Optional, for rejections
}
Response: {updated kyc}
```

### Resale

**List resale listings**
```
GET /api/resale
GET /api/resale?status=active
GET /api/resale?seller=0x...&event_id=1
Response: [{listing}, ...]
```

**Get listing by ID**
```
GET /api/resale/:id
Response: {listing}
```

**Create resale listing**
```
POST /api/resale
Body: {
  token_id: 1,
  event_id: 1,
  seller: "0x...",
  price: "1000000000000000000", // Wei
  original_price: "500000000000000000"
}
Response: {listing}
```

**Mark listing as sold**
```
PUT /api/resale/:id/sold
Body: {
  buyer: "0x...",
  transaction_hash: "0x..."
}
Response: {updated listing}
```

**Cancel resale listing**
```
PUT /api/resale/:id/cancel
Body: {
  cancellation_reason: "Changed mind"
}
Response: {updated listing}
```

## MongoDB Compass (GUI)

You can visualize and manage your MongoDB databases using MongoDB Compass:

1. Download from [mongodb.com/products/compass](https://www.mongodb.com/products/compass)
2. Install and open
3. Connect to `mongodb://localhost:27017`
4. Browse your `ticketshield` database

## Troubleshooting

### MongoDB Connection Error

If you see "Cannot connect to MongoDB":

1. **Check if MongoDB is running:**
   ```bash
   # Windows
   Get-Service -Name MongoDB
   
   # macOS
   brew services list
   
   # Linux
   sudo systemctl status mongod
   ```

2. **Start MongoDB:**
   ```bash
   # Windows (PowerShell as Admin)
   Start-Service MongoDB
   
   # macOS
   brew services start mongodb-community
   
   # Linux
   sudo systemctl start mongod
   ```

3. **Check connection string in .env:**
   - Default: `mongodb://localhost:27017/ticketshield`
   - Make sure port 27017 is not blocked

### Port Already in Use

If port 3001 is already in use:

1. Change the port in `.env`: `PORT=3002`
2. Update frontend `.env`: `VITE_MONGODB_API_URL=http://localhost:3002`

### CORS Errors

If you get CORS errors:

1. Check `CORS_ORIGIN` in `.env`
2. Make sure it matches your frontend URL (default: `http://localhost:5173`)

## Development Tips

1. **Use MongoDB Compass** to visualize your data
2. **Check logs** in console for error messages
3. **Test endpoints** with Postman or curl
4. **Enable validation** by using the schema validators in models

## Next Steps

1. Start the frontend development server
2. Ensure `VITE_MONGODB_API_URL` in frontend .env points to this API
3. Test the integration by creating a user

```bash
cd ../frontend
npm run dev
```

## Support

For issues or questions:
1. Check MongoDB is running
2. Check `.env` configuration
3. Review console error messages
4. Check API endpoint requests in browser DevTools

---

Happy ticketing! 🎫
