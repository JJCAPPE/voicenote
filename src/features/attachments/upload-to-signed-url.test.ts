// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { uploadToSignedUrl } from "./upload-to-signed-url";

class FakeXMLHttpRequest {
  static instance: FakeXMLHttpRequest | null = null;

  readonly upload = {
    addEventListener: vi.fn(
      (
        _type: string,
        listener: (event: { lengthComputable: boolean; loaded: number; total: number }) => void,
      ) => {
        this.progressListener = listener;
      },
    ),
  };
  readonly setRequestHeader = vi.fn();
  readonly open = vi.fn();
  readonly listeners = new Map<string, () => void>();
  readonly send = vi.fn((body: FormData) => {
    this.body = body;
    this.status = 200;
    this.progressListener?.({
      lengthComputable: true,
      loaded: 4,
      total: 4,
    });
    this.listeners.get("load")?.();
  });
  status = 0;
  body: FormData | null = null;
  progressListener:
    | ((event: {
        lengthComputable: boolean;
        loaded: number;
        total: number;
      }) => void)
    | null = null;

  constructor() {
    FakeXMLHttpRequest.instance = this;
  }

  addEventListener(type: string, listener: () => void) {
    this.listeners.set(type, listener);
  }
}

describe("uploadToSignedUrl", () => {
  const originalRequest = globalThis.XMLHttpRequest;

  afterEach(() => {
    globalThis.XMLHttpRequest = originalRequest;
    FakeXMLHttpRequest.instance = null;
  });

  it("uses the signed URL with Supabase-compatible multipart form data", async () => {
    globalThis.XMLHttpRequest =
      FakeXMLHttpRequest as unknown as typeof XMLHttpRequest;
    const progress = vi.fn();
    const file = new File(["test"], "notes.txt", { type: "text/plain" });

    await uploadToSignedUrl("https://storage.example/signed", file, progress);

    const request = FakeXMLHttpRequest.instance;
    expect(request?.open).toHaveBeenCalledWith(
      "PUT",
      "https://storage.example/signed",
    );
    expect(request?.setRequestHeader).toHaveBeenCalledWith("x-upsert", "false");
    expect(request?.body).toBeInstanceOf(FormData);
    expect(request?.body?.get("cacheControl")).toBe("3600");
    expect((request?.body?.get("") as File).name).toBe("notes.txt");
    expect(progress).toHaveBeenLastCalledWith(100);
  });
});
