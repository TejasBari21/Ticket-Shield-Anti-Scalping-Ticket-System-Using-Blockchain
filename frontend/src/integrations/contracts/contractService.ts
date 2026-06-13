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

function normalizeEthAmount(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }

  // If a bigint wei value is accidentally passed (e.g. "10000000000000000"),
  // convert it to ETH decimal string so parseEther receives valid ETH units.
  if (/^\d{15,}$/.test(trimmed)) {
    const wei = BigInt(trimmed);
    const whole = wei / 10n ** 18n;
    const fraction = (wei % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
    return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
  }

  return trimmed;
}

async function assertContractDeployed(contractAddress: string, provider: BrowserProvider) {
  const code = await provider.getCode(contractAddress);
  if (!code || code === "0x") {
    throw new Error(
      `No smart contract found at ${contractAddress}. Deploy the contract and update VITE_CONTRACT_ADDRESS before sending transactions.`
    );
  }
}

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
  await assertContractDeployed(contractAddress, currentProvider);
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
  basePrice: string,
  maxResalePrice: string = "0"
): Promise<{ txHash: string; contractEventId: number }> {
  const contract = getContract();
  const normalizedBasePrice = normalizeEthAmount(basePrice, "Base price");
  const normalizedMaxResalePrice = normalizeEthAmount(maxResalePrice, "Max resale price");
  const eventDateInSeconds = Math.floor(eventDate / 1000);

  // Get the current block timestamp from the provider, not system clock
  // This ensures our validation matches what the contract will check
  const provider = getProvider();
  const currentBlock = await provider.getBlock("latest");
  if (!currentBlock) {
    throw new Error("Failed to get current block timestamp from provider.");
  }
  const blockTimestampSeconds = Number(currentBlock.timestamp);

  // Event must be at least 60 seconds in the future (adding 30s buffer for mining time)
  if (!Number.isFinite(eventDate) || eventDateInSeconds <= blockTimestampSeconds + 60) {
    const blockTime = new Date(blockTimestampSeconds * 1000).toISOString();
    const eventTime = new Date(eventDateInSeconds * 1000).toISOString();
    throw new Error(
      `Event date must be at least 60 seconds in the future. Block time: ${blockTime}, Event time: ${eventTime}`
    );
  }

  if (!Number.isFinite(capacity) || capacity <= 0) {
    throw new Error("Event capacity must be greater than 0.");
  }

  console.debug("[createEventOnChain] Event validation passed", {
    eventDateInSeconds,
    blockTimestampSeconds,
    bufferSeconds: eventDateInSeconds - blockTimestampSeconds,
  });

  // Attempt a staticCall to catch validation errors before submitting the transaction
  try {
    console.debug("[createEventOnChain] Performing static call simulation...");
    await (contract as any).createEvent.staticCall(
      name,
      description,
      eventDateInSeconds,
      location,
      capacity,
      parseEther(normalizedBasePrice),
      parseEther(normalizedMaxResalePrice)
    );
    console.debug("[createEventOnChain] Static call succeeded");
  } catch (simError) {
    const simMsg = simError instanceof Error ? simError.message : String(simError);
    console.warn("[createEventOnChain] Static call failed (may still work on-chain):", simMsg);
  }

  console.debug("[createEventOnChain] Submitting transaction with params:", {
    name,
    description,
    eventDateInSeconds,
    location,
    capacity,
    basePrice: normalizedBasePrice,
    maxResalePrice: normalizedMaxResalePrice,
  });

  const tx = await contract.createEvent(
    name,
    description,
    eventDateInSeconds,
    location,
    capacity,
    parseEther(normalizedBasePrice),
    parseEther(normalizedMaxResalePrice)
  );

  console.debug("[createEventOnChain] Transaction submitted, hash:", tx.hash);

  const receipt = await tx.wait();
  console.debug("[createEventOnChain] Transaction receipt received:", {
    status: receipt?.status,
    blockNumber: receipt?.blockNumber,
    logsCount: receipt?.logs?.length,
    hash: receipt?.hash,
    gasUsed: receipt?.gasUsed?.toString(),
  });

  if (!receipt) {
    throw new Error("Transaction receipt not found. Transaction may not have been included in a block.");
  }

  if (receipt.status === 0) {
    throw new Error("Transaction reverted on-chain. The event creation failed. Try again with valid parameters.");
  }

  if (receipt.status !== 1) {
    console.warn("[createEventOnChain] Unexpected receipt status:", receipt.status);
  }

  // Extract eventId from the EventCreated event log
  // EventCreated(uint256 indexed eventId, address indexed organizer, string name, uint256 eventDate, uint256 capacity)
  // For indexed parameters: topics[0] = event signature, topics[1] = eventId (first indexed), topics[2] = organizer (second indexed)
  let contractEventId: number | null = null;
  if (receipt?.logs && receipt.logs.length > 0) {
    console.debug(`[createEventOnChain] Parsing ${receipt.logs.length} logs for EventCreated event`);
    
    for (let i = 0; i < receipt.logs.length; i++) {
      const log = receipt.logs[i];
      
      try {
        // Use interface.parseLog to correctly decode the log
        const parsed = (contract as any).interface.parseLog({
          topics: log.topics as string[],
          data: log.data
        });
        
        console.debug(`[createEventOnChain] Log ${i} parsed - name:`, parsed?.name);
        
        if (parsed && parsed.name === "EventCreated") {
          // The interface.parseLog returns args in order
          // First arg (index 0) is eventId
          if (parsed.args && parsed.args.length > 0) {
            const eventIdRaw = parsed.args[0];
            contractEventId = typeof eventIdRaw === 'bigint' ? Number(eventIdRaw) : Number(eventIdRaw);
            console.debug(`[createEventOnChain] EXTRACTED EventCreated - eventId:`, contractEventId);
            break;
          }
        }
      } catch (parseErr) {
        // This log doesn't match our event, continue
        console.debug(`[createEventOnChain] Log ${i} not EventCreated (parse failed or different event)`);
      }
    }
  } else {
    console.warn("[createEventOnChain] Receipt has no logs!");
  }

  if (contractEventId === null || contractEventId === undefined || contractEventId < 0) {
    console.error("[createEventOnChain] EventCreated log not found or eventId is invalid:", contractEventId);
    throw new Error("Event creation succeeded but EventCreated log eventId could not be extracted. Check that ABI is correct.");
  }

  console.debug("[createEventOnChain] Event creation successful:", { txHash: receipt?.hash, contractEventId });
  
  // VERIFY: Confirm event was actually stored on-chain
  if (contractEventId !== null) {
    try {
      console.debug("[createEventOnChain] VERIFYING event was stored on-chain...");
      const storedEvent = await contract.getFunction("getEvent")(BigInt(contractEventId));
      console.debug("[createEventOnChain] VERIFICATION PASSED - Event found on-chain:", {
        eventId: contractEventId,
        storedName: storedEvent.name,
        storedOrganizer: storedEvent.organizer
      });
    } catch (verifyErr) {
      const msg = verifyErr instanceof Error ? verifyErr.message : String(verifyErr);
      console.error("[createEventOnChain] VERIFICATION FAILED - Event not found after creation:", { 
        eventId: contractEventId, 
        error: msg 
      });
      
      // Diagnostic: Try to get organizer's events to see what's actually stored
      try {
        const signerAddress = await (contract as any).signer.getAddress();
        console.debug("[createEventOnChain] Organizer address:", signerAddress);
        const organizedEvents = await (contract as any).getOrganizedEvents(signerAddress);
        console.debug("[createEventOnChain] DIAGNOSTIC - Organizer's events found on-chain:", {
          count: organizedEvents.length,
          eventIds: organizedEvents.map((id: any) => Number(id.toString()))
        });
        
        if (organizedEvents.length > 0) {
          // Try to get the most recent event
          const mostRecentId = Number(organizedEvents[organizedEvents.length - 1].toString());
          try {
            const recentEvent = await contract.getFunction("getEvent")(BigInt(mostRecentId));
            console.debug("[createEventOnChain] Most recent event on-chain:", {
              eventId: mostRecentId,
              name: recentEvent.name
            });
          } catch (getErr) {
            console.debug("[createEventOnChain] Could not fetch most recent event:", getErr);
          }
        }
      } catch (diagErr) {
        console.debug("[createEventOnChain] Diagnostic query failed:", diagErr);
      }
      
      throw new Error(`Event creation transaction succeeded but event ${contractEventId} was not found on-chain. Check console for diagnostics.`);
    }
  }
  
  return { txHash: receipt?.hash || "", contractEventId };
}

/**
 * Get event details
 */
export async function getEvent(eventId: number) {
  const contract = getContract() as any;
  return await contract.getFunction("getEvent")(BigInt(eventId));
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
  const normalizedPrice = normalizeEthAmount(price, "Ticket price");

  console.debug("[mintTicket] Attempting ticket mint:", { eventId, recipientAddress, price: normalizedPrice });

  let eventExists = false;
  let storedEventData: any = null;
  try {
    storedEventData = await contract.getFunction("getEvent")(BigInt(eventId));
    console.debug("[mintTicket] Event found on-chain:", { eventId, eventName: storedEventData.name });
    eventExists = true;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[mintTicket] Event not found on-chain:", { eventId, error: errMsg });
    
    // Try to provide diagnostic info
    try {
      // Query contract to see if there are any events at all
      console.debug("[mintTicket] Querying organizer events for admin wallet...");
      const adminAddress = (import.meta as any).env.VITE_ADMIN_ADDRESS;
      const adminEvents = await (contract as any).getOrganizedEvents(adminAddress);
      console.debug("[mintTicket] Admin events found on-chain:", { 
        eventIds: adminEvents?.map((e: any) => Number(e.toString())) 
      });
    } catch (queryErr) {
      console.debug("[mintTicket] Could not query admin events:", queryErr);
    }
    
    throw new Error(`On-chain event ${eventId} was not found. Re-register this event on-chain from admin before purchasing.`);
  }

  if (!eventExists) {
    throw new Error(`On-chain event ${eventId} was not found. Re-register this event on-chain from admin before purchasing.`);
  }

  const tx = await contract.mintTicket(eventId, recipientAddress, {
    value: parseEther(normalizedPrice),
  });

  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error("Ticket mint transaction failed on-chain.");
  }

  // Extract tokenId from the TicketMinted event log
  let tokenId: number | null = null;
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

  if (tokenId === null) {
    throw new Error("Mint transaction confirmed but TicketMinted log was not found. Verify contract address and ABI.");
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
  const normalizedResalePrice = normalizeEthAmount(priceInEth, "Resale price");

  const tx = await contract.listForResale(BigInt(tokenId), parseEther(normalizedResalePrice));
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error("List for resale transaction failed on-chain.");
  }
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
  const normalizedPrice = normalizeEthAmount(price, "Resale price");

  const tx = await contract.buyFromResale(BigInt(tokenId), {
    value: parseEther(normalizedPrice),
  });

  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error("Resale purchase transaction failed on-chain.");
  }
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
 * Get platform fee percentage
 */
export async function getPlatformFeePercentage(): Promise<number> {
  const contract = getContract();
  return await contract.platformFeePercentage();
}

/**
 * Get contract balance information
 */
export async function getContractBalance() {
  const contract = getContract();
  const [totalBalance, feesCollected] = await contract.getContractBalance();
  return {
    totalBalance: totalBalance.toString(),
    feesCollected: feesCollected.toString(),
  };
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

