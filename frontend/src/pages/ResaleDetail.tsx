import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatEther, parseEther } from 'ethers';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { AlertCircle, ArrowLeft, Shield, CheckCircle } from 'lucide-react';
import { useResale } from '@/hooks/useResale';
import { useWallet } from '@/contexts/WalletContext';

export const ResaleDetailPage = () => {
  const { tokenId } = useParams();
  const navigate = useNavigate();
  const { buyFromResale, isLoading } = useResale();
  const { isConnected } = useWallet();
  const [isConfirming, setIsConfirming] = useState(false);

  // Mock ticket data - in production, fetch from contract
  const ticket = {
    tokenId: parseInt(tokenId || '0'),
    eventId: 1,
    eventName: 'Summer Music Festival 2026',
    seller: '0x742d35Cc6634C0532925a3b844Bc5e8d1f42a5FE',
    originalOwner: '0xFF5B3E3E3E3E3E3E3E3E3E3E3E3E3E3E3E3E3E3E',
    askingPrice: parseEther('0.85'),
    basePrice: parseEther('0.50'),
    maxResalePrice: parseEther('1.00'),
    location: 'Central Park, New York',
    date: new Date('2026-06-15').toLocaleDateString(),
    checkedIn: false,
  };

  const askingPriceEth = formatEther(ticket.askingPrice);
  const basePriceEth = formatEther(ticket.basePrice);
  const maxPriceEth = formatEther(ticket.maxResalePrice);
  const platformFee = (parseFloat(askingPriceEth) * 0.05).toFixed(4);
  const sellerReceives = (parseFloat(askingPriceEth) - parseFloat(platformFee)).toFixed(4);
  const markupPercentage = (
    ((parseFloat(askingPriceEth) - parseFloat(basePriceEth)) / parseFloat(basePriceEth)) *
    100
  ).toFixed(1);

  const handleBuyTicket = async () => {
    if (!isConnected) {
      alert('Please connect your wallet');
      navigate('/login');
      return;
    }

    setIsConfirming(true);
    try {
      await buyFromResale(ticket.tokenId, ticket.askingPrice);
      navigate(`/my-tickets?purchased=${ticket.tokenId}`);
    } catch (error) {
      console.error('Purchase failed:', error);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 py-8">
      <div className="container mx-auto px-6 max-w-2xl">
        {/* Back Button */}
        <button
          onClick={() => navigate('/resale')}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Market
        </button>

        {/* Main Card */}
        <Card className="glass border-white/10 mb-8">
          <CardHeader className="border-b border-white/10">
            <div>
              <CardTitle className="text-2xl mb-2">Ticket #{ticket.tokenId}</CardTitle>
              <CardDescription>{ticket.eventName}</CardDescription>
            </div>
          </CardHeader>

          <CardContent className="pt-8 space-y-8">
            {/* Event Details */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Event Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-400 mb-1">Location</p>
                  <p className="font-medium">{ticket.location}</p>
                </div>
                <div>
                  <p className="text-slate-400 mb-1">Date</p>
                  <p className="font-medium">{ticket.date}</p>
                </div>
              </div>
            </div>

            {/* Seller Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Seller Information</h3>
              <div className="bg-slate-700/30 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-400">Seller Address</p>
                  <p className="text-sm font-mono">
                    {ticket.seller.slice(0, 6)}...{ticket.seller.slice(-4)}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-400">Original Owner</p>
                  <p className="text-sm font-mono">
                    {ticket.originalOwner.slice(0, 6)}...{ticket.originalOwner.slice(-4)}
                  </p>
                </div>
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Price Details</h3>
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-6 space-y-3 border border-primary/20">
                <div className="flex justify-between items-center">
                  <p className="text-slate-300">Base Price</p>
                  <p className="font-semibold">{basePriceEth} ETH</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-slate-300">Resale Markup</p>
                  <p className="font-semibold text-green-400">{markupPercentage}%</p>
                </div>
                <div className="border-t border-primary/20 pt-3 flex justify-between items-center">
                  <p className="text-lg font-bold">Asking Price</p>
                  <p className="text-2xl font-bold text-primary">{askingPriceEth} ETH</p>
                </div>
              </div>

              {/* Max Price Check */}
              {parseFloat(askingPriceEth) > parseFloat(maxPriceEth) && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-400">Price Exceeds Limit</p>
                    <p className="text-sm text-red-400/80">
                      This price exceeds the organizer's max resale limit of {maxPriceEth} ETH
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Fee Breakdown */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Transaction Breakdown</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">You Pay</span>
                  <span className="font-medium">{askingPriceEth} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">TicketShield Fee (5%)</span>
                  <span className="font-medium text-slate-300">{platformFee} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Seller Receives</span>
                  <span className="font-medium text-slate-300">{sellerReceives} ETH</span>
                </div>
              </div>
            </div>

            {/* Security Info */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 flex gap-3">
              <Shield className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-400 mb-1">Verified Transaction</p>
                <p className="text-sm text-blue-400/80">
                  All resale transactions are protected by TicketShield's anti-scalping controls
                  and verified on the Ethereum blockchain.
                </p>
              </div>
            </div>

            {/* Ticket Status */}
            {!ticket.checkedIn && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex gap-3">
                <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-400">Valid for Entry</p>
                  <p className="text-sm text-green-400/80">This ticket has not been used yet.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate('/resale')} className="flex-1">
            Browse More
          </Button>
          <Button
            onClick={handleBuyTicket}
            disabled={isLoading || isConfirming || parseFloat(askingPriceEth) > parseFloat(maxPriceEth)}
            className="flex-1"
            size="lg"
          >
            {isLoading || isConfirming ? 'Processing...' : `Buy for ${askingPriceEth} ETH`}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ResaleDetailPage;
