import { Order, Client, OrderStatus } from "@/types";

// Mock data is no longer needed as we now use the real database
// This file is kept for backward compatibility during the transition

export const mockOrders: Order[] = [];

export const mockClients: Client[] = [];

export function getOrdersByStatus(status: OrderStatus): Order[] {
  return mockOrders.filter((order) => order.status === status);
}

export function getOrderStats() {
  return {
    total: 0,
    todayCount: 0,
    inProgress: 0,
    ready: 0,
    revenue: 0,
  };
}
