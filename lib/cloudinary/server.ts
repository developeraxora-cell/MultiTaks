import "server-only";

import { createHash } from "node:crypto";

type CloudinaryUploadResponse = {
  secure_url: string;
  public_id: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
};

type CloudinaryErrorResponse = {
  error?: {
    message?: string;
  };
};

export type UploadedImage = {
  url: string;
  publicId: string;
  metadata: {
    width: number | null;
    height: number | null;
    format: string | null;
    bytes: number | null;
    provider: "cloudinary";
  };
};

function cloudinaryConfig() {
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME?.trim() ?? "",
    apiKey: process.env.CLOUDINARY_API_KEY?.trim() ?? "",
    apiSecret: process.env.CLOUDINARY_API_SECRET?.trim() ?? "",
    folder: process.env.CLOUDINARY_MEAL_FOLDER?.trim() || "nutrition/meals",
  };
}

export function isCloudinaryConfigured() {
  const cfg = cloudinaryConfig();
  return Boolean(cfg.cloudName && cfg.apiKey && cfg.apiSecret);
}

function assertCloudinaryConfig() {
  const cfg = cloudinaryConfig();
  if (!cfg.cloudName || !cfg.apiKey || !cfg.apiSecret) {
    throw new Error(
      "Faltan credenciales de Cloudinary: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET",
    );
  }
  return cfg;
}

function signParams(params: Record<string, string | number | boolean | undefined>, apiSecret: string) {
  const payload = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return createHash("sha1").update(`${payload}${apiSecret}`).digest("hex");
}

function sanitizePublicIdPart(value: string) {
  return value
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function uploadMealImageToCloudinary(input: {
  buffer: Buffer;
  mime: string;
  userId: string;
  fileName: string;
}): Promise<UploadedImage> {
  const cfg = assertCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `${cfg.folder}/${input.userId}`;
  const publicId = `${timestamp}-${sanitizePublicIdPart(input.fileName || "meal")}`;
  const params = { folder, public_id: publicId, timestamp };
  const signature = signParams(params, cfg.apiSecret);

  const arrayBuffer = new ArrayBuffer(input.buffer.byteLength);
  new Uint8Array(arrayBuffer).set(input.buffer);

  const body = new FormData();
  body.set("file", new Blob([arrayBuffer], { type: input.mime }), input.fileName || "meal.jpg");
  body.set("api_key", cfg.apiKey);
  body.set("timestamp", String(timestamp));
  body.set("folder", folder);
  body.set("public_id", publicId);
  body.set("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`, {
    method: "POST",
    body,
  });
  const json = (await response.json()) as CloudinaryUploadResponse & CloudinaryErrorResponse;

  if (!response.ok) {
    throw new Error(`No se pudo subir la imagen a Cloudinary: ${json.error?.message ?? response.statusText}`);
  }

  return {
    url: json.secure_url,
    publicId: json.public_id,
    metadata: {
      width: json.width ?? null,
      height: json.height ?? null,
      format: json.format ?? null,
      bytes: json.bytes ?? null,
      provider: "cloudinary",
    },
  };
}

export async function deleteCloudinaryImage(publicId: string): Promise<void> {
  if (!publicId || !isCloudinaryConfigured()) return;

  const cfg = assertCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { invalidate: true, public_id: publicId, timestamp };
  const signature = signParams(params, cfg.apiSecret);

  const body = new FormData();
  body.set("api_key", cfg.apiKey);
  body.set("timestamp", String(timestamp));
  body.set("public_id", publicId);
  body.set("invalidate", "true");
  body.set("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/destroy`, {
    method: "POST",
    body,
  });
  const json = (await response.json()) as CloudinaryErrorResponse;

  if (!response.ok) {
    throw new Error(`No se pudo borrar la imagen de Cloudinary: ${json.error?.message ?? response.statusText}`);
  }
}
