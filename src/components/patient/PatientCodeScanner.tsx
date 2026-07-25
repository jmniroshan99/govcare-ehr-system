import { Camera, CheckCircle2, Keyboard, ScanBarcode, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";

type ScanMode = "qr" | "barcode";

interface PatientCodeScannerProps {
  open: boolean;
  mode: ScanMode;
  onClose: () => void;
  onDetected: (value: string) => void;
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
  const [manualValue, setManualValue] = useState("");
  const [status, setStatus] = useState("Camera scanner is ready.");
  const [cameraEnabled, setCameraEnabled] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    let intervalId: number | undefined;

    async function startScanner() {
      setStatus("Requesting camera access...");
      setCameraEnabled(false);

      try {
        if (!window.isSecureContext) {
          setStatus("Camera access needs HTTPS or localhost/127.0.0.1. Open this page using localhost during development or deploy with HTTPS.");
          return;
        }

        if (!navigator.mediaDevices?.getUserMedia) {
          setStatus("Camera scanning is not supported in this browser. Enter the code manually.");
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
          setStatus("Camera is open. Live detection is unavailable here, so type the scanned value manually.");
          return;
        }

        const detector = new Detector({ formats: formats[mode] });
        setStatus(`${mode === "qr" ? "QR" : "Barcode"} scanner active. Hold the code inside the frame.`);
        intervalId = window.setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          const results = await detector.detect(videoRef.current);
          const code = results.find((result) => result.rawValue)?.rawValue;
          if (!code) return;
          onDetected(code);
          onClose();
        }, 700);
      } catch (error) {
        const name = error instanceof DOMException ? error.name : "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setStatus("Camera permission was denied. Click the browser lock icon, allow Camera permission, then reload this page.");
          return;
        }
        if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          setStatus("No camera device was found. Connect a webcam or enter the QR/barcode value manually.");
          return;
        }
        setStatus("Camera permission was blocked or unavailable. Enter the QR/barcode value manually.");
      }
    }

    void startScanner();

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [mode, onClose, onDetected, open]);

  if (!open) return null;

  function submitManualCode() {
    const code = manualValue.trim();
    if (!code) {
      setStatus("Enter a patient ID, QR value, barcode value, NIC, or ticket code.");
      return;
    }
    onDetected(code);
    setManualValue("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-2xl overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              {mode === "qr" ? <Camera className="h-5 w-5 text-primary" /> : <ScanBarcode className="h-5 w-5 text-primary" />}
              {mode === "qr" ? "QR patient scanner" : "Barcode patient scanner"}
            </span>
            <Button className="min-h-9 px-3 py-1.5" type="button" variant="outline" onClick={onClose}><X className="h-4 w-4" />Close</Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative overflow-hidden rounded-md border border-border bg-slate-950">
            <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-teal-300/90 shadow-[0_0_0_999px_rgba(15,23,42,0.35)]" />
            {!cameraEnabled && (
              <div className="absolute inset-0 grid place-items-center bg-slate-950/85 px-6 text-center text-sm font-medium text-white">
                <span>{status}</span>
              </div>
            )}
          </div>

          <p className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-950">{status}</p>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input value={manualValue} onChange={(event) => setManualValue(event.target.value)} placeholder="Manual code entry: PAT-2026-000001, NIC, barcode, QR value" />
            <Button type="button" onClick={submitManualCode}><CheckCircle2 className="h-4 w-4" />Use code</Button>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Keyboard className="h-4 w-4" />
            Manual entry is available for desktop devices, blocked camera permissions, or unsupported scanners.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
