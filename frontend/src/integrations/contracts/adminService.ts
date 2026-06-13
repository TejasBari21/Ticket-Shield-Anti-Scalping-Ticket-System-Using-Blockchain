/**
 * Admin Service for Smart Contract Management
 * Provides admin/owner functions for the EventTicket contract
 */

import {
  getContract,
  initializeContract,
  getNetworkChainId,
} from "./contractService";
import { getContractBalance } from "./contractService";
import { BrowserProvider } from "ethers";

const contractAddress = (import.meta as any).env.VITE_CONTRACT_ADDRESS;

async function ensureContractInitialized() {
  try {
    getContract();
  } catch {
    await initializeContract(contractAddress);
  }
}

interface AdminStats {
  totalBalance: string;
  feesCollected: string;
  platformFeePercentage: number;
  chainId: number;
}

interface ContractOwner {
  address: string;
  verified: boolean;
}

/**
 * Get the contract owner address
 */
export async function getContractOwner(): Promise<ContractOwner> {
  await ensureContractInitialized();
  try {
    const contract = getContract() as any;
    const owner = await contract.owner?.();

    if (!owner) {
      throw new Error("Contract is not ownable or owner function not found");
    }

    return {
      address: owner,
      verified: true,
    };
  } catch (error) {
    // Contract may not be deployed or node not running — return empty result silently
    return {
      address: "",
      verified: false,
    };
  }
}

/**
 * Check if a wallet address is the contract owner
 */
export async function isContractOwner(walletAddress: string): Promise<boolean> {
  await ensureContractInitialized();
  try {
    const owner = await getContractOwner();
    return owner.address.toLowerCase() === walletAddress.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Get admin statistics
 */
export async function getAdminStats(): Promise<AdminStats | null> {
  await ensureContractInitialized();
  try {
    const contract = getContract() as any;

    const { totalBalance, feesCollected } = await getContractBalance();
    const platformFeePercentage = await (contract as any).platformFeePercentage();
    const chainId = await getNetworkChainId();

    return {
      totalBalance: totalBalance.toString(),
      feesCollected: feesCollected.toString(),
      platformFeePercentage: Number(platformFeePercentage),
      chainId: Number(chainId),
    };
  } catch (error) {
    console.error("Failed to get admin stats:", error);
    return null;
  }
}

/**
 * Withdraw platform fees (admin only)
 */
export async function withdrawFees(): Promise<string> {
  await ensureContractInitialized();
  try {
    // Withdraw is no longer needed – ticket payments go directly to admin wallet
    throw new Error("Withdraw is disabled: ticket payments are sent directly to the admin wallet.");
  } catch (error) {
    console.error("Failed to withdraw fees:", error);
    throw error;
  }
}

/**
 * Update platform fee percentage (admin only)
 */
export async function updatePlatformFee(newPercentage: number): Promise<string> {
  await ensureContractInitialized();
  try {
    if (newPercentage < 0 || newPercentage > 20) {
      throw new Error("Fee percentage must be between 0 and 20");
    }

    // setPlatformFeePercentage has been removed from the contract
    throw new Error("Platform fee update is disabled: payments go directly to admin wallet.");
  } catch (error) {
    console.error("Failed to update platform fee:", error);
    throw error;
  }
}

/**
 * Get all events data for admin overview
 */
export async function getAdminEventData(eventIds: number[]) {
  await ensureContractInitialized();
  try {
    const contract = getContract() as any;
    const events = await Promise.all(
      eventIds.map((id) => contract.getEvent(BigInt(id)))
    );

    return events.map((event: any, index: number) => ({
      id: index,
      ...event,
    }));
  } catch (error) {
    console.error("Failed to get event data:", error);
    return [];
  }
}

/**
 * Get all tickets for an event
 */
export async function getAdminEventTickets(eventId: number) {
  await ensureContractInitialized();
  try {
    const contract = getContract() as any;
    const ticketIds = await contract.getEventTickets(BigInt(eventId));

    const tickets = await Promise.all(
      ticketIds.map((id: bigint) => contract.getTicket(id))
    );

    return tickets.map((ticket: any, index: number) => ({
      id: Number(ticketIds[index]),
      ...ticket,
    }));
  } catch (error) {
    console.error("Failed to get event tickets:", error);
    return [];
  }
}

/**
 * Verify ticket is valid (for check-in)
 */
export async function verifyTicket(tokenId: number) {
  await ensureContractInitialized();
  try {
    const contract = getContract() as any;
    const ticket = await contract.getTicket(BigInt(tokenId));
    const isCheckedIn = await contract.isCheckedIn(BigInt(tokenId));

    return {
      tokenId,
      valid: !isCheckedIn,
      checkedIn: isCheckedIn,
      eventId: Number(ticket.eventId),
      owner: ticket.originalOwner,
      ...ticket,
    };
  } catch (error) {
    console.error("Failed to verify ticket:", error);
    return null;
  }
}

/**
 * Get admin role from environment or determine from wallet
 */
export async function checkAdminRole(walletAddress: string): Promise<{
  isAdmin: boolean;
  isOwner: boolean;
  role: "admin" | "organizer" | "user";
}> {
  await ensureContractInitialized();
  try {
    const envAdmin = (import.meta as any).env.VITE_ADMIN_ADDRESS;
    const isOwner = await isContractOwner(walletAddress);
    const isEnvAdmin =
      envAdmin && envAdmin.toLowerCase() === walletAddress.toLowerCase();

    return {
      isAdmin: isOwner || isEnvAdmin,
      isOwner,
      role: isOwner || isEnvAdmin ? "admin" : "user",
    };
  } catch (error) {
    console.error("Failed to check admin role:", error);
    return {
      isAdmin: false,
      isOwner: false,
      role: "user",
    };
  }
}

/**
 * Format contract balance for display
 */
export function formatBalance(wei: string): string {
  try {
    const ethValue = Number(wei) / 1e18;
    return ethValue.toFixed(4);
  } catch {
    return "0.0000";
  }
}

/**
 * Get admin dashboard data
 */
export async function getAdminDashboardData(walletAddress: string) {
  await ensureContractInitialized();
  try {
    const [stats, adminRole] = await Promise.all([
      getAdminStats(),
      checkAdminRole(walletAddress),
    ]);

    if (!adminRole.isAdmin) {
      throw new Error("Unauthorized: User is not an admin");
    }

    return {
      stats,
      role: adminRole,
      authorized: true,
    };
  } catch (error) {
    console.error("Failed to get admin dashboard data:", error);
    return {
      stats: null,
      role: { isAdmin: false, isOwner: false, role: "user" as const },
      authorized: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
