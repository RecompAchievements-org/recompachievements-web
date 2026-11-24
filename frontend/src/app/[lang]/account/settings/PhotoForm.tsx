"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { FormMessage } from "@/components/auth/FormParts";
import { ProfilePhoto } from "@/components/profile/ProfilePhoto";
import type { Messages } from "@/i18n/server";
import type { PlayerAvatar } from "@/lib/api/accounts";
import type { AuthError } from "@/lib/auth/forms";
import { deletePhotoAction, uploadPhotoAction } from "./actions";

const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];
const maxSide = 1024;
const maxUploadBytes = 900_000;

const encode = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

// Shrinks the picture in the browser so phone photos fit the upload limit. The server still checks it.
async function prepareImage(file: File): Promise<Blob | null> {
  if (!acceptedTypes.includes(file.type)) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    for (const quality of [0.9, 0.8, 0.7, 0.6]) {
      const webp = await encode(canvas, "image/webp", quality);
      const blob = webp?.type === "image/webp" ? webp : await encode(canvas, "image/jpeg", quality);
      if (blob && blob.size <= maxUploadBytes) return blob;
    }
  } catch {
    return null;
  }
  return null;
}

export function PhotoForm({
  avatar,
  muted,
  messages,
  errors,
  rulesHref,
}: {
  avatar: PlayerAvatar | null;
  muted: boolean;
  messages: Messages["auth"]["photo"];
  errors: Messages["auth"]["errors"];
  rulesHref: string;
}) {
  const fieldId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [rights, setRights] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const previewUrl = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );

  function showPreview(next: File | null) {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = next ? URL.createObjectURL(next) : null;
    setPreview(previewUrl.current);
  }

  function clearSelection() {
    setFile(null);
    showPreview(null);
    setRights(false);
  }

  function upload() {
    if (!file || !rights) return;
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const image = await prepareImage(file);
      if (!image) {
        setError("photo_invalid");
        return;
      }
      const form = new FormData();
      form.set("photo", image, "photo");
      form.set("rights", "true");
      const failure = await uploadPhotoAction(form);
      if (failure) {
        setError(failure);
        return;
      }
      clearSelection();
      setSaved(true);
    });
  }

  function remove() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const failure = await deletePhotoAction();
      if (failure) setError(failure);
    });
  }

  const secondary = "inline-flex min-h-11 items-center justify-center rounded-lg border border-border-strong bg-surface-raised px-5 font-semibold transition-colors hover:border-accent disabled:opacity-60";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- A local preview of the chosen file.
          <img src={preview} alt={messages.previewAlt} className="size-28 shrink-0 rounded-lg object-cover" />
        ) : (
          <ProfilePhoto avatar={avatar} variant="large" label={messages.currentAlt} className="size-28 rounded-lg" />
        )}
        <div className="flex w-full min-w-0 flex-col gap-3">
          {muted ? (
            <p className="text-sm text-gold">{messages.muted}</p>
          ) : (
            <>
              {/** The browser's own file button ignores the site language, so this label replaces it. **/}
              <input
                id={fieldId}
                type="file"
                accept={acceptedTypes.join(",")}
                onChange={(event) => {
                  setError(null);
                  setSaved(false);
                  const chosen = event.target.files?.[0] ?? null;
                  if (chosen) {
                    setFile(chosen);
                    showPreview(chosen);
                  } else clearSelection();
                }}
                className="peer sr-only"
              />
              <div className="flex min-w-0 flex-col gap-2 rounded-lg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent sm:flex-row sm:items-center sm:gap-3">
                <label
                  htmlFor={fieldId}
                  className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border-strong bg-surface-raised px-5 font-semibold transition-colors hover:border-accent"
                >
                  {avatar ? messages.replaceLabel : messages.chooseLabel}
                </label>
                <span className="min-w-0 truncate text-center text-sm text-muted sm:text-left">{file?.name ?? messages.noFile}</span>
              </div>
              <p className="text-sm text-subtle">{messages.hint}</p>
            </>
          )}
        </div>
      </div>

      {file && !muted && (
        <label className="flex items-start gap-3 text-sm text-muted">
          <input type="checkbox" checked={rights} onChange={(event) => setRights(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-accent" />
          <span>
            {messages.rightsBefore}{" "}
            <a href={rulesHref} target="_blank" rel="noopener noreferrer" className="text-accent underline hover:text-accent-strong">
              {messages.rulesLink}
            </a>
            {messages.rightsAfter}
          </span>
        </label>
      )}

      {error && <FormMessage message={errors[error]} />}
      {saved && <FormMessage tone="success" message={messages.saved} />}

      <div className="flex flex-col gap-3 sm:flex-row">
        {file && !muted && (
          <button
            type="button"
            disabled={!rights || pending}
            onClick={upload}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-5 font-semibold text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-60"
          >
            {pending ? messages.saving : messages.save}
          </button>
        )}
        {avatar && (
          <button type="button" disabled={pending} onClick={remove} className={secondary}>
            {messages.remove}
          </button>
        )}
      </div>
    </div>
  );
}
