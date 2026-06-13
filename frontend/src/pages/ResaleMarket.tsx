import { useEffect, useState } from 'react';
import { formatEther } from 'ethers';
import { TrendingUp, Zap, Shield, Search, ArrowRight, Filter, ShoppingBag } from 'lucide-react';
import { 
  Button, Card, CardContent, CardDescription, CardHeader, CardTitle,
  Badge, Separator, Input
} from '@/components/ui';
import { Link } from 'react-router-dom';
import { motion } from "framer-motion";

interface ResaleTicket {
  tokenId: number;
  eventId: number;
  seller: string;
  price: bigint;
  active: boolean;
  event_name?: string;
  image_url?: string;
}

export const ResaleMarketPage = () => {
  const [resaleTickets, setResaleTickets] = useState<ResaleTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'price-asc' | 'price-desc' | 'newest'>('newest');

  useEffect(() => {
    const fetchResaleTickets = async () => {
      try {
        setIsLoading(true);
        // This remains a placeholder for real integration
        setResaleTickets([]);
      } catch (error) {
        console.error('Failed to fetch resale tickets:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResaleTickets();
  }, []);

  const sortedTickets = [...resaleTickets].sort((a, b) => {
    switch (sortBy) {
      case 'price-asc':
        return Number(a.price - b.price);
      case 'price-desc':
        return Number(b.price - a.price);
      case 'newest':
      default:
        return b.tokenId - a.tokenId;
    }
  });

  return (
    <div className="min-h-screen bg-[#F5F7F8] py-12 px-6 font-body text-foreground">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingBag className="h-6 w-6 text-[#1BA6A6]" />
              <span className="text-sm font-bold text-[#1BA6A6] uppercase tracking-[0.2em]">Verified Secondary Market</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-[#1F2933] mb-4 tracking-tight">
              Secure Resale Protocol
            </h1>
            <p className="text-lg text-[#6B7280] font-medium leading-relaxed">
              Acquire verified tickets from authorized fans at fair prices. All resales are protected by 
              <span className="text-[#1BA6A6] font-bold mx-1">TicketShield's</span> anti-scalping smart controls.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-2 flex gap-1 shadow-sm">
              {(['newest', 'price-asc', 'price-desc'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setSortBy(option)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    sortBy === option 
                      ? 'bg-[#1BA6A6] text-white shadow-md' 
                      : 'text-[#6B7280] hover:bg-[#F5F7F8]'
                  }`}
                >
                  {option === 'newest' && 'Newest'}
                  {option === 'price-asc' && 'Price: Low'}
                  {option === 'price-desc' && 'Price: High'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {[
            { 
              label: "Active Listings", 
              value: resaleTickets.length.toString(), 
              desc: "Verified tickets available", 
              icon: Zap, 
              color: "text-amber-500",
              bgColor: "bg-amber-50"
            },
            { 
              label: "Average Price", 
              value: resaleTickets.length > 0
                ? `${formatEther(resaleTickets.reduce((a, b) => a + b.price, BigInt(0)) / BigInt(resaleTickets.length))} ETH`
                : "0.000 ETH", 
              desc: "Current market average", 
              icon: TrendingUp, 
              color: "text-emerald-500",
              bgColor: "bg-emerald-50"
            },
            { 
              label: "Scalping Protection", 
              value: "100%", 
              desc: "Price cap enforcement", 
              icon: Shield, 
              color: "text-blue-500",
              bgColor: "bg-blue-50"
            }
          ].map((stat) => (
            <Card key={stat.label} className="bg-white border-[#E5E7EB] shadow-sm hover:shadow-md transition-shadow rounded-2xl overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">{stat.label}</p>
                    <p className="text-3xl font-extrabold text-[#1F2933]">{stat.value}</p>
                    <p className="text-xs text-[#6B7280] mt-2 font-medium">{stat.desc}</p>
                  </div>
                  <div className={`${stat.bgColor} p-3 rounded-xl`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator className="mb-12 bg-[#E5E7EB]" />

        {/* Main Content Area */}
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse bg-white border border-[#E5E7EB] rounded-3xl p-6 h-[400px]">
                <div className="h-48 bg-[#F5F7F8] rounded-2xl mb-6" />
                <div className="h-6 bg-[#F5F7F8] rounded w-3/4 mb-4" />
                <div className="h-4 bg-[#F5F7F8] rounded w-1/2 mb-8" />
                <div className="h-12 bg-[#F5F7F8] rounded-xl" />
              </div>
            ))}
          </div>
        ) : resaleTickets.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 bg-white border border-[#E5E7EB] rounded-3xl shadow-sm px-6 text-center"
          >
            <div className="bg-[#F5F7F8] p-8 rounded-full mb-8">
              <Search className="h-16 w-16 text-[#9CA3AF]/40" />
            </div>
            <h3 className="text-2xl font-bold text-[#1F2933] mb-3">No Listings Detected</h3>
            <p className="text-[#6B7280] mb-8 max-w-md font-medium">
              The secondary market protocol is currently clear. Authorized tickets may appear as fans list them for exchange.
            </p>
            <Button asChild className="bg-[#1BA6A6] text-white hover:opacity-90 px-8 h-12 rounded-xl font-bold transition-all shadow-lg shadow-[#1BA6A6]/20">
              <Link to="/events">Browse Primary Events</Link>
            </Button>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {sortedTickets.map((ticket) => (
              <motion.div 
                key={ticket.tokenId}
                whileHover={{ y: -5 }}
                className="group"
              >
                <Card className="bg-white border-[#E5E7EB] rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300">
                  <div className="relative h-48 overflow-hidden">
                    <img 
                      src={ticket.image_url || "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800&q=80"} 
                      alt="Event"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute top-4 right-4">
                      <Badge className="bg-emerald-500 text-white border-none font-bold px-3 py-1">Verified Resale</Badge>
                    </div>
                    <div className="absolute bottom-4 left-4">
                      <p className="text-white font-bold text-lg">Ticket #{ticket.tokenId}</p>
                    </div>
                  </div>
                  
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl font-bold text-[#1F2933] truncate">
                      {ticket.event_name || `Event ID: ${ticket.eventId}`}
                    </CardTitle>
                    <CardDescription className="text-[#6B7280] font-mono text-xs truncate">
                      Asset: {ticket.seller.slice(0, 10)}...{ticket.seller.slice(-6)}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-6">
                    <div className="bg-[#F5F7F8] rounded-2xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">Asking Price</p>
                        <p className="text-2xl font-black text-[#1F2933]">
                          {formatEther(ticket.price)} <span className="text-sm font-bold text-[#6B7280]">ETH</span>
                        </p>
                      </div>
                      <div className="bg-white border border-[#E5E7EB] rounded-xl px-3 py-2 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                        <span className="text-xs font-bold text-[#1F2933]">Fair Price</span>
                      </div>
                    </div>

                    <Button className="w-full bg-[#1BA6A6] text-white hover:opacity-90 h-12 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#1BA6A6]/10" asChild>
                      <Link to={`/resale/${ticket.tokenId}`}>
                        View Details <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResaleMarketPage;

