import { useState, useCallback } from 'react';
import { useContract } from './useContract';
import { useToast } from './use-toast';

const contractAddress = (import.meta.env as Record<string, string>).VITE_CONTRACT_ADDRESS || '';

interface ResaleOffer {
  tokenId: number;
  seller: string;
  price: bigint;
  active: boolean;
}

export const useResale = () => {
  const { listForResale, cancelResale, buyFromResale, getResaleOffer } = useContract({
    contractAddress,
    autoInitialize: true,
  });
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  /**
   * List a ticket for resale
   */
  const handleListForResale = useCallback(
    async (tokenId: number, priceInWei: bigint) => {
      setIsLoading(true);
      try {
        const result = await listForResale(tokenId, priceInWei.toString());

        toast({
          title: 'Success',
          description: 'Ticket listed for resale',
        });

        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to list ticket';
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        });
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [listForResale, toast]
  );

  /**
   * Cancel a resale listing
   */
  const handleCancelResale = useCallback(
    async (tokenId: number) => {
      setIsLoading(true);
      try {
        const result = await cancelResale(tokenId);

        toast({
          title: 'Success',
          description: 'Resale listing cancelled',
        });

        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to cancel resale';
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        });
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [cancelResale, toast]
  );

  /**
   * Buy a ticket from resale
   */
  const handleBuyFromResale = useCallback(
    async (tokenId: number, priceInWei: bigint) => {
      setIsLoading(true);
      try {
        const result = await buyFromResale(tokenId, priceInWei.toString());

        toast({
          title: 'Success',
          description: 'Ticket purchased from resale',
        });

        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to purchase ticket';
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        });
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [buyFromResale, toast]
  );

  /**
   * Get resale offer details
   */
  const handleGetResaleOffer = useCallback(
    async (tokenId: number): Promise<ResaleOffer | null> => {
      try {
        const offer = await getResaleOffer(tokenId);
        if (!offer) return null;
        return {
          tokenId: Number(offer.tokenId),
          seller: offer.seller,
          price: offer.price,
          active: offer.active,
        };
      } catch (error) {
        console.error('Failed to fetch resale offer:', error);
        return null;
      }
    },
    [getResaleOffer]
  );

  return {
    listForResale: handleListForResale,
    cancelResale: handleCancelResale,
    buyFromResale: handleBuyFromResale,
    getResaleOffer: handleGetResaleOffer,
    isLoading,
  };
};
