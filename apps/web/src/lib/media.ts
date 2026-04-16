export async function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function extractVideoFrame(videoSrc: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");

    video.src = videoSrc;
    video.muted = true;
    video.playsInline = true;

    video.addEventListener(
      "loadeddata",
      () => {
        const seekTo = Math.min(1, Math.max(video.duration / 2, 0));
        video.currentTime = Number.isFinite(seekTo) ? seekTo : 1;
      },
      { once: true }
    );

    video.addEventListener(
      "seeked",
      () => {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("Canvas context is not available"));
          return;
        }

        context.drawImage(video, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.8).split(",")[1] || "");
      },
      { once: true }
    );

    video.addEventListener(
      "error",
      () => reject(new Error("Could not load video for frame extraction")),
      { once: true }
    );
  });
}
