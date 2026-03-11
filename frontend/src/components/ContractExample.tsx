import React, { useState, useEffect } from "react";
import { useContract } from "@/hooks/useContract";
import { useWallet } from "@/contexts/WalletContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Input, Label } from "@/components/ui";
import { useToast } from "@/hooks/use-toast";

/**
 * Example Component: Using the useContract Hook
 * 
 * This component demonstrates how to use the useContract hook
 * for interacting with the EventTicket smart contract.
 */

export default function ContractExample() {
  const { address } = useWallet();
  const { toast } = useToast();
  const contractAddress = (import.meta as any).env.VITE_CONTRACT_ADDRESS;

  // Initialize contract hook
  const contract = useContract({
    contractAddress: contractAddress || "0x",
    autoInitialize: true,
  });

  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [userTickets, setUserTickets] = useState<number[]>([]);
  const [organizedEvents, setOrganizedEvents] = useState<number[]>([]);

  // Load user's tickets and events
  useEffect(() => {
    if (contract.initialized && address) {
      loadUserData();
    }
  }, [contract.initialized, address]);

  const loadUserData = async () => {
    try {
      const tickets = await contract.getUserTickets(address!);
      const events = await contract.getOrganizedEvents(address!);
      setUserTickets(tickets);
      setOrganizedEvents(events);
    } catch (error) {
      console.error("Failed to load user data:", error);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!eventName || !eventDate || !basePrice) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const timestamp = Math.floor(new Date(eventDate).getTime() / 1000);
      await contract.createEvent(
        eventName,
        "Event Description", // You can add more fields
        timestamp,
        "Event Location", // You can add more fields
        100, // capacity
        basePrice
      );

      setEventName("");
      setEventDate("");
      setBasePrice("");
      await loadUserData();
    } catch (error) {
      console.error("Failed to create event:", error);
    }
  };

  if (!contract.initialized) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Contract...</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Initializing smart contract...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Contract Status */}
      <Card>
        <CardHeader>
          <CardTitle>Contract Status</CardTitle>
          <CardDescription>Smart Contract Integration Status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <p className="text-green-600 font-semibold">✓ Connected</p>
            </div>
            <div>
              <Label>Chain ID</Label>
              <p className="font-mono">{contract.chainId}</p>
            </div>
            <div>
              <Label>Platform Fee</Label>
              <p className="font-mono">{contract.platformFeePercentage}%</p>
            </div>
            <div>
              <Label>Your Address</Label>
              <p className="font-mono text-xs">{address?.slice(0, 10)}...</p>
            </div>
          </div>
          {contract.error && (
            <div className="bg-red-50 border border-red-200 rounded p-2 text-red-700 text-sm">
              {contract.error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Event Form */}
      <Card>
        <CardHeader>
          <CardTitle>Create New Event</CardTitle>
          <CardDescription>Create an event and mint tickets</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateEvent} className="space-y-4">
            <div>
              <Label htmlFor="eventName">Event Name</Label>
              <Input
                id="eventName"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Enter event name"
              />
            </div>
            <div>
              <Label htmlFor="eventDate">Event Date</Label>
              <Input
                id="eventDate"
                type="datetime-local"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="basePrice">Base Price (ETH)</Label>
              <Input
                id="basePrice"
                type="number"
                step="0.01"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                placeholder="0.5"
              />
            </div>
            <Button type="submit" disabled={contract.loading}>
              {contract.loading ? "Creating..." : "Create Event"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* User's Tickets */}
      <Card>
        <CardHeader>
          <CardTitle>Your Tickets</CardTitle>
          <CardDescription>{userTickets.length} ticket(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {userTickets.length === 0 ? (
            <p className="text-gray-500">No tickets yet</p>
          ) : (
            <div className="space-y-2">
              {userTickets.map((tokenId) => (
                <div
                  key={tokenId}
                  className="border rounded p-3 flex justify-between items-center"
                >
                  <span className="font-mono">Ticket #{tokenId}</span>
                  <Button size="sm" variant="outline">
                    View
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Organized Events */}
      <Card>
        <CardHeader>
          <CardTitle>Your Events</CardTitle>
          <CardDescription>{organizedEvents.length} event(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {organizedEvents.length === 0 ? (
            <p className="text-gray-500">No events created yet</p>
          ) : (
            <div className="space-y-2">
              {organizedEvents.map((eventId) => (
                <div
                  key={eventId}
                  className="border rounded p-3 flex justify-between items-center"
                >
                  <span className="font-mono">Event #{eventId}</span>
                  <Button size="sm" variant="outline">
                    Manage
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Usage in your App:
 * 
 * import ContractExample from "@/components/ContractExample";
 * 
 * export default function App() {
 *   return (<ContractExample />);
 * }
 */
