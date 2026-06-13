import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import usersRouter from './routes/users.js';
import kycRouter from './routes/kyc.js';
import resaleRouter from './routes/resale.js';
import chatbotRouter from './routes/chatbot.js';
// REMOVED: Old Nodemailer/Gmail email service (use Resend instead)
// import emailRouter from './routes/email.js';
import ticketEmailRouter from './routes/ticketEmail.js';

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ticketshield';

// Middleware
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:8080')
  .split(',')
  .map(origin => origin.trim());

console.log('🔒 CORS allowed origins:', corsOrigins);

app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200,
}));

// Explicit preflight request handler
app.options('*', cors({
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    console.log(`📦 Database: ${MONGODB_URI}`);
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error.message);
    console.log('Starting API in degraded mode (chatbot still available).');
    console.log('Make sure MongoDB is running:');
    console.log('  - Windows: mongod');
    console.log('  - macOS: brew services start mongodb-community');
    console.log('  - Linux: sudo systemctl start mongod');
  });

// API Routes
app.use('/api/users', usersRouter);
app.use('/api/kyc', kycRouter);
app.use('/api/resale', resaleRouter);
app.use('/api/chatbot', chatbotRouter);
// REMOVED: Old email service, using Resend API only
app.use('/api', ticketEmailRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date(),
    uptime: process.uptime(),
    mongooseConnection: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'TicketShield MongoDB API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      users: '/api/users',
      kyc: '/api/kyc',
      resale: '/api/resale',
      chatbot: '/api/chatbot',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║    TicketShield MongoDB API Server      ║
║             Running on:                 ║
║        http://localhost:${PORT}         ║
╚════════════════════════════════════════╝

Available endpoints:
  GET  /health                - Server health check
  GET  /api/users             - List all users
  GET  /api/users/:id         - Get user by ID
  POST /api/users             - Create new user
  
  GET  /api/kyc               - List all KYC submissions
  GET  /api/kyc/:id           - Get KYC by ID
  GET  /api/kyc/user/:userId  - Get KYC by user ID
  POST /api/kyc               - Submit KYC
  
  GET  /api/resale            - List resale listings
  GET  /api/resale/:id        - Get listing by ID
  POST /api/resale            - Create new listing

Database: ${MONGODB_URI}
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  mongoose.connection.close();
  process.exit(0);
});

export default app;
