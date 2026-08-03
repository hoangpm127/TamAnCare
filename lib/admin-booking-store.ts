"use client";

import { useEffect, useState } from "react";

export type AdminBookingRequest = {
  bookingCode: string;
  customerName: string;
  customerPhone: string;
  serviceLabel: string;
  therapistName: string;
  roomName: string;
  durationMin: number;
  branchId: string;
  branchLabel: string;
  timeIso: string;
  totalAmount: number;
  depositAmount: number;
  paidAmount: number;
  paymentStatus: string;
  relationship?: "SELF" | "FRIEND" | "BOSS";
  careNote?: string;
  status: "NEW" | "CONFIRMED" | "REJECTED";
  rawStatus: string;
  createdAt: string;
  confirmedAt?: string;
  confirmedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
};

export type AdminBusinessRequest = {
  eventCode: string;
  companyName: string;
  contactName: string;
  contactPhone: string;
  location: string;
  serviceLabel: string;
  packageTier?: string | null;
  branchId: string;
  branchName: string;
  leadTherapist?: string | null;
  status: string;
  paymentStatus: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  headcount: number;
  durationMin: number;
  requiredTherapists: number;
  totalAmount: number;
  depositAmount: number;
  paidAmount: number;
};

const CHANGE_EVENT = "tam-an-admin-booking-requests-change";

type ServerBooking = {
  referenceCode: string;
  customerName: string;
  customerPhone: string;
  serviceLabel: string;
  therapistName: string;
  roomName: string;
  durationMin: number;
  branchId: string;
  branchLabel: string;
  timeIso?: string;
  totalAmount: number;
  depositAmount: number;
  paidAmount: number;
  paymentStatus: string;
  relationship?: string;
  careNote?: string;
  status: string;
  createdAt: string;
};

function serverRequest(item: ServerBooking): AdminBookingRequest | null {
  if (!item.timeIso) return null;
  const status: AdminBookingRequest["status"] = item.status === "PENDING" ? "NEW" : item.status === "CANCELLED" ? "REJECTED" : "CONFIRMED";
  return {
    bookingCode: item.referenceCode,
    customerName: item.customerName,
    customerPhone: item.customerPhone,
    serviceLabel: item.serviceLabel,
    therapistName: item.therapistName,
    roomName: item.roomName,
    durationMin: item.durationMin,
    branchId: item.branchId,
    branchLabel: item.branchLabel,
    timeIso: item.timeIso,
    totalAmount: item.totalAmount,
    depositAmount: item.depositAmount,
    paidAmount: item.paidAmount,
    paymentStatus: item.paymentStatus,
    relationship: item.relationship === "FRIEND" || item.relationship === "BOSS" ? item.relationship : "SELF",
    careNote: item.careNote,
    status,
    rawStatus: item.status,
    createdAt: item.createdAt,
  };
}

function requestReload() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useAdminBookingRequests(enabled = true) {
  const [requests, setRequests] = useState<AdminBookingRequest[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/bookings?limit=300", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Không thể tải booking");
        const server = (data.bookings as ServerBooking[]).map(serverRequest).filter((item): item is AdminBookingRequest => Boolean(item));
        if (active) setRequests(server);
      } catch {
        // Giữ dữ liệu DB gần nhất khi thiết bị mất kết nối; không chèn booking giả.
      }
    }
    void load();
    const timer = window.setInterval(load, 2500);
    const reload = () => void load();
    window.addEventListener(CHANGE_EVENT, reload);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener(CHANGE_EVENT, reload);
    };
  }, [enabled]);

  return requests;
}

export function useAdminBusinessRequests(enabled = true) {
  const [requests, setRequests] = useState<AdminBusinessRequest[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/business-events", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Không thể tải lịch Business");
        const events = (data.events ?? []) as AdminBusinessRequest[];
        if (active) setRequests(events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      } catch {
        // Giữ lần tải DB gần nhất khi thiết bị mất kết nối.
      }
    }
    void load();
    const timer = window.setInterval(load, 2500);
    const reload = () => void load();
    window.addEventListener(CHANGE_EVENT, reload);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener(CHANGE_EVENT, reload);
    };
  }, [enabled]);

  return requests;
}

export function registerAdminBookingRequest(...args: unknown[]) {
  void args;
  requestReload();
}

export function confirmAdminBookingRequest(...args: unknown[]) {
  void args;
  requestReload();
}

export function rejectAdminBookingRequest(...args: unknown[]) {
  void args;
  requestReload();
}
