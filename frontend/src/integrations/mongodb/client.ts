/**
 * MongoDB API Client
 * Provides database operations through a REST API backend
 * Make sure your MongoDB backend API is running on VITE_MONGODB_API_URL
 */

import axios from 'axios';

const API_URL = (import.meta.env as Record<string, string>).VITE_MONGODB_API_URL || 'http://localhost:3001';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Type definitions
export interface User {
  _id?: string;
  id?: string;
  email: string;
  wallet_address?: string;
  user_id?: string;
  created_at?: string;
}

export interface KYCSubmission {
  _id?: string;
  id?: string;
  user_id: string;
  wallet_address: string;
  full_name: string;
  date_of_birth?: string;
  country: string;
  id_type: string;
  status: 'unverified' | 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  submitted_at: string;
  reviewed_at?: string | null;
}

export interface ResaleListing {
  _id?: string;
  id?: string;
  token_id: number;
  event_id: number;
  seller: string;
  price: string | bigint;
  status: 'active' | 'sold' | 'cancelled';
  created_at?: string;
  updated_at?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

/**
 * Database operations for users collection
 */
export const db = {
  users: {
    /**
     * Get all users
     */
    async getAll(): Promise<User[]> {
      try {
        const response = await apiClient.get('/api/users');
        return response.data;
      } catch (error) {
        console.error('Failed to fetch users:', error);
        return [];
      }
    },

    /**
     * Get user by ID
     */
    async getById(userId: string): Promise<User | null> {
      try {
        const response = await apiClient.get(`/api/users/${userId}`);
        return response.data;
      } catch (error) {
        console.error(`Failed to fetch user ${userId}:`, error);
        return null;
      }
    },

    /**
     * Create a new user
     */
    async create(userData: User): Promise<User> {
      try {
        const response = await apiClient.post('/api/users', userData);
        return response.data;
      } catch (error) {
        console.error('Failed to create user:', error);
        throw error;
      }
    },

    /**
     * Update user
     */
    async update(userId: string, updates: Partial<User>): Promise<User> {
      try {
        const response = await apiClient.put(`/api/users/${userId}`, updates);
        return response.data;
      } catch (error) {
        console.error(`Failed to update user ${userId}:`, error);
        throw error;
      }
    },

    /**
     * Delete user
     */
    async delete(userId: string): Promise<boolean> {
      try {
        await apiClient.delete(`/api/users/${userId}`);
        return true;
      } catch (error) {
        console.error(`Failed to delete user ${userId}:`, error);
        return false;
      }
    },
  },

  kyc: {
    /**
     * Get all KYC submissions
     */
    async getAll(): Promise<KYCSubmission[]> {
      try {
        const response = await apiClient.get('/api/kyc');
        return response.data;
      } catch (error) {
        console.error('Failed to fetch KYC submissions:', error);
        return [];
      }
    },

    /**
     * Get pending/rejected KYC submissions
     */
    async getPending(): Promise<KYCSubmission[]> {
      try {
        const response = await apiClient.get('/api/kyc?status=pending,rejected');
        return response.data;
      } catch (error) {
        console.error('Failed to fetch pending KYC:', error);
        return [];
      }
    },

    /**
     * Get KYC by user ID
     */
    async getByUserId(userId: string): Promise<KYCSubmission | null> {
      try {
        const response = await apiClient.get(`/api/kyc/user/${userId}`);
        return response.data;
      } catch (error) {
        console.error(`Failed to fetch KYC for user ${userId}:`, error);
        return null;
      }
    },

    /**
     * Submit KYC
     */
    async submit(kycData: KYCSubmission): Promise<KYCSubmission> {
      try {
        const response = await apiClient.post('/api/kyc', kycData);
        return response.data;
      } catch (error) {
        console.error('Failed to submit KYC:', error);
        throw error;
      }
    },

    /**
     * Update KYC status (admin only)
     */
    async updateStatus(kycId: string, status: string, rejectionReason?: string): Promise<KYCSubmission> {
      try {
        const response = await apiClient.put(`/api/kyc/${kycId}/status`, {
          status,
          rejectionReason,
        });
        return response.data;
      } catch (error) {
        console.error(`Failed to update KYC status:`, error);
        throw error;
      }
    },
  },

  resalListings: {
    /**
     * Get all active resale listings
     */
    async getActive(): Promise<ResaleListing[]> {
      try {
        const response = await apiClient.get('/api/resale?status=active');
        return response.data;
      } catch (error) {
        console.error('Failed to fetch resale listings:', error);
        return [];
      }
    },

    /**
     * Create resale listing
     */
    async create(listingData: Partial<ResaleListing>): Promise<ResaleListing> {
      try {
        const response = await apiClient.post('/api/resale', listingData);
        return response.data;
      } catch (error) {
        console.error('Failed to create resale listing:', error);
        throw error;
      }
    },

    /**
     * Update resale listing
     */
    async update(listingId: string, updates: Partial<ResaleListing>): Promise<ResaleListing> {
      try {
        const response = await apiClient.put(`/api/resale/${listingId}`, updates);
        return response.data;
      } catch (error) {
        console.error(`Failed to update resale listing:`, error);
        throw error;
      }
    },

    /**
     * Cancel resale listing
     */
    async cancel(listingId: string): Promise<ResaleListing> {
      try {
        const response = await apiClient.put(`/api/resale/${listingId}/cancel`, {});
        return response.data;
      } catch (error) {
        console.error(`Failed to cancel resale listing:`, error);
        throw error;
      }
    },
  },
};

export const chatbot = {
  async sendMessage(message: string, history: ChatMessage[] = []): Promise<string> {
    try {
      const response = await apiClient.post('/api/chatbot', { message, history });
      return response.data?.reply || 'I could not generate a response right now.';
    } catch (error) {
      console.error('Failed to send chatbot message:', error);
      throw error;
    }
  },
};

export default db;
