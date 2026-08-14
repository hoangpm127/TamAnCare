"use client";

import Link from "next/link";
import { addDays, format, isSameDay } from "date-fns";
import { vi } from "date-fns/locale";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Gift,
  Handshake,
  Loader2,
  MapPin,
  Minus,
  Percent,
  Plus,
  Receipt,
  ShieldCheck,
  Star,
  Tag,
  Ticket,
  UserRound,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type { CatalogVoucher, PublicCatalog } from "@/lib/catalog-types";
import { cn, formatMoney, makeBookingCode, stripDurationFromName } from "@/lib/utils";
import { useReferralAttribution } from "@/lib/referral-attribution";
import { TherapistAvatar } from "@/components/therapist-avatar";
import { saveBookingPaymentDraft } from "@/lib/booking-payment-store";
import { calculatePaymentBreakdown } from "@/lib/payment-policy";
import { useCustomerProfile } from "@/lib/customer-profile-store";
import { useVoucherInventory } from "@/lib/voucher-inventory";
import { useCustomerAccount } from "@/lib/customer-account";
import { useMemberships } from "@/lib/membership";
import { BOOKING_UI_DRAFT_KEY, BOOKING_UI_RESET_EVENT } from "@/lib/booking-ui-draft";

type Slot = {
  startTime: string;
  endTime: string;
  availableTherapists: { id: string; fullName: string; ratingAvg: number }[];
  availableRooms: { id: string; name: string; type: string }[];
  remainingCapacity: number;
  isAvailable: boolean;
  allocationMode: "SINGLE" | "SAME_ROOM" | "SPLIT_ROOMS" | "UNAVAILABLE";
  roomCount: number;
};

type RecommendedVoucher = CatalogVoucher & {
  eligible: boolean;
  eligibilityReason: string | null;
  recommendationReason: "TIME_WINDOW" | "NEW_CUSTOMER" | "RETURNING_CUSTOMER" | "GENERAL";
  remaining: number | null;
};

type CartLine = {
  id: string;
  serviceId: string;
  people: number;
};

type BookingUiDraft = {
  contextKey: string;
  cart: CartLine[];
  date: string;
  branchId: string;
  therapistId: string;
  selectedSlotStartTime: string;
  phoneInput: string | null;
  nameInput: string | null;
  note: string;
  voucherCode: string;
  voucherOptOut?: boolean;
  customerPackageId?: string;
  showManualVoucher: boolean;
  acceptPolicies: boolean;
};

const NEXT_DAYS = 10;
const AVAILABILITY_REFRESH_MS = 15_000;

export function BookingClient({ catalog }: { catalog: PublicCatalog }) {
  const { branches, services, therapists, vouchers } = catalog;
  const params = useSearchParams();
  const router = useRouter();
  const customerProfile = useCustomerProfile();
  const { account } = useCustomerAccount();
  const memberships = useMemberships();
  const voucherInventory = useVoucherInventory();
  const bookableServices = useMemo(() => services.filter((item) => item.category !== "OFFICE"), [services]);
  const bookingContextKey = params.toString();
  const inviteMode = params.get("invite") === "boss" ? "boss" : params.get("invite") === "friend" ? "friend" : null;
  const inviteContext = inviteMode === "boss"
    ? {
      relationship: "BOSS" as const,
      title: "Đặt lịch đi cùng sếp / đối tác",
      body: "Tâm An sẽ chuyển ghi chú tế nhị tới quản lý cơ sở để ưu tiên không gian lịch sự, yên tĩnh và giường gần nhau.",
      note: "Mời sếp/đối tác đi cùng; ưu tiên không gian lịch sự, yên tĩnh và sắp xếp giường gần nhau để tiện trao đổi.",
    }
    : inviteMode === "friend"
      ? {
        relationship: "FRIEND" as const,
        title: "Đặt lịch đi cùng bạn",
        body: "Cơ sở sẽ chủ động xếp giường gần nhau để hai bạn cùng thư giãn và trò chuyện.",
        note: "Mời bạn đi cùng; ưu tiên sắp xếp giường gần nhau.",
      }
      : null;

  const preselectedTherapist = therapists.find((item) => item.id === params.get("therapist"));
  const defaultServiceId = params.get("service") ?? preselectedTherapist?.serviceIds[0] ?? bookableServices[0].id;
  const requestedBranchId = params.get("branch");
  const defaultBranchId = preselectedTherapist?.branchId
    ?? branches.find((item) => item.id === requestedBranchId)?.id
    ?? branches[0]?.id
    ?? "";
  const defaultTherapistId = preselectedTherapist?.id ?? "";
  const defaultPeople = inviteContext ? 2 : 1;
  const defaultNote = inviteContext?.note ?? "";
  const [cart, setCart] = useState<CartLine[]>(() => [
    {
      id: crypto.randomUUID(),
      serviceId: defaultServiceId,
      people: defaultPeople,
    },
  ]);
  const [date, setDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [therapistId, setTherapistId] = useState(defaultTherapistId);
  const [showTherapistPicker, setShowTherapistPicker] = useState(Boolean(preselectedTherapist));
  const [selectedSlotStartTime, setSelectedSlotStartTime] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [phoneInput, setPhoneInput] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState<string | null>(null);
  const phone = phoneInput ?? account?.phone ?? customerProfile.phone;
  const nickName = nameInput ?? account?.fullName ?? customerProfile.fullName;
  const [note, setNote] = useState(defaultNote);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherOptOut, setVoucherOptOut] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const autofilledAccountRef = useRef("");
  const [showManualVoucher, setShowManualVoucher] = useState(false);
  const source = params.get("utm_source") ?? params.get("source") ?? "Direct/QR";
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [voucherChecking, setVoucherChecking] = useState(false);
  const [voucherPreview, setVoucherPreview] = useState({ valid: true, discountAmount: 0, message: "", stackedCodes: [] as string[] });
  const [recommendedVouchers, setRecommendedVouchers] = useState<RecommendedVoucher[]>(() => vouchers.map((voucher) => ({
    ...voucher,
    eligible: true,
    eligibilityReason: null,
    recommendationReason: "GENERAL",
    remaining: null,
  })));
  const [acceptPolicies, setAcceptPolicies] = useState(false);

  const anchorServiceId = cart[0]?.serviceId ?? bookableServices[0].id;
  const anchorService = useMemo(
    () => services.find((item) => item.id === anchorServiceId) ?? bookableServices[0],
    [anchorServiceId, bookableServices, services]
  );
  const eligibleTherapists = therapists.filter(
    (therapist) => therapist.serviceIds.includes(anchorServiceId) && therapist.status === "ACTIVE" && therapist.branchId === branchId
  );
  const selectedBranch = branches.find((item) => item.id === branchId);
  const selectedTherapist = eligibleTherapists.find((item) => item.id === therapistId);
  const totalPeople = cart.reduce((sum, line) => sum + line.people, 0);
  const isGroupBooking = cart.length > 1 || totalPeople > 1;
  // Đặt nhóm luôn để hệ thống tự rải KTV — bỏ qua lựa chọn 1 KTV cụ thể còn sót lại từ lúc chỉ đặt 1 người.
  const effectiveTherapistId = isGroupBooking ? "" : therapistId;
  const selectedAvailabilitySlot = slots.find((item) => item.startTime === selectedSlotStartTime) ?? null;
  const selectedTherapistIsAvailable = !effectiveTherapistId
    || Boolean(selectedAvailabilitySlot?.availableTherapists.some((therapist) => therapist.id === effectiveTherapistId));
  const slot = selectedAvailabilitySlot
    && selectedAvailabilitySlot.isAvailable
    && selectedAvailabilitySlot.remainingCapacity >= totalPeople
    && selectedTherapistIsAvailable
    ? selectedAvailabilitySlot
    : null;

  const cartDetails = cart.map((line) => ({
    ...line,
    service: services.find((item) => item.id === line.serviceId) ?? bookableServices[0],
  }));
  const subtotal = cartDetails.reduce((sum, line) => sum + (line.service.basePrice + line.service.therapistFee) * line.people, 0);

  const attributionCode = useReferralAttribution();
  const firstVisitEligible = account ? account.totalVisits === 0 : Boolean(attributionCode);
  const automaticVoucherCode = !voucherOptOut
    ? account?.welcomeCreditAvailable
      ? "WELCOME150"
      : ""
    : "";
  const effectiveVoucherCode = (voucherCode || automaticVoucherCode).trim().toUpperCase();

  const depositActive = true;
  const selectedVoucherStock = effectiveVoucherCode ? voucherInventory[effectiveVoucherCode] : undefined;
  const voucherInStock = !selectedVoucherStock || selectedVoucherStock.remaining === null || selectedVoucherStock.remaining > 0;
  const selectedPackage = memberships.find((item) => item.id === selectedPackageId) ?? null;
  const packageEligible = Boolean(
    selectedPackage
    && !effectiveVoucherCode
    && selectedPackage.availableSessions >= totalPeople
    && (totalPeople === 1 || selectedPackage.shareable)
    && (!selectedPackage.serviceId || cart.every((item) => item.serviceId === selectedPackage.serviceId)),
  );
  const voucherDiscount = !packageEligible && effectiveVoucherCode && voucherPreview.valid && voucherInStock ? voucherPreview.discountAmount : 0;
  const paymentBreakdown = calculatePaymentBreakdown({
    originalAmount: subtotal,
    discountAmount: packageEligible ? subtotal : voucherDiscount,
    depositPercent: catalog.depositPercent,
    prepaid: packageEligible,
  });
  const appliedDiscount = paymentBreakdown.discountAmount;
  const total = paymentBreakdown.totalAmount;
  const depositAmount = paymentBreakdown.depositAmount;
  const amountDueAtBranch = paymentBreakdown.balanceAmount;
  const recommendationServiceKey = [...new Set(cart.map((item) => item.serviceId))].sort().join(",");

  useEffect(() => {
    function resetToFreshBooking() {
      setCart([{
        id: crypto.randomUUID(),
        serviceId: defaultServiceId,
        people: defaultPeople,
      }]);
      setDate(format(addDays(new Date(), 1), "yyyy-MM-dd"));
      setBranchId(defaultBranchId);
      setTherapistId(defaultTherapistId);
      setSelectedSlotStartTime("");
      setPhoneInput(null);
      setNameInput(null);
      setNote(defaultNote);
      setVoucherCode("");
      setSelectedPackageId("");
      setVoucherOptOut(false);
      setShowManualVoucher(false);
      setAcceptPolicies(false);
      setError("");
      setDraftHydrated(true);
    }

    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const raw = window.sessionStorage.getItem(BOOKING_UI_DRAFT_KEY);
        const saved = raw ? JSON.parse(raw) as BookingUiDraft : null;
        if (saved?.contextKey === bookingContextKey && Array.isArray(saved.cart) && saved.cart.length > 0) {
          setCart(saved.cart);
          setDate(saved.date);
          setBranchId(saved.branchId);
          setTherapistId(saved.therapistId);
          setSelectedSlotStartTime(saved.selectedSlotStartTime);
          setPhoneInput(saved.phoneInput);
          setNameInput(saved.nameInput);
          setNote(saved.note);
          setVoucherCode(saved.voucherCode);
          setVoucherOptOut(Boolean(saved.voucherOptOut));
          setSelectedPackageId(saved.customerPackageId ?? "");
          setShowManualVoucher(saved.showManualVoucher);
          setAcceptPolicies(saved.acceptPolicies);
        }
      } catch {
        window.sessionStorage.removeItem(BOOKING_UI_DRAFT_KEY);
      } finally {
        setDraftHydrated(true);
      }
    });

    window.addEventListener(BOOKING_UI_RESET_EVENT, resetToFreshBooking);
    return () => {
      active = false;
      window.removeEventListener(BOOKING_UI_RESET_EVENT, resetToFreshBooking);
    };
  }, [bookingContextKey, defaultBranchId, defaultNote, defaultPeople, defaultServiceId, defaultTherapistId]);

  useEffect(() => {
    if (!draftHydrated || !account || selectedPackageId || autofilledAccountRef.current === account.customerId) return;
    let active = true;
    queueMicrotask(() => {
      if (!active || autofilledAccountRef.current === account.customerId) return;
      autofilledAccountRef.current = account.customerId;
      // Khi vừa đăng nhập/đăng ký, hồ sơ tài khoản phải ưu tiên hơn bản nháp khách cũ.
      setPhoneInput(null);
      setNameInput(null);
      if (account.welcomeCreditAvailable) {
        setVoucherOptOut(false);
        setVoucherCode("WELCOME150");
      } else if (voucherCode === "WELCOME150") {
        setVoucherCode("");
      }
    });
    return () => { active = false; };
  }, [account, draftHydrated, selectedPackageId, voucherCode]);

  useEffect(() => {
    if (!draftHydrated) return;
    const saved: BookingUiDraft = {
      contextKey: bookingContextKey,
      cart,
      date,
      branchId,
      therapistId,
      selectedSlotStartTime,
      phoneInput,
      nameInput,
      note,
      voucherCode,
      voucherOptOut,
      customerPackageId: selectedPackageId || undefined,
      showManualVoucher,
      acceptPolicies,
    };
    window.sessionStorage.setItem(BOOKING_UI_DRAFT_KEY, JSON.stringify(saved));
  }, [acceptPolicies, bookingContextKey, branchId, cart, date, draftHydrated, nameInput, note, phoneInput, selectedPackageId, selectedSlotStartTime, showManualVoucher, therapistId, voucherCode, voucherOptOut]);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ subtotal: String(subtotal) });
    if (slot?.startTime) query.set("startTime", slot.startTime);
    for (const serviceId of recommendationServiceKey.split(",").filter(Boolean)) {
      query.append("serviceId", serviceId);
    }
    fetch(`/api/vouchers/ranked?${query.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("voucher recommendations unavailable");
        return response.json();
      })
      .then((payload) => {
        if (!controller.signal.aborted && Array.isArray(payload.vouchers)) {
          setRecommendedVouchers(payload.vouchers as RecommendedVoucher[]);
        }
      })
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        console.warn("voucher_recommendations.load_failed", caught);
      });
    return () => controller.abort();
  }, [account?.customerId, recommendationServiceKey, slot?.startTime, subtotal]);

  useEffect(() => {
    if (!effectiveVoucherCode) {
      let active = true;
      queueMicrotask(() => {
        if (!active) return;
        setVoucherChecking(false);
        setVoucherPreview({ valid: true, discountAmount: 0, message: "", stackedCodes: [] });
      });
      return () => { active = false; };
    }
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setVoucherChecking(true);
      setVoucherPreview({ valid: false, discountAmount: 0, message: "", stackedCodes: [] });
    });
    fetch("/api/vouchers/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: effectiveVoucherCode,
        subtotal,
        serviceIds: [...new Set(cart.map((item) => item.serviceId))],
        startTime: slot?.startTime,
        customerPhone: phone ? phone.replace(/\s+/g, "") : undefined,
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok && !payload.message) throw new Error("Không thể kiểm tra mã ưu đãi.");
        const canonicalCode = typeof payload.canonicalCode === "string" ? payload.canonicalCode.trim().toUpperCase() : "";
        setVoucherPreview({
          valid: Boolean(payload.valid),
          discountAmount: Number(payload.discountAmount ?? 0),
          message: String(payload.message ?? ""),
          stackedCodes: Array.isArray(payload.stackedCodes) ? payload.stackedCodes.map(String) : [],
        });
        if (canonicalCode && voucherCode.trim().toUpperCase() === effectiveVoucherCode && canonicalCode !== effectiveVoucherCode) {
          setVoucherCode(canonicalCode);
        }
      })
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setVoucherPreview({ valid: false, discountAmount: 0, message: "Không thể kiểm tra mã ưu đãi lúc này.", stackedCodes: [] });
      })
      .finally(() => {
        if (!controller.signal.aborted) setVoucherChecking(false);
      });
    return () => controller.abort();
  }, [attributionCode, effectiveVoucherCode, subtotal, cart, slot?.startTime, phone, voucherCode]);

  const dateOptions = useMemo(
    () => Array.from({ length: NEXT_DAYS }, (_, index) => addDays(new Date(), index)),
    []
  );

  useEffect(() => {
    let ignore = false;
    let controller: AbortController | null = null;

    async function loadAvailability(showLoading: boolean) {
      controller?.abort();
      controller = new AbortController();
      if (showLoading && !ignore) {
        setLoadingSlots(true);
        setError("");
      }
      try {
        const response = await fetch("/api/availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            branchId,
            includeUnavailable: true,
            therapistId: effectiveTherapistId || undefined,
            units: cart.map((line) => ({ serviceId: line.serviceId, people: line.people })),
          }),
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("availability unavailable");
        const data = await response.json();
        if (!ignore) {
          setSlots((data.slots ?? []).map((item: Slot) => ({
            ...item,
            isAvailable: item.isAvailable ?? item.remainingCapacity > 0,
          })));
        }
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (!ignore && showLoading) {
          setError("Không tải được lịch trống. Thử lại sau ít phút.");
        }
      } finally {
        if (!ignore && showLoading) {
          setLoadingSlots(false);
        }
      }
    }

    void loadAvailability(true);
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadAvailability(false);
    }, AVAILABILITY_REFRESH_MS);
    const refreshOnFocus = () => void loadAvailability(false);
    window.addEventListener("focus", refreshOnFocus);

    return () => {
      ignore = true;
      controller?.abort();
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [branchId, cart, date, effectiveTherapistId]);

  function toggleService(serviceId: string) {
    setSelectedSlotStartTime("");
    setCart((current) => {
      const existing = current.find((line) => line.serviceId === serviceId);
      if (existing) {
        return current.filter((line) => line.serviceId !== serviceId);
      }
      return [...current, { id: crypto.randomUUID(), serviceId, people: 1 }];
    });
  }

  function changePeople(lineId: string, delta: number) {
    setCart((current) =>
      current.map((line) => (line.id === lineId ? { ...line, people: Math.max(1, Math.min(6, line.people + delta)) } : line))
    );
  }

  function removeLine(lineId: string) {
    setCart((current) => current.filter((line) => line.id !== lineId));
  }

  function submitBooking() {
    if (cart.length === 0) {
      setError("Hãy chọn ít nhất một dịch vụ.");
      return;
    }
    if (!slot) {
      setError("Hãy chọn khung giờ còn trống.");
      return;
    }
    if (!nickName.trim()) {
      setError("Hãy nhập tên khách đặt lịch.");
      return;
    }
    if (voucherChecking) {
      setError("Hệ thống đang kiểm tra mã ưu đãi. Vui lòng đợi một chút.");
      return;
    }
    if (effectiveVoucherCode && !voucherPreview.valid) {
      setError(voucherPreview.message || "Mã ưu đãi không hợp lệ.");
      return;
    }
    if (effectiveVoucherCode && voucherPreview.valid && !voucherInStock) {
      setError(`Ưu đãi ${effectiveVoucherCode} đã hết lượt sử dụng.`);
      return;
    }
    if (totalPeople > slot.remainingCapacity) {
      setError(`Khung giờ này chỉ còn ${slot.remainingCapacity} chỗ. Hãy giảm số người hoặc chọn giờ khác.`);
      return;
    }

    if (!acceptPolicies) {
      setError("Hãy xác nhận các chính sách để tiếp tục giữ chỗ.");
      return;
    }

    setSubmitting(true);
    setError("");

    const groupCode = `GRP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const units: { serviceId: string }[] = [];
    cartDetails.forEach((line) => {
      for (let i = 0; i < line.people; i++) units.push({ serviceId: line.serviceId });
    });

    const bookingCodes = units.map(() => makeBookingCode());
    const requestPayloads = units.map((unit, index) => {
      return {
        bookingCode: bookingCodes[index],
        serviceId: unit.serviceId,
        startTime: slot.startTime,
        therapistId: effectiveTherapistId || undefined,
        customerName: nickName || undefined,
        customerPhone: phone || undefined,
        nickName: nickName || undefined,
        note: `${units.length > 1 ? `[Nhóm ${groupCode}] ` : ""}${inviteContext ? `[${inviteContext.title}] ` : ""}${note}`.trim(),
        voucherCode: index === 0 ? effectiveVoucherCode : "",
        campaignCode: attributionCode || undefined,
        depositRequested: true as const,
        source,
        branchId,
      };
    });
    const servicesSummary = cartDetails.map((line) => `${line.service.name}${line.people > 1 ? ` x${line.people}` : ""}`).join(", ");
    const itemsPayload = cartDetails.map((line) => ({
      name: line.service.name,
      qty: line.people,
      amount: (line.service.basePrice + line.service.therapistFee) * line.people,
    }));

    const referenceCode = bookingCodes[0];
    saveBookingPaymentDraft({
      referenceCode,
      createdAt: new Date().toISOString(),
      status: "AWAITING_DEPOSIT",
      bookingCodes,
      requestPayloads,
      summary: {
        serviceLabel: servicesSummary,
        durationMin: anchorService.durationMin,
        therapistLabel: effectiveTherapistId
          ? (therapists.find((item) => item.id === effectiveTherapistId)?.fullName ?? "Hệ thống sắp xếp")
          : "Hệ thống sắp xếp",
        timeIso: slot.startTime,
        subtotal,
        total,
        nickName: nickName || undefined,
        depositAmount,
        dueAmount: amountDueAtBranch,
        discount: appliedDiscount > 0 ? appliedDiscount : undefined,
        voucherCode: !packageEligible && voucherDiscount > 0
          ? (voucherPreview.stackedCodes.length ? voucherPreview.stackedCodes.join("+") : effectiveVoucherCode)
          : undefined,
        count: bookingCodes.length,
        items: itemsPayload,
        branchId,
        relationship: inviteContext?.relationship ?? "SELF",
        careNote: inviteContext ? note : undefined,
        packageName: packageEligible ? selectedPackage?.planName : undefined,
        customerPackageId: packageEligible ? selectedPackage?.id : undefined,
        policyAcceptedAt: new Date().toISOString(),
      },
    });
    router.push(`/booking/success/${referenceCode}`);
  }

  return (
    <main className="bg-[#fdf8f3] text-[#281b18]">
      <div className="mx-auto grid max-w-7xl gap-2 px-4 pb-6 pt-3 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-10">
        <section className="min-w-0 space-y-2">

          {attributionCode && firstVisitEligible ? (
            <div className="flex items-center gap-2 rounded-xl border border-[#c59a3d] bg-[#fbf2e7] px-3.5 py-2.5 text-xs text-[#8a5a12]">
              <Gift size={15} className="shrink-0" />
              <span>
                Nguồn giới thiệu <strong className="font-mono">{attributionCode}</strong> đã kích hoạt sau khi cài app. {account?.welcomeCreditAvailable
                  ? <><strong>WELCOME150 + AFF50</strong> sẽ được cộng cùng nhau cho Bill đủ điều kiện.</>
                  : <>Tạo tài khoản mới để nhận và cộng đủ hai voucher.</>}
              </span>
            </div>
          ) : null}

          {inviteContext ? (
            <div className={cn("flex items-start gap-3 rounded-xl px-3.5 py-3 text-xs", inviteMode === "boss" ? "bg-gradient-to-r from-[#30201c] to-[#6b3423] text-white" : "bg-[#f8ebe5] text-[#6f211f]")}>
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", inviteMode === "boss" ? "bg-white/10 text-[#e7c878]" : "bg-white text-[#c64b32]")}>
                {inviteMode === "boss" ? <Handshake size={17} /> : <UserPlus size={17} />}
              </span>
              <span className="min-w-0">
                <strong className="block text-sm">{inviteContext.title}</strong>
                <span className={cn("mt-1 block leading-5", inviteMode === "boss" ? "text-white/72" : "text-[#80524a]")}>{inviteContext.body}</span>
              </span>
            </div>
          ) : null}

          {/* Step 1: Services */}
          <div className="rounded-xl border border-[#e7d6ca] bg-white p-3">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold tracking-tight">
              <Check size={16} /> 1. Chọn dịch vụ <span className="text-[11px] font-normal text-[#826f66]">(có thể chọn nhiều)</span>
            </h2>
            <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {bookableServices.map((item) => {
                const inCart = cart.some((line) => line.serviceId === item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleService(item.id)}
                    className={cn(
                      "relative w-28 shrink-0 rounded-lg border p-2 text-left transition",
                      inCart ? "border-[#c64b32] bg-[#f8ebe5]" : "border-[#e7d6ca] bg-white hover:border-[#c7a296]"
                    )}
                  >
                    {inCart ? (
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#c64b32] text-white">
                        <Check size={12} />
                      </span>
                    ) : null}
                    <p className="line-clamp-2 text-xs font-semibold leading-tight">{stripDurationFromName(item.name)}</p>
                    <p className="mt-1.5 text-xs font-bold text-[#c64b32]">{formatMoney(item.basePrice + item.therapistFee)}</p>
                    {item.suggestedTip > 0 ? <p className="mt-0.5 text-[9px] leading-3.5 text-[#826f66]">Tip gợi ý {formatMoney(item.suggestedTip)} · trao trực tiếp</p> : null}
                    <p className="flex items-center gap-1 text-[10px] text-[#826f66]">
                      <Clock size={10} /> {item.durationMin} phút
                    </p>
                  </button>
                );
              })}
            </div>

            {cartDetails.length > 0 ? (
              <div className="mt-2.5 space-y-1.5 border-t border-[#eee0d6] pt-2.5">
                {cartDetails.map((line) => (
                  <div key={line.id} className="flex items-center justify-between gap-2 rounded-lg bg-[#fcf3ed] px-2.5 py-2">
                    <p className="min-w-0 truncate text-xs font-semibold">{line.service.name}</p>
                    <div className="flex shrink-0 items-center gap-2.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => changePeople(line.id, -1)}
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-[#e7d6ca] text-[#c64b32]"
                          aria-label="Giảm số người"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="flex items-center gap-1 text-xs font-semibold">
                          <Users size={12} /> {line.people}
                        </span>
                        <button
                          type="button"
                          onClick={() => changePeople(line.id, 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-[#e7d6ca] text-[#c64b32]"
                          aria-label="Tăng số người"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <button type="button" onClick={() => removeLine(line.id)} aria-label="Bỏ dịch vụ" className="text-[#826f66]">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {isGroupBooking ? (
                  <p className="pt-1 text-[11px] text-[#826f66]">
                    Đặt cho nhóm {totalPeople} người — giờ hẹn dùng chung, lễ tân sắp xếp KTV/phòng phù hợp cho từng người.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Step 2: Branch & therapist */}
          <div className="rounded-xl border border-[#e7d6ca] bg-white p-3">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold tracking-tight">
              <MapPin size={16} /> 2. Chọn cơ sở & kỹ thuật viên
            </h2>
            <div className="flex gap-2">
              {branches.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setBranchId(item.id);
                    setTherapistId("");
                    setSelectedSlotStartTime("");
                  }}
                  className={cn(
                    "flex-1 rounded-lg border px-2.5 py-2 text-left transition",
                    branchId === item.id ? "border-[#c64b32] bg-[#f8ebe5]" : "border-[#e7d6ca] bg-white hover:border-[#c7a296]"
                  )}
                >
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="line-clamp-1 block text-[11px] text-[#826f66]">{item.address}</span>
                </button>
              ))}
            </div>

            {!isGroupBooking ? (
              <div className="mt-2.5 border-t border-[#eee0d6] pt-2.5">
                <button
                  type="button"
                  onClick={() => setShowTherapistPicker((prev) => !prev)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#e7d6ca] bg-[#fdf8f5] px-3 py-2.5 text-left"
                >
                  <span className="flex items-center gap-2">
                    {selectedTherapist ? (
                      <TherapistAvatar id={selectedTherapist.id} size={28} className="shrink-0 rounded-full" />
                    ) : (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eee0d6]">
                        <UserRound size={14} className="text-[#c64b32]" />
                      </span>
                    )}
                    <span className="text-sm">
                      <span className="font-semibold">Kỹ thuật viên: </span>
                      {selectedTherapist ? selectedTherapist.fullName : "Ngẫu nhiên"}
                    </span>
                  </span>
                  <ChevronDown size={16} className={cn("shrink-0 text-[#826f66] transition", showTherapistPicker && "rotate-180")} />
                </button>

                {showTherapistPicker ? (
                  <div className="mt-2.5">
                    <div className="scrollbar-hide flex snap-x gap-2.5 overflow-x-auto pb-1">
                      <button
                        type="button"
                        onClick={() => {
                          setTherapistId("");
                          setSelectedSlotStartTime("");
                          setShowTherapistPicker(false);
                        }}
                        className={cn(
                          "w-24 shrink-0 snap-start rounded-xl border p-3 text-center transition",
                          !therapistId ? "border-[#c64b32] bg-[#f8ebe5]" : "border-[#e7d6ca] bg-white"
                        )}
                      >
                        <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#eee0d6]">
                          <UserRound size={16} className="text-[#c64b32]" />
                        </span>
                        <span className="mt-2 block text-xs font-semibold">Ngẫu nhiên</span>
                      </button>
                      {eligibleTherapists.map((therapist) => {
                        const availableAtSelectedTime = !selectedSlotStartTime
                          || Boolean(selectedAvailabilitySlot?.availableTherapists.some((item) => item.id === therapist.id));
                        return (
                          <button
                            key={therapist.id}
                            type="button"
                            disabled={!availableAtSelectedTime}
                            onClick={() => {
                              setTherapistId(therapist.id === therapistId ? "" : therapist.id);
                              setShowTherapistPicker(false);
                            }}
                            className={cn(
                              "w-24 shrink-0 snap-start rounded-xl border p-3 text-center transition",
                              therapistId === therapist.id
                                ? "border-[#c64b32] bg-[#f8ebe5]"
                                : availableAtSelectedTime
                                  ? "border-[#e7d6ca] bg-white"
                                  : "cursor-not-allowed border-[#efb5b2] bg-[#fff0ef] opacity-60"
                            )}
                          >
                            <TherapistAvatar id={therapist.id} size={36} className="mx-auto shrink-0 rounded-full" />
                            <span className="mt-2 block truncate text-xs font-semibold">{therapist.fullName}</span>
                            <span className="mt-0.5 flex items-center justify-center gap-0.5 text-[10px] text-[#826f66]">
                              {!availableAtSelectedTime ? (
                                <span className="font-semibold text-[#a93434]">Bận giờ này</span>
                              ) : therapist.servedCount > 0 ? (
                                <><Star size={9} className="fill-[#c64b32] text-[#c64b32]" /> {therapist.ratingAvg.toFixed(1)}</>
                              ) : <span className="font-semibold text-[#a85f29]">Mới</span>}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {eligibleTherapists.length === 0 ? (
                      <p className="mt-2 text-[11px] text-[#826f66]">
                        {selectedBranch?.label ?? "Cơ sở này"} đang cập nhật đội ngũ KTV cho dịch vụ này — hệ thống sẽ sắp xếp KTV phù hợp.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Step 3: Date & live availability */}
          <div className="rounded-xl border border-[#e7d6ca] bg-white p-3">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold tracking-tight">
              <Calendar size={16} /> 3. Chọn ngày và giờ
            </h2>

            <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {dateOptions.map((option) => {
                const value = format(option, "yyyy-MM-dd");
                const active = value === date;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setDate(value);
                      setSelectedSlotStartTime("");
                    }}
                    className={cn(
                      "flex w-16 shrink-0 flex-col items-center rounded-lg border py-2 text-center transition",
                      active ? "border-[#c64b32] bg-[#c64b32] text-white" : "border-[#e7d6ca] bg-white hover:border-[#c7a296]"
                    )}
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wide opacity-90" suppressHydrationWarning>
                      {isSameDay(option, new Date()) ? "Hôm nay" : format(option, "EEEEE", { locale: vi })}
                    </span>
                    <span className="mt-0.5 text-base font-bold" suppressHydrationWarning>
                      {format(option, "dd/MM")}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-2.5">
              <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-[#f8f4f0] px-2.5 py-2 text-[10px]">
                <span className="font-semibold text-[#68574f]">{selectedTherapist ? `Lịch của ${selectedTherapist.fullName}` : isGroupBooking ? `Năng lực cho nhóm ${totalPeople} người` : "Lịch còn nhận đặt"}</span>
                <span className="flex shrink-0 items-center gap-2 text-[#826f66]"><i className="h-2.5 w-2.5 rounded-sm bg-[#a85f29]" /> Rảnh <i className="h-2.5 w-2.5 rounded-sm bg-[#d34a4a]" /> Bận</span>
              </div>
              {loadingSlots ? (
                <div className="flex items-center gap-2 rounded-xl bg-[#fcf3ed] p-3 text-sm text-[#68574f]">
                  <Loader2 className="animate-spin" size={16} /> Đang đồng bộ lịch KTV và giường...
                </div>
              ) : slots.length === 0 ? (
                <div className="rounded-xl bg-[#fcf3ed] p-3 text-sm text-[#68574f]">Chưa có khung giờ phù hợp trong ngày này.</div>
              ) : (
                <div className="grid max-h-48 grid-cols-4 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-5">
                  {slots.map((item) => {
                    const requestedTherapistAvailable = !effectiveTherapistId
                      || item.availableTherapists.some((therapist) => therapist.id === effectiveTherapistId);
                    const canBook = item.isAvailable && item.remainingCapacity >= totalPeople && requestedTherapistAvailable;
                    const active = selectedSlotStartTime === item.startTime && canBook;
                    return (
                      <button
                        key={item.startTime}
                        type="button"
                        disabled={!canBook}
                        onClick={() => setSelectedSlotStartTime(item.startTime)}
                        className={cn(
                          "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-2 text-xs font-semibold transition",
                          active
                            ? "border-[#ad432f] bg-[#ad432f] text-white shadow-sm"
                            : canBook
                              ? "border-[#d2ad5d] bg-[#fff4e6] text-[#76551d] hover:border-[#ad432f]"
                              : "cursor-not-allowed border-[#efb5b2] bg-[#fff0ef] text-[#a93434] opacity-85"
                        )}
                      >
                        <span className="flex items-center gap-1"><Clock size={12} /> {item.startTime.slice(11, 16)}</span>
                        <span className={cn("text-[9px] font-medium", active ? "text-white/80" : "opacity-80")}>
                          {selectedTherapist && !isGroupBooking
                            ? (canBook ? "Rảnh" : "Bận")
                            : isGroupBooking
                              ? (canBook ? "Đủ chỗ cho nhóm" : "Không đủ chỗ cho nhóm")
                              : canBook
                                ? `${item.remainingCapacity} chỗ rảnh`
                                : "Đã kín"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="mt-2 text-center text-[10px] leading-4 text-[#7b6c65]">
                {isGroupBooking && selectedAvailabilitySlot?.isAvailable
                  ? selectedAvailabilitySlot.allocationMode === "SAME_ROOM"
                    ? "Khung giờ này có đủ KTV và giường phù hợp; hệ thống đang ưu tiên xếp cả nhóm chung một phòng."
                    : "Khung giờ này đủ KTV và giường phù hợp; do không còn một phòng đủ giường, lễ tân sẽ xếp các phòng gần nhau."
                  : "KTV và giường được kiểm tra trong toàn bộ thời lượng dịch vụ và thời gian chuẩn bị, nên chỉ hiện những khung giờ có thể phục vụ trọn vẹn."}
              </p>
            </div>
          </div>

          {/* Step 4: Customer info */}
          <div className="rounded-xl border border-[#e7d6ca] bg-white p-3">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold tracking-tight">
              <UserRound size={16} /> 4. Thông tin khách
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold">Tên hiển thị (hoặc biệt danh) <span className="text-[#c64b32]">*</span></span>
                <input
                  value={nickName}
                  onChange={(event) => setNameInput(event.target.value)}
                  placeholder="Ví dụ: Minh Anh"
                  className="mt-1.5 w-full rounded-lg border border-[#e7d6ca] px-3 py-2.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold">
                  Số điện thoại <span className="font-normal text-[#826f66]">(không bắt buộc)</span>
                </span>
                <input
                  value={phone}
                  onChange={(event) => setPhoneInput(event.target.value)}
                  inputMode="tel"
                  placeholder="Nhập số điện thoại..."
                  className="mt-1.5 w-full rounded-lg border border-[#e7d6ca] px-3 py-2.5 text-sm"
                />
              </label>
            </div>
            <p className="mt-1.5 text-[11px] leading-4 text-[#826f66]">Thông tin chỉ dùng để xác nhận đặt lịch. Tâm An cam kết không làm phiền quý khách qua sđt!</p>

            {memberships.length ? (
              <div className="mt-2.5 border-t border-[#eee0d6] pt-2.5">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Wallet size={16} className="text-[#76551d]" /> Dùng Gói dài hạn
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {memberships.map((item) => {
                    const serviceEligible = !item.serviceId || cart.every((line) => line.serviceId === item.serviceId);
                    const groupEligible = totalPeople === 1 || item.shareable;
                    const enoughSessions = item.availableSessions >= totalPeople;
                    const eligible = serviceEligible && groupEligible && enoughSessions;
                    const selected = selectedPackageId === item.id;
                    const reason = !serviceEligible
                      ? "Không áp dụng cho dịch vụ đã chọn"
                      : !groupEligible
                        ? "Gói chỉ dùng cho một khách"
                        : !enoughSessions
                          ? `Chỉ còn ${item.availableSessions} lượt khả dụng`
                          : `Còn ${item.availableSessions} lượt · HSD ${item.expiresAt}`;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="checkbox"
                        aria-checked={selected}
                        disabled={!eligible && !selected}
                        onClick={() => {
                          setSelectedPackageId(selected ? "" : item.id);
                          if (!selected) {
                            setVoucherCode("");
                            setVoucherOptOut(true);
                            setShowManualVoucher(false);
                          }
                          setError("");
                        }}
                        className={cn(
                          "flex items-start gap-2.5 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
                          selected ? "border-[#9f7428] bg-[#fff7df]" : "border-[#e7d6ca] bg-white hover:border-[#c7a296]",
                        )}
                      >
                        <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border", selected ? "border-[#9f7428] bg-[#9f7428] text-white" : "border-[#cdbdaf] bg-white")}>
                          {selected ? <Check size={14} /> : null}
                        </span>
                        <span className="min-w-0">
                          <strong className="block text-xs">{item.planName}</strong>
                          <span className="mt-1 block text-[10px] leading-4 text-[#826f66]">{reason}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {packageEligible ? <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-800">Lịch này sẽ giữ {totalPeople} lượt từ gói. Không áp dụng voucher, ưu đãi Affiliate và không phát sinh thanh toán thêm.</p> : null}
              </div>
            ) : null}

            <div className="mt-2.5 border-t border-[#eee0d6] pt-2.5">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Ticket size={16} className="text-[#c64b32]" /> Sổ voucher
              </p>
              <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
                {recommendedVouchers
                  .filter((item) => item.active
                    && item.code !== "AFF50"
                    && ((account?.totalVisits ?? 0) === 0 || item.code !== "FIRST60")
                    && !(item.code === "WELCOME150" && account && (!account.welcomeCreditAvailable || account.totalVisits > 0)))
                  .map((item) => {
                    const selected = effectiveVoucherCode === item.code;
                    const inventoryItem = voucherInventory[item.code];
                    const remaining = inventoryItem?.remaining ?? item.remaining;
                    const soldOut = remaining !== null && remaining <= 0;
                    const VIcon = item.type === "PERCENT" ? Percent : Tag;
                    return (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => {
                          setSelectedPackageId("");
                          setVoucherOptOut(selected);
                          setVoucherCode(selected ? "" : item.code);
                        }}
                        disabled={soldOut}
                        className={cn(
                          "flex w-56 shrink-0 items-start gap-2 rounded-lg border p-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
                          selected ? "border-[#c64b32] bg-[#f8ebe5]" : "border-[#e7d6ca] bg-white hover:border-[#c7a296]"
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                            selected ? "bg-[#c64b32] text-white" : "bg-[#f8ebe5] text-[#c64b32]"
                          )}
                        >
                          {selected ? <Check size={14} /> : <VIcon size={14} />}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">
                            {item.code} — {item.type === "PERCENT" ? `Giảm ${item.value}%` : `Giảm ${formatMoney(item.value)}`}
                          </span>
                          <span className="mt-0.5 block text-xs text-[#826f66]">{item.constraint}{soldOut ? " · Đã hết lượt" : ""}</span>
                        </span>
                      </button>
                    );
                  })}
              </div>
              <button
                type="button"
                onClick={() => setShowManualVoucher((value) => !value)}
                className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-[#c64b32]"
              >
                Nhập mã khác <ChevronDown size={14} className={cn("transition", showManualVoucher && "rotate-180")} />
              </button>
              {showManualVoucher ? (
                <input
                  value={voucherCode}
                  onChange={(event) => {
                    setSelectedPackageId("");
                    setVoucherOptOut(false);
                    setVoucherCode(event.target.value.toUpperCase());
                  }}
                  placeholder="Nhập mã voucher"
                  className="mt-2 w-full rounded-xl border border-[#e7d6ca] px-3 py-3"
                />
              ) : null}
              {voucherChecking ? (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#826f66]"><Loader2 size={12} className="animate-spin" /> Đang kiểm tra ưu đãi trên hệ thống...</p>
              ) : effectiveVoucherCode && !voucherPreview.valid ? (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2">
                  <p className="text-xs font-medium text-red-700">{voucherPreview.message || "Mã voucher không hợp lệ hoặc đã hết hạn."}</p>
                  <span className="flex shrink-0 items-center gap-2">
                    {attributionCode && effectiveVoucherCode === "WELCOME150" ? (
                      <Link href="/tai-khoan?returnTo=%2Fbooking" className="rounded-full bg-[#c64b32] px-3 py-1.5 text-[11px] font-semibold text-white">
                        Đăng nhập / tạo tài khoản
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setVoucherCode("");
                        setVoucherOptOut(true);
                        setError("");
                      }}
                      className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-[#c64b32] ring-1 ring-[#efc6c6]"
                    >
                      Bỏ mã & tiếp tục
                    </button>
                  </span>
                </div>
              ) : null}
              {effectiveVoucherCode && voucherPreview.valid && !voucherInStock ? (
                <p className="mt-2 text-xs font-medium text-red-600">Ưu đãi này đã hết lượt sử dụng.</p>
              ) : null}
            </div>

            <label className="mt-2.5 block border-t border-[#eee0d6] pt-2.5">
              <span className="text-sm font-semibold">{inviteContext ? "Ghi chú để cơ sở chủ động sắp xếp" : "Ghi chú"}</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ví dụ: thích lực nhẹ, đau cổ vai gáy..."
                className="mt-1.5 min-h-12 w-full rounded-lg border border-[#e7d6ca] px-3 py-2 text-sm"
              />
            </label>
          </div>

          {/* Step 5: Deposit */}
          <div className="rounded-xl border border-[#e7d6ca] bg-white p-3">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold tracking-tight">
              <Wallet size={16} /> 5. {packageEligible ? "Xác nhận dùng gói" : "Đặt cọc giữ chỗ"} {!packageEligible ? <span className="text-[11px] font-normal text-[#826f66]">(bắt buộc)</span> : null}
            </h2>
            <div className={cn("mt-2.5 flex items-start gap-2.5 rounded-lg border p-3", packageEligible ? "border-[#9f7428] bg-[#fff7df]" : "border-[#c64b32] bg-[#f8ebe5]")}>
              <ShieldCheck size={18} className={cn("mt-0.5 shrink-0", packageEligible ? "text-[#76551d]" : "text-[#c64b32]")} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{packageEligible ? selectedPackage?.planName : "Đặt cọc xác nhận giữ chỗ"}</span>
                {packageEligible ? <>
                  <span className="mt-0.5 block text-base font-bold text-[#76551d]">{totalPeople} lượt · Thanh toán thêm 0đ</span>
                  <span className="mt-1 block text-xs text-[#826f66]">Lượt được giữ khi bạn xác nhận lịch và chỉ trừ chính thức sau khi lễ tân hoàn tất dịch vụ.</span>
                </> : <>
                  <span className="mt-0.5 block text-base font-bold text-[#c64b32]">
                    {formatMoney(depositAmount)} <span className="text-xs font-normal text-[#826f66]">({catalog.depositPercent}% giá sau ưu đãi)</span>
                  </span>
                  <span className="mt-1 block text-xs text-[#826f66]">
                    Chuyển vào tài khoản nền tảng để giữ chỗ. Phần còn lại {formatMoney(amountDueAtBranch)} = giá cuối sau ưu đãi trừ tiền cọc, thanh toán riêng cho cơ sở sau dịch vụ.
                  </span>
                </>}
              </span>
            </div>
          </div>
        </section>

        <aside className="h-fit overflow-hidden rounded-2xl border border-[#e7d6ca] bg-white shadow-lg lg:sticky lg:top-[72px]">
          <div className="border-b border-dashed border-[#e7d6ca] bg-[#fcf3ed] p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#c64b32]">
              <Receipt size={13} /> Hoá đơn tạm tính
            </p>
            <p className="mt-1.5 text-xs leading-5 text-[#68574f]">
              {slot ? `${slot.startTime.slice(11, 16)} ngày ${slot.startTime.slice(8, 10)}/${slot.startTime.slice(5, 7)}` : "Chưa chọn giờ hẹn"}
              {isGroupBooking ? ` · Nhóm ${totalPeople} người` : ""}
            </p>
          </div>
          <div className="p-4">
            <div className="space-y-2 text-sm">
              {cartDetails.map((line) => (
                <div key={line.id} className="flex items-start justify-between gap-3 text-[#68574f]">
                  <span className="min-w-0">
                    {line.service.name}
                    {line.people > 1 ? ` x${line.people}` : ""}
                  </span>
                  <span className="shrink-0 font-semibold text-[#281b18]">
                    {formatMoney((line.service.basePrice + line.service.therapistFee) * line.people)}
                  </span>
                </div>
              ))}
              {voucherDiscount > 0 ? (
                <div className="flex items-center justify-between gap-3 font-medium text-[#a85f29]">
                  <span>Giảm ({voucherPreview.stackedCodes.length ? voucherPreview.stackedCodes.join(" + ") : effectiveVoucherCode})</span>
                  <span>-{formatMoney(voucherDiscount)}</span>
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-dashed border-[#e7d6ca] pt-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#826f66]">Tổng cộng</p>
              <p className="text-xl font-bold text-[#c64b32]">{formatMoney(total)}</p>
            </div>
            {depositActive ? (
              <div className="mt-3 space-y-1.5 rounded-xl bg-[#f8ebe5] p-3 text-sm">
                <div className="flex items-center justify-between gap-3 font-semibold text-[#c64b32]">
                  <span className="flex items-center gap-1.5">
                    <Wallet size={13} /> Cọc nền tảng · 10% giá sau ưu đãi
                  </span>
                  <span>{formatMoney(depositAmount)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-[#826f66]">
                  <span>Còn lại tại cơ sở · đã trừ ưu đãi</span>
                  <span>{formatMoney(amountDueAtBranch)}</span>
                </div>
              </div>
            ) : null}
            <p className="mt-2 text-center text-[11px] italic text-[#826f66]">{catalog.priceNote}</p>
          </div>
          <div className="px-4 pb-4">
            <label className="mb-3 flex cursor-pointer items-start gap-2.5 rounded-xl bg-[#fcf5ef] p-3 text-[11px] leading-5 text-[#5f514a] ring-1 ring-[#e7d6ca]">
              <input
                type="checkbox"
                checked={acceptPolicies}
                onChange={(event) => setAcceptPolicies(event.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-[#c64b32]"
              />
              <span>
                Tôi đồng ý với <Link href="/dieu-khoan" target="_blank" className="font-semibold text-[#c64b32] underline">Điều khoản</Link>,{" "}
                <Link href="/chinh-sach-rieng-tu" target="_blank" className="font-semibold text-[#c64b32] underline">Chính sách bảo vệ dữ liệu</Link> và{" "}
                <Link href="/chinh-sach-dat-lich" target="_blank" className="font-semibold text-[#c64b32] underline">Chính sách đặt lịch/đặt cọc</Link>.
              </span>
            </label>
            {error ? <div className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
            <button
              type="button"
              onClick={submitBooking}
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#b6403a] to-[#8b2b28] px-5 py-3 font-semibold text-white shadow-md shadow-black/20 ring-1 ring-white/10 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="animate-spin" size={18} /> : null}
              Đặt chỗ & nhận ưu đãi
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
