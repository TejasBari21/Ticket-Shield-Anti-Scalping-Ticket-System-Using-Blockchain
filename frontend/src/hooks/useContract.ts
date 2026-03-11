import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import {
  initializeContract,
  createEvent,
  mintTicket,
  getEvent,
  getTicket,
  checkInTicket,
  listForResale,
  cancelResale,
  buyFromResale,
  getResaleOffer,
  getOrganizedEvents,
  getUserTickets,
  getEventTickets,
  getPlatformFeePercentage,
  getContractBalance,
  getNetworkChainId,
  formatFromWei,
} from "@/integrations/contracts/contractService";
import type { Event, Ticket, ResaleOffer } from "@/integrations/contracts/types";

interface UseContractOptions {
  contractAddress: string;
  autoInitialize?: boolean;
}

interface ContractState {
  initialized: boolean;
  loading: boolean;
  error: string | null;
  chainId: number | null;
  platformFeePercentage: number | null;
}

export function useContract(options: UseContractOptions) {
  const { contractAddress, autoInitialize = true } = options;
  const { address } = useWallet();
  const { toast } = useToast();
  const [state, setState] = useState<ContractState>({
    initialized: false,
    loading: false,
    error: null,
    chainId: null,
    platformFeePercentage: null,
  });

  // Initialize contract on mount
  useEffect(() => {
    if (!autoInitialize || !contractAddress) return;

    const init = async () => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        await initializeContract(contractAddress);
        const chainId = await getNetworkChainId();
        const feePercentage = await getPlatformFeePercentage();

        setState((prev) => ({
          ...prev,
          initialized: true,
          chainId: Number(chainId),
          platformFeePercentage: Number(feePercentage),
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to initialize contract";
        setState((prev) => ({
          ...prev,
          error: errorMessage,
        }));
        toast({
          title: "Contract Initialization Failed",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setState((prev) => ({ ...prev, loading: false }));
      }
    };

    init();
  }, [contractAddress, autoInitialize, toast]);

  // Event Management
  const handleCreateEvent = useCallback(
    async (
      name: string,
      description: string,
      eventDate: number,
      location: string,
      capacity: number,
      basePrice: string
    ) => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        const { txHash, contractEventId } = await createEvent(name, description, eventDate, location, capacity, basePrice);
        toast({
          title: "Event Created",
          description: `Transaction: ${txHash.slice(0, 10)}...`,
        });
        return { txHash, contractEventId };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to create event";
        setState((prev) => ({ ...prev, error: errorMessage }));
        toast({
          title: "Error Creating Event",
          description: errorMessage,
          variant: "destructive",
        });
        throw error;
      } finally {
        setState((prev) => ({ ...prev, loading: false }));
      }
    },
    [toast]
  );

  const handleGetEvent = useCallback(async (eventId: number): Promise<Event | null> => {
    try {
      const result = await getEvent(eventId);
      return result as any as Event;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch event";
      setState((prev) => ({ ...prev, error: errorMessage }));
      return null;
    }
  }, []);

  // Ticket Operations
  const handleMintTicket = useCallback(
    async (eventId: number, recipientAddress: string, price: string) => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        const { txHash } = await mintTicket(eventId, recipientAddress, price);
        toast({
          title: "Ticket Minted",
          description: `Transaction: ${txHash.slice(0, 10)}...`,
        });
        return txHash;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to mint ticket";
        setState((prev) => ({ ...prev, error: errorMessage }));
        toast({
          title: "Error Minting Ticket",
          description: errorMessage,
          variant: "destructive",
        });
        throw error;
      } finally {
        setState((prev) => ({ ...prev, loading: false }));
      }
    },
    [toast]
  );

  const handleGetTicket = useCallback(async (tokenId: number): Promise<Ticket | null> => {
    try {
      return await getTicket(tokenId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch ticket";
      setState((prev) => ({ ...prev, error: errorMessage }));
      return null;
    }
  }, []);

  const handleCheckIn = useCallback(
    async (tokenId: number, ipfsHash?: string) => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        const txHash = await checkInTicket(tokenId, ipfsHash);
        toast({
          title: "Checked In",
          description: `Transaction: ${txHash.slice(0, 10)}...`,
        });
        return txHash;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to check in ticket";
        setState((prev) => ({ ...prev, error: errorMessage }));
        toast({
          title: "Error Checking In",
          description: errorMessage,
          variant: "destructive",
        });
        throw error;
      } finally {
        setState((prev) => ({ ...prev, loading: false }));
      }
    },
    [toast]
  );

  // Resale Operations
  const handleListForResale = useCallback(
    async (tokenId: number, priceInEth: string) => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        const txHash = await listForResale(tokenId, priceInEth);
        toast({
          title: "Listed for Resale",
          description: `Transaction: ${txHash.slice(0, 10)}...`,
        });
        return txHash;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to list for resale";
        setState((prev) => ({ ...prev, error: errorMessage }));
        toast({
          title: "Error Listing for Resale",
          description: errorMessage,
          variant: "destructive",
        });
        throw error;
      } finally {
        setState((prev) => ({ ...prev, loading: false }));
      }
    },
    [toast]
  );

  const handleCancelResale = useCallback(
    async (tokenId: number) => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        const txHash = await cancelResale(tokenId);
        toast({
          title: "Resale Cancelled",
          description: `Transaction: ${txHash.slice(0, 10)}...`,
        });
        return txHash;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to cancel resale";
        setState((prev) => ({ ...prev, error: errorMessage }));
        toast({
          title: "Error Cancelling Resale",
          description: errorMessage,
          variant: "destructive",
        });
        throw error;
      } finally {
        setState((prev) => ({ ...prev, loading: false }));
      }
    },
    [toast]
  );

  const handleBuyFromResale = useCallback(
    async (tokenId: number, price: string) => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        const txHash = await buyFromResale(tokenId, price);
        toast({
          title: "Ticket Purchased",
          description: `Transaction: ${txHash.slice(0, 10)}...`,
        });
        return txHash;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to purchase ticket";
        setState((prev) => ({ ...prev, error: errorMessage }));
        toast({
          title: "Error Purchasing Ticket",
          description: errorMessage,
          variant: "destructive",
        });
        throw error;
      } finally {
        setState((prev) => ({ ...prev, loading: false }));
      }
    },
    [toast]
  );

  const handleGetResaleOffer = useCallback(
    async (tokenId: number): Promise<ResaleOffer | null> => {
      try {
        return await getResaleOffer(tokenId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch resale offer";
        setState((prev) => ({ ...prev, error: errorMessage }));
        return null;
      }
    },
    []
  );

  // Query Functions
  const handleGetUserTickets = useCallback(
    async (ownerAddress: string): Promise<number[]> => {
      try {
        return await getUserTickets(ownerAddress);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch user tickets";
        setState((prev) => ({ ...prev, error: errorMessage }));
        return [];
      }
    },
    []
  );

  const handleGetOrganizedEvents = useCallback(
    async (organizerAddress: string): Promise<number[]> => {
      try {
        return await getOrganizedEvents(organizerAddress);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch organized events";
        setState((prev) => ({ ...prev, error: errorMessage }));
        return [];
      }
    },
    []
  );

  const handleGetEventTickets = useCallback(
    async (eventId: number): Promise<number[]> => {
      try {
        return await getEventTickets(eventId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch event tickets";
        setState((prev) => ({ ...prev, error: errorMessage }));
        return [];
      }
    },
    []
  );

  return {
    // State
    ...state,
    // Event Management
    createEvent: handleCreateEvent,
    getEvent: handleGetEvent,
    // Ticket Operations
    mintTicket: handleMintTicket,
    getTicket: handleGetTicket,
    checkInTicket: handleCheckIn,
    // Resale Market
    listForResale: handleListForResale,
    cancelResale: handleCancelResale,
    buyFromResale: handleBuyFromResale,
    getResaleOffer: handleGetResaleOffer,
    // Queries
    getUserTickets: handleGetUserTickets,
    getOrganizedEvents: handleGetOrganizedEvents,
    getEventTickets: handleGetEventTickets,
    // Utilities
    formatFromWei,
  };
}
