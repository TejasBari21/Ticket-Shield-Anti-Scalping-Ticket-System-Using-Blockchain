import { useState } from 'react';
import { parseEther, formatEther } from 'ethers';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
} from '@/components/ui';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useResale } from '@/hooks/useResale';

interface ListForResaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  ticketId: number;
  basePrice: string;
  maxResalePrice?: string;
}

export const ListForResaleModal = ({
  isOpen,
  onClose,
  onSuccess,
  ticketId,
  basePrice,
  maxResalePrice,
}: ListForResaleModalProps) => {
  const [resalePrice, setResalePrice] = useState('');
  const { listForResale, isLoading } = useResale();

  const basePriceNum = parseFloat(basePrice);
  const maxPriceNum = maxResalePrice ? parseFloat(maxResalePrice) : null;
  const resalePriceNum = resalePrice ? parseFloat(resalePrice) : 0;

  const isValidPrice =
    resalePriceNum > 0 &&
    resalePriceNum >= basePriceNum &&
    (!maxPriceNum || resalePriceNum <= maxPriceNum);

  const handleListForResale = async () => {
    if (!resalePrice || !isValidPrice) return;

    try {
      const priceInWei = parseEther(resalePrice);
      await listForResale(ticketId, priceInWei);
      setResalePrice('');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to list ticket:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>List Ticket for Resale</DialogTitle>
          <DialogDescription>
            Set your asking price for this ticket on the secondary market
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-6">
          {/* Base Price Info */}
          <div className="glass rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-2">Base Price</p>
            <p className="text-xl font-semibold">{basePrice} ETH</p>
          </div>

          {/* Max Resale Price Warning */}
          {maxResalePrice && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-600">Resale Price Cap</p>
                <p className="text-sm text-amber-600/80">
                  Organizer has set maximum resale price at {maxResalePrice} ETH
                </p>
              </div>
            </div>
          )}

          {/* Price Input */}
          <div className="space-y-2">
            <Label htmlFor="resale-price" className="text-base font-semibold">
              Resale Price (ETH)
            </Label>
            <div className="relative">
              <Input
                id="resale-price"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={resalePrice}
                onChange={(e) => setResalePrice(e.target.value)}
                className="text-lg h-12"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                ETH
              </span>
            </div>

            {/* Price Validation Messages */}
            {resalePrice && (
              <div className="space-y-2 text-sm">
                {resalePriceNum < basePriceNum && (
                  <p className="text-red-500">
                    Price must be at least {basePrice} ETH (base price)
                  </p>
                )}
                {maxPriceNum && resalePriceNum > maxPriceNum && (
                  <p className="text-red-500">
                    Price cannot exceed {maxResalePrice} ETH (organizer limit)
                  </p>
                )}
                {isValidPrice && (
                  <p className="text-green-500">
                    ✓ Price is valid
                    {maxPriceNum && ` (${((resalePriceNum / maxPriceNum) * 100).toFixed(1)}% of max)`}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Platform Fee Info */}
          <div className="bg-slate-500/5 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Resale Price</span>
              <span className="font-medium">{resalePrice || '0'} ETH</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Platform Fee (5%)</span>
              <span className="font-medium">
                {resalePriceNum > 0 ? (resalePriceNum * 0.05).toFixed(4) : '0'} ETH
              </span>
            </div>
            <div className="border-t border-slate-200/10 pt-2 flex justify-between">
              <span className="font-semibold">You'll Receive</span>
              <span className="font-semibold text-primary">
                {resalePriceNum > 0 ? (resalePriceNum * 0.95).toFixed(4) : '0'} ETH
              </span>
            </div>
          </div>

          {/* Terms */}
          <p className="text-xs text-muted-foreground text-center">
            By listing this ticket, you agree to the TicketShield Resale Terms and Conditions.
            The ticket will be transferred to the buyer upon payment.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleListForResale}
            disabled={!isValidPrice || isLoading}
            className="flex-1"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isLoading ? 'Listing...' : 'List for Resale'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
