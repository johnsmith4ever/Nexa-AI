// ImageAttach — redesigned with round icon button and glassy thumbnails.
"use client";
import { useEffect, useRef } from "react";

const MAX_IMAGES = 4;
const MAX_SIZE = 1600;

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read image."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Unable to process image."));
      image.onload = () => {
        const scale = Math.min(1, MAX_SIZE / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width  = Math.max(1, Math.round(image.width  * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Unable to process image."));
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

type Props = {
  images: string[]; enabled: boolean; disabledReason?: string;
  onChange: (imgs: string[]) => void; onWarning: (w: string) => void;
};

export default function ImageAttach({ images, enabled, disabledReason, onChange, onWarning }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function addFiles(files: File[]) {
    if (!enabled) { onWarning(disabledReason ?? "The selected model does not support images."); return; }
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) return onWarning("You can attach up to 4 images.");
    const selected = files.filter(f => f.type.startsWith("image/")).slice(0, remaining);
    if (!selected.length) return onWarning("Please select an image file.");
    try {
      const converted = await Promise.all(selected.map(resizeImage));
      onChange([...images, ...converted].slice(0, MAX_IMAGES));
      onWarning("");
    } catch {
      onWarning("One of the images could not be processed.");
    }
  }

  useEffect(() => {
    function onPaste(e: ClipboardEvent) { if (!enabled) return; const files = Array.from(e.clipboardData?.files ?? []); if (files.length) void addFiles(files); }
    function onDrop(e: DragEvent) { if (!enabled) return; const files = Array.from(e.dataTransfer?.files ?? []); if (!files.length) return; e.preventDefault(); void addFiles(files); }
    function onDragOver(e: DragEvent) { if (enabled && e.dataTransfer?.types.includes("Files")) e.preventDefault(); }
    window.addEventListener("paste", onPaste);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragover", onDragOver);
    return () => { window.removeEventListener("paste", onPaste); window.removeEventListener("drop", onDrop); window.removeEventListener("dragover", onDragOver); };
  });

  return (
    <>
      {/* Thumbnails */}
      {images.length > 0 && (
        <div style={{ display:"flex",gap:8,padding:"8px 10px 0",flexWrap:"wrap" }}>
          {images.map((src, i) => (
            <div
              key={`${src}-${i}`}
              className="group"
              style={{ position:"relative",width:56,height:56,borderRadius:"var(--radius-md)",overflow:"hidden",border:"1px solid var(--border-subtle)",flexShrink:0 }}
            >
              <img src={src} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
              <button
                type="button"
                onClick={() => onChange(images.filter((_,j) => j !== i))}
                style={{
                  position:"absolute",top:3,right:3,width:18,height:18,borderRadius:"50%",
                  border:"none",background:"rgba(0,0,0,0.7)",color:"#fff",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:11,cursor:"pointer",opacity:0,transition:"opacity 150ms",
                }}
                className="group-hover:opacity-100"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={e => { void addFiles(Array.from(e.target.files ?? [])); e.currentTarget.value = ""; }}
      />

      {/* Attach icon button — lives in the bottom-left of the composer but is rendered inline here;
          we expose it via a small pill button inside the bottom toolbar of the parent */}
      <button
        type="button"
        disabled={!enabled}
        onClick={() => inputRef.current?.click()}
        title={enabled ? "Attach images" : disabledReason}
        aria-label="Attach images"
        style={{
          alignItems:"center",justifyContent:"center",
          width:32,height:32,borderRadius:"50%",border:"none",
          background:"transparent",
          color:"var(--text-muted)",cursor:enabled?"pointer":"not-allowed",
          opacity:enabled?1:0.3,
          transition:"background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)",
          position:"absolute",  // pulled out of flow so it sits inside the bottom bar
          display:"none",       // hidden — the Composer renders the attach area; thumbnails above are enough
        }}
      >
        <svg viewBox="0 0 24 24" style={{width:15,height:15}} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      </button>
    </>
  );
}
