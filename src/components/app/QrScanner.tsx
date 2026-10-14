import { useEffect, useRef, useState } from "react";
import { Camera, ImageUp, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** Extract the login token from a scanned value (full /qr?t= URL or the raw token). */
export function tokenFromScan(value: string): string {
  const v = value.trim();
  try {
    const u = new URL(v);
    return u.searchParams.get("t") ?? "";
  } catch {
    return /^[A-Za-z0-9]{20,}$/.test(v) ? v : "";
  }
}

async function decode(data: ImageData): Promise<string | null> {
  const jsQR = (await import("jsqr")).default;
  return jsQR(data.data, data.width, data.height)?.data ?? null;
}

export function QrScanner({ open, onOpenChange, onToken }: { open: boolean; onOpenChange: (o: boolean) => void; onToken: (t: string) => void }) {
  const [mode, setMode] = useState<"choose" | "camera">("choose");
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setMode("choose");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (mode !== "camera" || !open) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const v = videoRef.current;
        if (!v || stopped) return;
        v.srcObject = stream;
        await v.play();
        const tick = async () => {
          if (stopped) return;
          if (v.videoWidth && ctx) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0);
            const text = await decode(ctx.getImageData(0, 0, canvas.width, canvas.height));
            const t = text ? tokenFromScan(text) : "";
            if (t) {
              stopped = true;
              onToken(t);
              return;
            }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setError("تعذر فتح الكاميرا. اسمح بالوصول إليها أو ارفع صورة للرمز.");
        setMode("choose");
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [mode, open, onToken]);

  async function fromFile(file: File) {
    setError(null);
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode().catch(() => null);
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height, 1));
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(img.src);
    const text = await decode(ctx.getImageData(0, 0, canvas.width, canvas.height));
    const t = text ? tokenFromScan(text) : "";
    if (t) onToken(t);
    else setError("لم يُعثر على رمز دخول صالح في الصورة.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader><DialogTitle>قراءة الباركود</DialogTitle></DialogHeader>
        {mode === "camera" ? (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-lg bg-muted">
              <video ref={videoRef} playsInline muted className="aspect-square w-full object-cover" />
              <div className="pointer-events-none absolute inset-10 rounded-xl border-4 border-primary/70" />
            </div>
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> وجّه الكاميرا نحو رمز QR</p>
            <Button variant="outline" className="w-full" onClick={() => setMode("choose")}>رجوع</Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Button variant="outline" className="h-28 flex-col gap-2" onClick={() => setMode("camera")}>
              <Camera className="h-8 w-8 text-primary" /> فتح الكاميرا
            </Button>
            <Button variant="outline" className="h-28 flex-col gap-2" onClick={() => fileRef.current?.click()}>
              <ImageUp className="h-8 w-8 text-primary" /> رفع صورة
            </Button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) fromFile(f); e.target.value = ""; }} />
          </div>
        )}
        {error && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
