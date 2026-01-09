import { QueueTicket } from "@/types";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

interface UseQueueSocketOptions {
  roomId?: number;
  autoConnect?: boolean;
}

/**
 * CUSTOM HOOK: useQueueSocket
 *
 * Quản lý WebSocket connection cho hàng chờ
 *
 * @example
 * ```tsx
 * const { tickets, isConnected, joinRoom } = useQueueSocket({ roomId: 1 });
 *
 *
 **/

export const useQueueSocket = (options: UseQueueSocketOptions = {}) => {
  const { roomId, autoConnect = true } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [lastEvent, setLastEvent] = useState<{
    type: string;
    ticket: QueueTicket;
  } | null>(null);

  useEffect(() => {
    if (!autoConnect) return;

    // Kết nối tới namespace /queue
    console.log(
      `Connecting to queue socket at ${process.env.NEXT_PUBLIC_SERVER_URL}/queue`
    );
    const socket = io(`${process.env.NEXT_PUBLIC_SERVER_URL}/queue`, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // ==================== CONNECTION EVENTS ====================
    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      setIsConnected(true);

      // Tự động join room nếu có roomId
      if (roomId) {
        socket.emit("join_room", { roomId });
      }
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    });

    socket.on("joined_room", (data) => {
      console.log("Joined room:", data);
    });

    // ==================== TICKET EVENTS ====================

    socket.on("ticket:created", (ticket: QueueTicket) => {
      console.log("New ticket:", ticket);
      setLastEvent({ type: "ticket:created", ticket });

      // Thêm ticket mới vào cuối danh sách
      setTickets((prev) => [...prev, ticket]);
    });

    socket.on("ticket:called", (ticket: QueueTicket) => {
      console.log("Ticket called:", ticket);
      setLastEvent({ type: "called", ticket });

      // Cập nhật ticket trong danh sách
      setTickets((prev) =>
        prev.map((t) => (t.ticket_id === ticket.ticket_id ? ticket : t))
      );
    });

    socket.on("ticket:started", (ticket: QueueTicket) => {
      console.log("Ticket started:", ticket);
      setLastEvent({ type: "started", ticket });

      setTickets((prev) =>
        prev.map((t) => (t.ticket_id === ticket.ticket_id ? ticket : t))
      );
    });

    socket.on("ticket:completed", (ticket: QueueTicket) => {
      console.log("Ticket completed:", ticket);
      setLastEvent({ type: "completed", ticket });

      setTickets((prev) =>
        prev.map((t) => (t.ticket_id === ticket.ticket_id ? ticket : t))
      );
    });

    socket.on("ticket:skipped", (ticket: QueueTicket) => {
      console.log("Ticket skipped:", ticket);
      setLastEvent({ type: "skipped", ticket });

      setTickets((prev) =>
        prev.map((t) => (t.ticket_id === ticket.ticket_id ? ticket : t))
      );
    });

    socket.on("ticket:updated", (ticket: QueueTicket) => {
      console.log("Ticket updated:", ticket);
      setLastEvent({ type: "updated", ticket });

      setTickets((prev) =>
        prev.map((t) => (t.ticket_id === ticket.ticket_id ? ticket : t))
      );
    });

    // ==================== CLEANUP ====================
    return () => {
      console.log("Cleaning up socket connection");
      socket.disconnect();
    };
  }, [autoConnect, roomId]);

  /**
   * Join một room cụ thể
   */
  const joinRoom = (roomId: number) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("join_room", { roomId });
    }
  };

  /**
   * Leave một room
   */
  const leaveRoom = (roomId: number) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("leave_room", { roomId });
    }
  };

  /**
   * Join room tổng (dashboard)
   */
  const joinAllRooms = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("join_all_rooms");
    }
  };

  /**
   * Manual connect
   */
  const connect = () => {
    socketRef.current?.connect();
  };

  /**
   * Manual disconnect
   */
  const disconnect = () => {
    socketRef.current?.disconnect();
  };

  return {
    socket: socketRef.current,
    isConnected,
    tickets,
    lastEvent,
    joinRoom,
    leaveRoom,
    joinAllRooms,
    connect,
    disconnect,
  };
};
