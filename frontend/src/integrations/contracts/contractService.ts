import { BrowserProvider, Contract, parseEther, ZeroAddress } from "ethers";
import EventTicketABI from "./EventTicket.abi.json";

/**
 * Contract service for interacting with EventTicket smart contract
 */

export interface ContractConfig {
  address: string;
  provider?: BrowserProvider;
}

let contract: Contract | null = null;
let currentProvider: BrowserProvider | null = null;

/**
 * Initialize the contract instance.
 * @param contractAddress - The deployed contract address.
 * @param signerAddress  - The specific wallet address that should sign transactions.
 *                         Always pass the currently-connected user/admin address so that
 *                         MetaMask's "selected" account cannot override the signer.
 */
export async function initializeContract(contractAddress: string, signerAddress?: string): Promise<Contract> {
  if (!(window as any).ethereum) {
    throw new Error("MetaMask or Web3 provider not found");
  }

  currentProvider = new BrowserProvider((window as any).ethereum);
  // Explicitly request the signer for the given address so that we always use the
  // wallet that is connected in the dApp, regardless of what MetaMask has "selected".
  const signer = signerAddress
    ? await currentProvider.getSigner(signerAddress)
    : await currentProvider.getSigner();

  contract = new Contract(contractAddress, EventTicketABI, signer);
  return contract;
}

/**
 * Get the contract instance (must be initialized first)
 */
export function getContract(): Contract {
  if (!contract) {
    throw new Error("Contract not initialized. Call initializeContract first.");
  }
  return contract;
}

/**
 * Get provider instance
 */
export function getProvider(): BrowserProvider {
  if (!currentProvider) {
    if (!(window as any).ethereum) {
      throw new Error("Web3 provider not found");
    }
    currentProvider = new BrowserProvider((window as any).ethereum);
  }
  return currentProvider;
}

// ============ Event Management ============

/**
 * Create a new event
 */
export async function createEvent(
  name: string,
  description: string,
  eventDate: number,
  location: string,
  capacity: number,
  basePrice: string
): Promise<{ txHash: string; contractEventId: number }> {
  const contract = getContract();

  const tx = await contract.createEvent(
    name,
    description,
    Math.floor(eventDate / 1000), // Convert to Unix timestamp
    location,
    capacity,
    parseEther(basePrice)
  );

  const receipt = await tx.wait();

  // Extract eventId from the EventCreated event log
  let contractEventId = 0;
  if (receipt?.logs) {
    for (const log of receipt.logs) {
      try {
        const parsed = (contract as any).interface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed?.name === "EventCreated") {
          contractEventId = Number(parsed.args[0]);
          break;
        }
      } catch { /* skip logs that can't be decoded */ }
    }
  }

  return { txHash: receipt?.hash || "", contractEventId };
}

/**
 * Get event details
 */
export async function getEvent(eventId: number) {
  const contract = getContract() as any;
  return await contract.getEvent(BigInt(eventId));
}

/**
 * Cancel an event
 */
export async function cancelEvent(eventId: number): Promise<string> {
  const contract = getContract();
  const tx = await contract.cancelEvent(eventId);
  const receipt = await tx.wait();
  return receipt?.hash || "";
}

/**
 * Get all events organized by an address
 */
export async function getOrganizedEvents(organizerAddress: string): Promise<number[]> {
  const contract = getContract();
  return await contract.getOrganizedEvents(organizerAddress);
}

// ============ Ticket Operations ============

/**
 * Mint a new ticket
 */
export async function mintTicket(eventId: number, recipientAddress: string, price: string): Promise<{ txHash: string; tokenId: number }> {
  const contract = getContract();

  const tx = await contract.mintTicket(eventId, recipientAddress, {
    value: parseEther(price),
  });

  const receipt = await tx.wait();

  // Extract tokenId from the TicketMinted event log
  let tokenId = 0;
  if (receipt?.logs) {
    for (const log of receipt.logs) {
      try {
        const parsed = (contract as any).interface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed?.name === "TicketMinted") {
          tokenId = Number(parsed.args[0]);
          break;
        }
      } catch { /* skip logs that can't be decoded */ }
    }
  }

  return { txHash: receipt?.hash || "", tokenId };
}

/**
 * Get ticket details
 */
export async function getTicket(tokenId: number) {
  const contract = getContract() as any;
  return await contract.getTicket(BigInt(tokenId));
}

/**
 * Check in a ticket
 */
export async function checkInTicket(tokenId: number, ipfsHash: string = ""): Promise<string> {
  const contract = getContract() as any;

  const tx = await contract.checkInTicket(BigInt(tokenId), ipfsHash);
  const receipt = await tx.wait();
  return receipt?.hash || "";
}

/**
 * Check if a ticket is checked in
 */
export async function isTicketCheckedIn(tokenId: number): Promise<boolean> {
  const contract = getContract() as any;
  return await contract.isCheckedIn(BigInt(tokenId));
}

/**
 * Get all tickets owned by an address
 */
export async function getUserTickets(ownerAddress: string): Promise<number[]> {
  const contract = getContract();
  return await contract.getUserTickets(ownerAddress);
}

/**
 * Get all tickets for an event
 */
export async function getEventTickets(eventId: number): Promise<number[]> {
  const contract = getContract() as any;
  return await contract.getEventTickets(BigInt(eventId));
}

// ============ Secondary Market (Resale) ============

/**
 * List a ticket for resale
 */
export async function listForResale(tokenId: number, priceInEth: string): Promise<string> {
  const contract = getContract() as any;

  const tx = await contract.listForResale(BigInt(tokenId), parseEther(priceInEth));
  const receipt = await tx.wait();
  return receipt?.hash || "";
}

/**
 * Cancel a resale listing
 */
export async function cancelResale(tokenId: number): Promise<string> {
  const contract = getContract() as any;

  const tx = await contract.cancelResale(BigInt(tokenId));
  const receipt = await tx.wait();
  return receipt?.hash || "";
}

/**
 * Buy a ticket from resale market
 */
export async function buyFromResale(tokenId: number, price: string): Promise<string> {
  const contract = getContract() as any;

  const tx = await contract.buyFromResale(BigInt(tokenId), {
    value: parseEther(price),
  });

  const receipt = await tx.wait();
  return receipt?.hash || "";
}

/**
 * Get resale offer details
 */
export async function getResaleOffer(tokenId: number) {
  const contract = getContract() as any;
  return await contract.getResaleOffer(BigInt(tokenId));
}

// ============ Admin Functions ============

/**
 * Withdraw platform fees (owner only)
 */
export async function withdrawPlatformFees(): Promise<string> {
  const contract = getContract();

  const tx = await contract.withdrawPlatformFees();
  const receipt = await tx.wait();
  return receipt?.hash || "";
}

/**
 * Set platform fee percentage (owner only)
 */
export async function setPlatformFeePercentage(percentage: number): Promise<string> {
  const contract = getContract();

  const tx = await contract.setPlatformFeePercentage(percentage);
  const receipt = await tx.wait();
  return receipt?.hash || "";
}

/**
 * Get contract balance information
 */
export async function getContractBalance() {
  const contract = getContract();
  const { totalBalance, feesCollected } = await contract.getContractBalance();

  return {
    totalBalance: totalBalance.toString(),
    feesCollected: feesCollected.toString(),
  };
}

/**
 * Get platform fee percentage
 */
export async function getPlatformFeePercentage(): Promise<number> {
  const contract = getContract();
  return await contract.platformFeePercentage();
}

// ============ Utility Functions ============

/**
 * Convert Wei to Ether string
 */
export function formatFromWei(weiValue: string | bigint, decimals: number = 4): string {
  const ethValue = Number(weiValue) / 1e18;
  return ethValue.toFixed(decimals);
}

/**
 * Get current network chain ID
 */
export async function getNetworkChainId(): Promise<number> {
  const provider = getProvider();
  const network = await provider.getNetwork();
  return Number(network.chainId);
}

/**
 * Switch network (for multi-chain support)
 */
export async function switchNetwork(chainId: number): Promise<void> {
  if (!(window as any).ethereum) {
    throw new Error("Web3 provider not found");
  }

  try {
    await (window as any).ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${chainId.toString(16)}` }],
    });
  } catch (error: any) {
    if (error.code === 4902) {
      // Chain not added to wallet
      throw new Error(`Chain ${chainId} not found in wallet. Please add it first.`);
    }
    throw error;
  }
}

/**
 * Listen to contract events
 */
export function onEventCreated(callback: (eventId: number) => void) {
  const contract = getContract();
  contract.on("EventCreated", (eventId) => {
    callback(Number(eventId));
  });
}

/**
 * Remove event listeners
 */
export function removeAllListeners() {
  const contract = getContract();
  contract.removeAllListeners();
}

// ============ NFT Metadata (Feature 1: Blockchain-Based NFT Tickets) ============

export interface NFTOnChainData {
  name: string;
  tokenId: number;
  eventId: number;
  eventName: string;
  eventLocation: string;
  eventDate: number;
  currentOwner: string;
  originalOwner: string;
  checkedIn: boolean;
  checkedInAt: number;
  isForSale: boolean;
  resalePrice: string;
}

/**
 * Get the current on-chain owner of a ticket NFT
 */
export async function getTokenOwner(tokenId: number): Promise<string> {
  const contract = getContract() as any;
  return await contract.ownerOf(BigInt(tokenId));
}

/**
 * Get the on-chain tokenURI (returns Base64-encoded JSON+SVG metadata)
 */
export async function getTokenURI(tokenId: number): Promise<string> {
  const contract = getContract() as any;
  return await contract.tokenURI(BigInt(tokenId));
}

/**
 * Fetch structured NFT metadata from the smart contract
 */
export async function getNFTMetadata(tokenId: number): Promise<NFTOnChainData> {
  const contract = getContract() as any;
  const raw = await contract.getNFTMetadata(BigInt(tokenId));
  return {
    name:          raw.name,
    tokenId:       Number(raw.tokenId),
    eventId:       Number(raw.eventId),
    eventName:     raw.eventName,
    eventLocation: raw.eventLocation,
    eventDate:     Number(raw.eventDate),
    currentOwner:  raw.currentOwner,
    originalOwner: raw.originalOwner,
    checkedIn:     raw.checkedIn,
    checkedInAt:   Number(raw.checkedInAt),
    isForSale:     raw.isForSale,
    resalePrice:   raw.resalePrice.toString(),
  };
}

/**
 * Verify that `expectedOwner` is the current on-chain owner of the given token.
 * Returns true if verified, false otherwise.
 */
export async function verifyNFTOwnership(tokenId: number, expectedOwner: string): Promise<boolean> {
  try {
    const owner = await getTokenOwner(tokenId);
    return owner.toLowerCase() === expectedOwner.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Decode a Base64 data-URI tokenURI into a plain JSON object.
 * Works for both `data:application/json;base64,...` and raw JSON strings.
 */
export function decodeTokenURI(uri: string): Record<string, unknown> | null {
  try {
    if (uri.startsWith("data:application/json;base64,")) {
      const base64 = uri.replace("data:application/json;base64,", "");
      const json = atob(base64);
      return JSON.parse(json);
    }
    return JSON.parse(uri);
  } catch {
    return null;
  }
}

