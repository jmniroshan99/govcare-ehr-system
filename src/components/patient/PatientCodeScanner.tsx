import { Camera, CheckCircle2, Keyboard, LoaderCircle, ScanBarcode, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";

type ScanMode = "qr" | "barcode";

interface PatientCodeScannerProps {
  open: boolean;
  mode: ScanMode;
  onClose: () => void;
  onDetected: (value: string) => void | Promise<void>;
}

type BarcodeDetectorResult = { rawValue?: string; format?: string };
type BarcodeDetectorInstance = { detect: (source: HTMLVideoElement) => Promise<BarcodeDetectorResult[]> };
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;

const formats = {
  qr: ["qr_code"],
  barcode: ["code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "codabar"],
};

function getBarcodeDetector() {
  return (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
}

export function PatientCodeScanner({ open, mode, onClose, onDetected }: PatientCodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const detectionLockedRef = useRef(false);
  const [manualValue, setManualValue] = useState("");
  const [status, setStatus] = useState("Camera scanner is ready.");
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  useEffect(() => {
    if (!open) return undefined;

    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    detectionLockedRef.current = false;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      stopCamera();
      window.setTimeout(() => openerRef.current?.focus(), 0);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    let intervalId: number | undefined;

    async function submitDetectedCode(code: string) {
      if (detectionLockedRef.current) return;
      detectionLockedRef.current = true;
      setSubmitting(true);
      try {
        await onDetected(code);
        onClose();
      } catch (error) {
        detectionLockedRef.current = false;
        setStatus(error instanceof Error ? error.message : "The scanned patient could not be verified.");
      } finally {
        setSubmitting(false);
      }
    }

    async function startScanner() {
      setStatus("Requesting camera access...");
      setCameraEnabled(false);
      setInitializing(true);

      try {
        if (!window.isSecureContext) {
          setStatus("Camera access needs HTTPS or localhost/127.0.0.1. Enter the patient code manually.");
          manualInputRef.current?.focus();
          return;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          setStatus("Camera scanning is not supported in this browser. Enter the code manually.");
          manualInputRef.current?.focus();
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraEnabled(true);

        const Detector = getBarcodeDetector();
        if (!Detector) {
          setStatus("Camera is open, but live detection is unavailable. Use the manual patient-code field below.");
          manualInputRef.current?.focus();
          return;
        }

        const detector = new Detector({ formats: formats[mode] });
        setStatus(`${mode === "qr" ? "QR" : "Barcode"} scanner active. Hold the code inside the frame.`);
        intervalId = window.setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2 || detectionLockedRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            const code = results.find((result) => result.rawValue)?.rawValue?.trim();
            if (code) await submitDetectedCode(code);
          } catch {
            // A single detector frame can fail while the camera is moving; continue scanning.
          }
        }, 700);
      } catch (error) {
        const name = error instanceof DOMException ? error.name : "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setStatus("Camera permission was denied. Allow Camera permission or enter the patient code manually.");
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          setStatus("No camera device was found. Connect a webcam or enter the patient code manually.");
        } else {
          setStatus("Camera is unavailable. Enter the patient UUID, patient number, NIC, phone, or QR value manually.");
        }
        manualInputRef.current?.focus();
      } finally {
        setInitializing(false);
      }
    }

    void startScanner();

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
      stopCamera();
    };
  }, [mode, onClose, onDetected, open]);

  if (!open || typeof document === "undefined") return null;

  async function submitManualCode() {
    const code = manualValue.trim();
    if (!code) {
      setStatus("Enter a PostgreSQL patient UUID, patient number, NIC, passport, phone, QR value, or barcode value.");
      manualInputRef.current?.focus();
      return;
    }
    if (detectionLockedRef.current) return;
    detectionLockedRef.current = true;
    setSubmitting(true);
    try {
      await onDetected(code);
      setManualValue("");
      onClose();
    } catch (error) {
      detectionLockedRef.current = false;
      setStatus(error instanceof Error ? error.message : "The patient code could not be verified.");
      manualInputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="presentation">
      <button type="button" className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} aria-label="Close patient scanner" />
      <section
        className="relative z-10 w-full max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-scanner-title"
        onClick={(event) => event.stopPropagation()}
      >
        <Card className="overflow-hidden border-cyan-400/30 shadow-2xl">
          <CardHeader className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
            <CardTitle id="patient-scanner-title" className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                {mode === "qr" ? <Camera className="h-5 w-5 text-primary" /> : <ScanBarcode className="h-5 w-5 text-primary" />}
                {mode === "qr" ? "QR patient scanner" : "Barcode patient scanner"}
              </span>
              <Button className="min-h-9 px-3 py-1.5" type="button" variant="outline" onClick={onClose}>
                <X className="h-4 w-4" />Close
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="relative overflow-hidden rounded-md border border-border bg-slate-950">
              <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
              <div className="pointer-events-none absolute inset-[12%] rounded-lg border-2 border-teal-300/90 shadow-[0_0_0_999px_rgba(15,23,42,0.35)]" />
              {(!cameraEnabled || initializing) && (
                <div className="absolute inset-0 grid place-items-center bg-slate-950/88 px-6 text-center text-sm font-medium text-white">
                  <span className="flex flex-col items-center gap-3">
                    {initializing && <LoaderCircle className="h-6 w-6 animate-spin text-teal-300" />}
                    {status}
                  </span>
                </div>
              )}
            </div>

            <p className="rounded-md border border-cyan-300/40 bg-cyan-950/20 px-3 py-2 text-sm text-foreground">{status}</p>

            <div className="sticky bottom-0 grid gap-3 rounded-lg border border-border bg-card/95 p-3 backdrop-blur sm:grid-cols-[1fr_auto]">
              <Input
                ref={manualInputRef}
                value={manualValue}
                onChange={(event) => setManualValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void submitManualCode();
                }}
                placeholder="Patient UUID, PT/PAT number, NIC, passport, phone, QR value"
                autoComplete="off"
              />
              <Button type="button" onClick={() => void submitManualCode()} disabled={submitting}>
                {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {submitting ? "Verifying..." : "Use code"}
              </Button>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Keyboard className="h-4 w-4" />
              Manual entry remains available when FineCam, camera permission, or live detection is unavailable.
            </div>
          </CardContent>
        </Card>
      </section>
    </div>,
    document.body,
  );
}
