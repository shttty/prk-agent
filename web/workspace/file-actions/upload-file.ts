import { readJsonResponse } from "../../workbench/store/requests/read-json-response.js";

export function uploadFile(url: string, file: File, onProgress: (loaded: number) => void) {
  return new Promise<unknown>((resolve, reject) => {
    // XHR sends the File directly and reports browser upload bytes without buffering it in JS.
    const request = new XMLHttpRequest();
    request.upload.addEventListener("progress", ({ loaded }) => onProgress(loaded));
    request.addEventListener("load", () => {
      try { resolve(readJsonResponse(request.responseText, request.status)); }
      catch (error) { reject(error); }
    });
    request.addEventListener("error", () => reject(new Error("上传连接中断。请检查目标文件后再试。")));
    request.addEventListener("abort", () => reject(new Error("上传已取消。")));
    request.open("POST", url);
    request.setRequestHeader("Content-Type", "application/octet-stream");
    request.send(file);
  });
}
