"use client";

import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Wraps an upload area so files can be dropped onto it as well as picked with
// a button. Shows a highlighted outline while a file is dragged over it.
export function FileDrop({
  onFiles,
  disabled,
  label,
  className,
  children,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  label: string; // shown while dragging, for example "Drop the file to upload it"
  className?: string;
  children: ReactNode;
}) {
  const [over, setOver] = useState(false);
  // dragenter/dragleave fire for every child element, so count them.
  const depth = useRef(0);

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  return (
    <div
      className={cn("relative rounded-xl", className)}
      onDragEnter={(e) => {
        if (disabled || !hasFiles(e)) return;
        e.preventDefault();
        depth.current++;
        setOver(true);
      }}
      onDragOver={(e) => {
        if (disabled || !hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      }}
      onDrop={(e) => {
        if (disabled || !hasFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(files);
      }}
    >
      {children}
      {over && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-xl border-2 border-dashed border-primary bg-card/90 text-sm font-semibold text-primary"
        >
          {label}
        </div>
      )}
    </div>
  );
}
