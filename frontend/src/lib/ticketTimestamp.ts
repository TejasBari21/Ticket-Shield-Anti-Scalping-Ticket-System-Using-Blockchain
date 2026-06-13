/**
 * Timestamp utility for consistent formatting across PDF, UI, and email
 * Format: "DD MMM YYYY, hh:mm A" (e.g., "18 Mar 2026, 07:45 PM")
 */

/**
 * Format a date to the ticket timestamp format
 * @param date - Date string or Date object
 * @returns Formatted string "DD MMM YYYY, hh:mm A"
 */
export function formatTicketTimestamp(date: string | Date): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return "N/A";
  }

  const day = String(dateObj.getDate()).padStart(2, "0");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[dateObj.getMonth()];
  const year = dateObj.getFullYear();
  
  let hours = dateObj.getHours();
  const minutes = String(dateObj.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const hoursStr = String(hours).padStart(2, "0");
  
  return `${day} ${month} ${year}, ${hoursStr}:${minutes} ${ampm}`;
}

/**
 * Format a date to a shorter format for UI display
 * @param date - Date string or Date object
 * @returns Formatted string "DD MMM YYYY"
 */
export function formatTicketDate(date: string | Date): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return "N/A";
  }

  const day = String(dateObj.getDate()).padStart(2, "0");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[dateObj.getMonth()];
  const year = dateObj.getFullYear();
  
  return `${day} ${month} ${year}`;
}

/**
 * Format a time for display
 * @param date - Date string or Date object
 * @returns Formatted string "hh:mm A" (e.g., "07:45 PM")
 */
export function formatTicketTime(date: string | Date): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return "N/A";
  }

  let hours = dateObj.getHours();
  const minutes = String(dateObj.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const hoursStr = String(hours).padStart(2, "0");
  
  return `${hoursStr}:${minutes} ${ampm}`;
}

/**
 * Get current timestamp in the ticket format
 * @returns Formatted string "DD MMM YYYY, hh:mm A"
 */
export function getCurrentTicketTimestamp(): string {
  return formatTicketTimestamp(new Date());
}
