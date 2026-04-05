import React, { useRef, useState } from "react";
import { uploadExpose } from "../lib/uploadExpose";

type ExposeUploadButtonProps = {
  propertyId: string;
  onUploadSuccess?: () => void | Promise<void>;
};

export default function ExposeUploadButton({
  propertyId,
  onUploadSuccess,
}: ExposeUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const openFilePicker = () => {
    if (isUploading) return;

    console.log("[ExposeUploadButton] openFilePicker", { propertyId });
    fileInputRef.current?.click();
  };

  const resetInput = (input: HTMLInputElement) => {
    input.value = "";
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const input = event.target;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (file.type !== "application/pdf") {
      alert("Bitte nur PDF-Dateien hochladen.");
      resetInput(input);
      return;
    }

    setIsUploading(true);

    try {
      console.log("[ExposeUploadButton] upload start", {
        propertyId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });

      const result = await uploadExpose(propertyId, file);

      console.log("[ExposeUploadButton] upload success", result);

      if (onUploadSuccess) {
        await onUploadSuccess();
      }

      alert("Exposé erfolgreich hochgeladen.");
    } catch (error) {
      console.error("[ExposeUploadButton] upload failed", error);

      const message =
        error instanceof Error
          ? error.message
          : "Beim Hochladen ist ein unbekannter Fehler aufgetreten.";

      alert(message);
    } finally {
      setIsUploading(false);
      resetInput(input);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      <button
        type="button"
        onClick={openFilePicker}
        disabled={isUploading}
        style={{
          padding: "6px 12px",
          borderRadius: "8px",
          border: "1px solid #ccc",
          backgroundColor: isUploading ? "#f3f4f6" : "#ffffff",
          color: "#111827",
          cursor: isUploading ? "not-allowed" : "pointer",
          fontSize: "14px",
          fontWeight: 500,
          opacity: isUploading ? 0.7 : 1,
          transition: "all 0.2s ease",
        }}
      >
        {isUploading ? "Lade hoch..." : "PDF hochladen"}
      </button>
    </>
  );
}