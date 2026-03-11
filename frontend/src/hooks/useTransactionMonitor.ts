import { useState, useEffect, useCallback, useRef } from "react";
import { Contract, BrowserProvider, formatEther } from "ethers";
import EventTicketABI from "@/integrations/contracts/EventTicket.abi.json";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TxEventType =
  | "TicketMinted"
  | "TicketCheckedIn"
  | "ResaleOffered"
  | "ResaleCompleted"
  | "ResaleOfferCancelled"
  | "EventCreated";

export interface MonitoredTransaction {
  id: string; // unique key: txHash + logIndex
  txHash: string;
  blockNumber: number;
  timestamp: number; // unix ms
  type: TxEventType;
  // Parsed human-readable fields
  summary: string;
  detail: string;
  // Raw values
  tokenId?: string;
  eventId?: string;
  from?: string;
  to?: string;
  priceEth?: string;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

const MAX_TX = 50; // keep at most 50 in memory

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function useTransactionMonitor(contractAddress: string | undefined) {
  const [transactions, setTransactions] = useState<MonitoredTransaction[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contractRef = useRef<Contract | null>(null);

  const addTx = useCallback((tx: MonitoredTransaction) => {
    setTransactions((prev) => {
      // Deduplicate by id
      if (prev.some((t) => t.id === tx.id)) return prev;
      return [tx, ...prev].slice(0, MAX_TX);
    });
  }, []);

  const clearTransactions = useCallback(() => setTransactions([]), []);

  useEffect(() => {
    if (!contractAddress || !(window as Window & typeof globalThis & { ethereum?: unknown }).ethereum) {
      return;
    }

    let active = true;
    let localContract: Contract | null = null;

    const setup = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const provider = new BrowserProvider((window as any).ethereum);

        localContract = new Contract(contractAddress, EventTicketABI, provider);
        contractRef.current = localContract;

        // ── TicketMinted ────────────────────────────────────────────
        const onTicketMinted = async (
          tokenId: bigint,
          eventId: bigint,
          to: string,
          price: bigint,
          evt: { log: { transactionHash: string; blockNumber: number; index: number } },
        ) => {
          if (!active) return;
          let blockTs = Date.now();
          try {
            const block = await provider.getBlock(evt.log.blockNumber);
            if (block) blockTs = Number(block.timestamp) * 1000;
          } catch { /* use Date.now() */ }

          addTx({
            id: `${evt.log.transactionHash}-${evt.log.index}`,
            txHash: evt.log.transactionHash,
            blockNumber: evt.log.blockNumber,
            timestamp: blockTs,
            type: "TicketMinted",
            summary: "Ticket Minted",
            detail: `Token #${tokenId} for Event #${eventId} → ${shortAddr(to)} · ${formatEther(price)} ETH`,
            tokenId: tokenId.toString(),
            eventId: eventId.toString(),
            to,
            priceEth: formatEther(price),
          });
        };

        // ── TicketCheckedIn ─────────────────────────────────────────
        const onCheckedIn = async (
          tokenId: bigint,
          eventId: bigint,
          attendee: string,
          evt: { log: { transactionHash: string; blockNumber: number; index: number } },
        ) => {
          if (!active) return;
          let blockTs = Date.now();
          try {
            const block = await provider.getBlock(evt.log.blockNumber);
            if (block) blockTs = Number(block.timestamp) * 1000;
          } catch { /* use Date.now() */ }

          addTx({
            id: `${evt.log.transactionHash}-${evt.log.index}`,
            txHash: evt.log.transactionHash,
            blockNumber: evt.log.blockNumber,
            timestamp: blockTs,
            type: "TicketCheckedIn",
            summary: "Ticket Checked In",
            detail: `Token #${tokenId} at Event #${eventId} by ${shortAddr(attendee)}`,
            tokenId: tokenId.toString(),
            eventId: eventId.toString(),
            to: attendee,
          });
        };

        // ── ResaleOffered ───────────────────────────────────────────
        const onResaleOffered = async (
          tokenId: bigint,
          seller: string,
          price: bigint,
          evt: { log: { transactionHash: string; blockNumber: number; index: number } },
        ) => {
          if (!active) return;
          let blockTs = Date.now();
          try {
            const block = await provider.getBlock(evt.log.blockNumber);
            if (block) blockTs = Number(block.timestamp) * 1000;
          } catch { /* use Date.now() */ }

          addTx({
            id: `${evt.log.transactionHash}-${evt.log.index}`,
            txHash: evt.log.transactionHash,
            blockNumber: evt.log.blockNumber,
            timestamp: blockTs,
            type: "ResaleOffered",
            summary: "Listed for Resale",
            detail: `Token #${tokenId} by ${shortAddr(seller)} at ${formatEther(price)} ETH`,
            tokenId: tokenId.toString(),
            from: seller,
            priceEth: formatEther(price),
          });
        };

        // ── ResaleCompleted ─────────────────────────────────────────
        const onResaleCompleted = async (
          tokenId: bigint,
          from: string,
          to: string,
          price: bigint,
          evt: { log: { transactionHash: string; blockNumber: number; index: number } },
        ) => {
          if (!active) return;
          let blockTs = Date.now();
          try {
            const block = await provider.getBlock(evt.log.blockNumber);
            if (block) blockTs = Number(block.timestamp) * 1000;
          } catch { /* use Date.now() */ }

          addTx({
            id: `${evt.log.transactionHash}-${evt.log.index}`,
            txHash: evt.log.transactionHash,
            blockNumber: evt.log.blockNumber,
            timestamp: blockTs,
            type: "ResaleCompleted",
            summary: "Resale Completed",
            detail: `Token #${tokenId}: ${shortAddr(from)} → ${shortAddr(to)} · ${formatEther(price)} ETH`,
            tokenId: tokenId.toString(),
            from,
            to,
            priceEth: formatEther(price),
          });
        };

        // ── ResaleOfferCancelled ────────────────────────────────────
        const onResaleCancelled = async (
          tokenId: bigint,
          evt: { log: { transactionHash: string; blockNumber: number; index: number } },
        ) => {
          if (!active) return;
          let blockTs = Date.now();
          try {
            const block = await provider.getBlock(evt.log.blockNumber);
            if (block) blockTs = Number(block.timestamp) * 1000;
          } catch { /* use Date.now() */ }

          addTx({
            id: `${evt.log.transactionHash}-${evt.log.index}`,
            txHash: evt.log.transactionHash,
            blockNumber: evt.log.blockNumber,
            timestamp: blockTs,
            type: "ResaleOfferCancelled",
            summary: "Resale Cancelled",
            detail: `Token #${tokenId} delisted`,
            tokenId: tokenId.toString(),
          });
        };

        // ── EventCreated ────────────────────────────────────────────
        const onEventCreated = async (
          eventId: bigint,
          organizer: string,
          name: string,
          _eventDate: bigint,
          _capacity: bigint,
          evt: { log: { transactionHash: string; blockNumber: number; index: number } },
        ) => {
          if (!active) return;
          let blockTs = Date.now();
          try {
            const block = await provider.getBlock(evt.log.blockNumber);
            if (block) blockTs = Number(block.timestamp) * 1000;
          } catch { /* use Date.now() */ }

          addTx({
            id: `${evt.log.transactionHash}-${evt.log.index}`,
            txHash: evt.log.transactionHash,
            blockNumber: evt.log.blockNumber,
            timestamp: blockTs,
            type: "EventCreated",
            summary: "Event Created",
            detail: `"${name}" (ID #${eventId}) by ${shortAddr(organizer)}`,
            eventId: eventId.toString(),
            from: organizer,
          });
        };

        // Register listeners
        localContract.on("TicketMinted", onTicketMinted);
        localContract.on("TicketCheckedIn", onCheckedIn);
        localContract.on("ResaleOffered", onResaleOffered);
        localContract.on("ResaleCompleted", onResaleCompleted);
        localContract.on("ResaleOfferCancelled", onResaleCancelled);
        localContract.on("EventCreated", onEventCreated);

        if (active) {
          setIsListening(true);
          setError(null);
        }
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to connect to contract");
          setIsListening(false);
        }
      }
    };

    setup();

    return () => {
      active = false;
      if (localContract) {
        localContract.removeAllListeners();
      }
      setIsListening(false);
    };
  }, [contractAddress, addTx]);

  return { transactions, isListening, error, clearTransactions };
}
