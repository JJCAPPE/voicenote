export function uploadToSignedUrl(
  signedUrl: string,
  file: File,
  onProgress: (percentage: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", signedUrl);
    request.setRequestHeader("x-upsert", "false");
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file);

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
        return;
      }

      reject(new Error(`Upload failed with status ${request.status}`));
    });
    request.addEventListener("error", () => {
      reject(new Error("The upload connection failed."));
    });
    request.addEventListener("abort", () => {
      reject(new Error("The upload was cancelled."));
    });
    request.send(body);
  });
}
