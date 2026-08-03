"use client";

import { useEffect, useRef, useState } from "react";

type BarcodeDetectorResult = { rawValue: string };
type BarcodeDetectorLike = { detect: (source: CanvasImageSource) => Promise<BarcodeDetectorResult[]> };
type BarcodeDetectorCtor = new (options: { formats: string[] }) => BarcodeDetectorLike;

export function QrScanner({ onScanned }: { onScanned: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"starting" | "scanning" | "denied">("starting");
  const onScannedRef = useRef(onScanned);

  useEffect(() => {
    onScannedRef.current = onScanned;
  });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let rafId = 0;
    let cancelled = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("scanning");

        const DetectorCtor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
        if (!DetectorCtor) return;
        const detector = new DetectorCtor({ formats: ["qr_code"] });

        const loop = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              onScannedRef.current(codes[0].rawValue);
              return;
            }
          } catch {
            // giữ nguyên vòng quét, bỏ qua lỗi decode nhất thời
          }
          rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
      } catch {
        if (!cancelled) setStatus("denied");
      }
    }

    start();
    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[64%] -translate-x-1/2 -translate-y-1/2">
        <span className="absolute left-0 top-0 h-9 w-9 rounded-tl-2xl border-l-[3px] border-t-[3px] border-white" />
        <span className="absolute right-0 top-0 h-9 w-9 rounded-tr-2xl border-r-[3px] border-t-[3px] border-white" />
        <span className="absolute bottom-0 left-0 h-9 w-9 rounded-bl-2xl border-b-[3px] border-l-[3px] border-white" />
        <span className="absolute bottom-0 right-0 h-9 w-9 rounded-br-2xl border-b-[3px] border-r-[3px] border-white" />
        <span className="absolute left-[10%] right-[10%] top-1/2 h-0.5 -translate-y-1/2 bg-gradient-to-r from-transparent via-[#f5d982] to-transparent shadow-[0_0_10px_rgba(245,217,130,0.9)]" />
        <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#9f1d20] shadow-[0_0_0_5px_rgba(255,255,255,0.12)]" />
      </div>
      {status === "starting" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-xs text-white">Đang mở camera...</div>
      ) : null}
      {status === "denied" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/85 p-4 text-center text-xs leading-5 text-white">
          Không thể mở camera. Vui lòng cấp quyền camera cho trình duyệt hoặc dùng xác nhận thủ công bên dưới.
        </div>
      ) : null}
    </div>
  );
}
