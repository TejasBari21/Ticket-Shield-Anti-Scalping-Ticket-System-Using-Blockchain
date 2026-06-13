/**
 * Hook for periodic syncing of pending tickets
 * Attempts to sync tickets stored in localStorage to Supabase
 * when the application detects network connectivity
 */

import { useEffect } from "react";
import { syncPendingTickets } from "@/integrations/supabase/ticketSync";
import { useToast } from "@/hooks/use-toast";

interface UsePendingTicketSyncOptions {
  /**
   * Interval in milliseconds to check for pending tickets
   * @default 30000 (30 seconds)
   */
  checkInterval?: number;

  /**
   * Whether to show toast notifications for sync results
   * @default true
   */
  showNotifications?: boolean;

  /**
   * Email of the current user (for tagging synced tickets)
   */
  ownerEmail?: string;
}

/**
 * Hook that periodically attempts to sync pending tickets from localStorage
 * to Supabase. This is useful for ensuring tickets synced when connectivity
 * is restored after being offline.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { appUser } = useAuth();
 *   usePendingTicketSync({ ownerEmail: appUser?.email });
 *
 *   return <div>Tickets will auto-sync when connection is restored.</div>;
 * }
 * ```
 */
export function usePendingTicketSync(options?: UsePendingTicketSyncOptions) {
  const { showNotifications = true, ownerEmail, checkInterval = 30000 } = options ?? {};
  const { toast } = useToast();

  useEffect(() => {
    // Track if component is still mounted
    let isMounted = true;

    /**
     * Attempts a single sync of pending tickets
     */
    const attemptSync = async () => {
      if (!isMounted) return;

      try {
        const { synced, failed } = await syncPendingTickets(ownerEmail);

        if (synced > 0 && showNotifications) {
          toast({
            title: "Tickets Synced",
            description: `${synced} outstanding ticket(s) have been synced to the cloud.`,
          });
        }

        if (failed > 0) {
          console.warn(`[PendingSync] ${failed} ticket(s) still pending. Will retry later.`);
        }
      } catch (err) {
        console.error("[PendingSync] Error syncing pending tickets:", err);
      }
    };

    // Only set up interval for periodic syncing (skip initial sync to avoid blocking)
    const interval = setInterval(() => {
      void attemptSync();
    }, checkInterval);

    // Listen for online/offline events
    const handleOnline = () => {
      console.log("[PendingSync] Connection restored, attempting sync...");
      void attemptSync();
    };

    window.addEventListener("online", handleOnline);

    // Cleanup
    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
    };
  }, [showNotifications, ownerEmail, checkInterval, toast]);
}
