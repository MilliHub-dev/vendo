"use client";

import { ImagePlus, Trash2, Upload } from "lucide-react";
import { useId, useRef, useState, type DragEvent, type ReactNode } from "react";

import { useUploadImage } from "@/api/queries";
import type { ImageKind } from "@/api/types";
import { imageSizes, prepareImage } from "@/lib/image";

import { Button } from "./ui";

type Props = {
  kind: ImageKind;
  label: string;
  hint: string;
  /** current picture, if any */
  value?: string;
  /** called with the uploaded picture's URL, or null when it's removed */
  onChange: (url: string | null) => void;
  /** shown in the preview box when there is no picture */
  placeholder?: ReactNode;
};

/** Choose, replace or remove a picture: click or drag a file in. The picture is shrunk, uploaded, then previewed. */
export function ImagePicker({ kind, label, hint, value, onChange, placeholder }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadImage();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  async function choose(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const [w, h] = imageSizes[kind];
      const blob = await prepareImage(file, w, h);
      onChange(await upload.mutateAsync({ file: blob, kind }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That picture couldn’t be uploaded");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = ""; // let the same file be chosen again
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    choose(e.dataTransfer.files[0]);
  };

  return (
    <div className="field">
      <span className="label" id={`${id}-label`}>
        {label}
      </span>
      <div className={`image-picker image-picker--${kind}`} data-dragging={dragging} onDragOver={(e) => (e.preventDefault(), setDragging(true))} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
        <button type="button" className="image-picker__preview" aria-labelledby={`${id}-label`} aria-describedby={`${id}-hint`} disabled={busy} onClick={() => input.current?.click()}>
          {value ? <img src={value} alt="" /> : (placeholder ?? <ImagePlus aria-hidden />)}
          {busy ? (
            <span className="image-picker__busy">
              <span className="spinner" aria-hidden /> Uploading…
            </span>
          ) : null}
        </button>
        <div className="image-picker__side">
          <div className="wrap">
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => input.current?.click()}>
              <Upload /> {value ? "Replace" : "Upload"}
            </Button>
            {value ? (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => onChange(null)}>
                <Trash2 /> Remove
              </Button>
            ) : null}
          </div>
          <span className="field__hint" id={`${id}-hint`}>
            {hint}
          </span>
          {error ? (
            <span className="field__error" role="alert">
              {error}
            </span>
          ) : null}
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => choose(e.target.files?.[0])} />
      </div>
    </div>
  );
}
