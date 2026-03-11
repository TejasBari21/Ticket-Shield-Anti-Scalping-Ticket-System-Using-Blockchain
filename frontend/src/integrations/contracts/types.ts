/**
 * Type definitions for EventTicket smart contract
 */

export interface Event {
  eventId: bigint;
  organizer: string;
  name: string;
  description: string;
  eventDate: bigint;
  location: string;
  totalCapacity: bigint;
  ticketsSold: bigint;
  basePrice: bigint;
  cancelled: boolean;
  createdAt: bigint;
}

export interface Ticket {
  tokenId: bigint;
  eventId: bigint;
  checkedIn: boolean;
  checkedInAt: bigint;
  originalOwner: string;
  resalePrice: bigint;
  isForSale: boolean;
}

export interface ResaleOffer {
  tokenId: bigint;
  seller: string;
  price: bigint;
  active: boolean;
}

export interface TransactionResult {
  hash: string;
  from: string;
  to: string;
  value: string;
  data: string;
  blockNumber?: number;
  transactionIndex?: number;
  gasUsed?: string;
  cumulativeGasUsed?: string;
  gasPrice?: string;
  logsCount?: number;
  status: boolean;
  timestamp?: number;
}

export interface EventCreateParams {
  name: string;
  description: string;
  eventDate: number; // Unix timestamp in seconds
  location: string;
  capacity: number;
  basePrice: string; // ETH amount as string
}

export interface TicketMintParams {
  eventId: number;
  recipientAddress: string;
  price: string; // ETH amount as string
}

export interface ContractState {
  address: string;
  initialized: boolean;
  chainId: number;
  platformFeePercentage: number;
  totalBalance: string;
  feesCollected: string;
}

export interface EventFilterParams {
  organizer?: string;
  cancelled?: boolean;
  upcoming?: boolean;
}

export interface TicketFilterParams {
  eventId?: number;
  owner?: string;
  checkedIn?: boolean;
  isForSale?: boolean;
}
