import mongoose from 'mongoose';
import { User } from './models/User.js';
import { KYC } from './models/KYC.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ticketshield';

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await User.deleteMany({});
    await KYC.deleteMany({});

    // Create sample users
    console.log('👥 Creating sample users...');
    const users = await User.insertMany([
      {
        email: 'adminshield@gmail.com',
        password: 'adminshield@01',
        wallet_address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        full_name: 'Admin Shield',
        is_admin: true,
        is_organizer: true,
        kyc_status: 'approved',
      },
      {
        email: 'john@example.com',
        password: 'Password123',
        wallet_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        full_name: 'John Doe',
        kyc_status: 'approved',
      },
      {
        email: 'jane@example.com',
        password: 'Password123',
        wallet_address: '0x3C44CdDdB6a900c2f40dc16f7B589d09f2a00FA2',
        full_name: 'Jane Smith',
        kyc_status: 'pending',
      },
    ]);

    console.log(`✅ Created ${users.length} users`);

    // Create sample KYC submissions
    console.log('📋 Creating sample KYC submissions...');
    const kycSubmissions = await KYC.insertMany([
      {
        user_id: users[0]._id.toString(),
        wallet_address: users[0].wallet_address,
        full_name: users[0].full_name,
        date_of_birth: '1990-01-15',
        country: 'United States',
        id_type: 'passport',
        status: 'approved',
        reviewed_at: new Date(),
      },
      {
        user_id: users[1]._id.toString(),
        wallet_address: users[1].wallet_address,
        full_name: users[1].full_name,
        date_of_birth: '1985-06-20',
        country: 'Canada',
        id_type: 'drivers_license',
        status: 'approved',
        reviewed_at: new Date(),
      },
      {
        user_id: users[2]._id.toString(),
        wallet_address: users[2].wallet_address,
        full_name: users[2].full_name,
        date_of_birth: '1995-03-10',
        country: 'United Kingdom',
        id_type: 'national_id',
        status: 'pending',
      },
    ]);

    console.log(`✅ Created ${kycSubmissions.length} KYC submissions`);

    console.log(`
╔════════════════════════════════════════╗
║     Database Seeding Complete! ✨      ║
╚════════════════════════════════════════╝

Sample Data Created:
  - ${users.length} Users
  - ${kycSubmissions.length} KYC Submissions

Test Accounts:
  1. Admin (KYC Approved)
     Email: adminshield@gmail.com
     Password: adminshield@01
     Wallet: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

  2. User 1 (KYC Approved)
     Email: john@example.com
     Wallet: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

  3. User 2 (KYC Pending)
     Email: jane@example.com
     Wallet: 0x3C44CdDdB6a900c2f40dc16f7B589d09f2a00FA2

You can now start the API server:
  npm start
    `);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error.message);
    process.exit(1);
  }
}

seedDatabase();
