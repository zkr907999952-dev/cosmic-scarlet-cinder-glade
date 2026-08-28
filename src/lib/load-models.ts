import { useEffect, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three-stdlib";
import { useStudio } from "@/lib/studio-store";

export const MODEL_FILES = [
  { id: "character" as const, url: "/models/tifa.glb", bytes: 16_115_192, path: "/models/", hint: "角色" },
  { id: "intestines" as const, url: "/models/intestines.glb", bytes: 15_629_192, path: "/models/", hint: "大小肠" },
  { id: "pelvis" as const, url: "/models/pelvis.glb", bytes: 760_380, path: "/models/", hint: "盆腔" },
];

const TOTAL_BYTES = MODEL_FILES.reduce((s, f) => s + f.bytes, 0);

export type LoadedScenes = {
  character: THREE.Group;
  intestines: THREE.Group;
  pelvis: THREE.Group;
};

function formatMb(n: number) {
  return `${(n / 1_048_576).toFixed(1)} MB`;
}

function fetchBuffer(url: string, expected: number, onBytes: (loaded: number) => void) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.responseType = "arraybuffer";
    xhr.timeout = 180_000;
    xhr.onprogress = (e) => {
      const loaded = e.lengthComputable ? e.loaded : Math.min(expected, e.loaded);
      onBytes(loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
        onBytes((xhr.response as ArrayBuffer).byteLength);
        resolve(xhr.response as ArrayBuffer);
      } else {
        reject(new Error(`下载失败 (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("网络中断，模型没有下完"));
    xhr.ontimeout = () => reject(new Error("下载超时，请重试"));
    xhr.send();
  });
}

function parseGlb(data: ArrayBuffer, resourcePath: string) {
  return new Promise<THREE.Group>((resolve, reject) => {
    const loader = new GLTFLoader(new THREE.LoadingManager());
    loader.parse(
      data,
      resourcePath,
      (gltf) => resolve(gltf.scene),
      (err) => reject(err instanceof Error ? err : new Error("模型解析失败")),
    );
  });
}

export function useModelAssets(enabled: boolean): LoadedScenes | null {
  const [scenes, setScenes] = useState<LoadedScenes | null>(null);
  const retryNonce = useStudio((s) => s.retryNonce);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const received = [0, 0, 0];

    const bumpDownload = () => {
      const got = received[0] + received[1] + received[2];
      const pct = Math.min(86, Math.round((got / TOTAL_BYTES) * 86));
      useStudio.setState({
        loading: true,
        loadError: null,
        loadProgress: pct,
        loadHint: `下载 ${formatMb(got)} / ${formatMb(TOTAL_BYTES)}`,
      });
    };

    (async () => {
      try {
        useStudio.setState({
          loading: true,
          loadError: null,
          loadProgress: 1,
          loadHint: "开始下载模型",
        });
        setScenes(null);

        const buffers = await Promise.all(
          MODEL_FILES.map((file, i) =>
            fetchBuffer(
              retryNonce ? `${file.url}?r=${retryNonce}` : file.url,
              file.bytes,
              (n) => {
                if (cancelled) return;
                received[i] = n;
                bumpDownload();
              },
            ),
          ),
        );
        if (cancelled) return;

        useStudio.setState({ loadProgress: 88, loadHint: "解析角色" });
        const character = await parseGlb(buffers[0]!, MODEL_FILES[0]!.path);
        if (cancelled) return;
        useStudio.setState({ loadProgress: 93, loadHint: "解析大小肠" });
        const intestines = await parseGlb(buffers[1]!, MODEL_FILES[1]!.path);
        if (cancelled) return;
        useStudio.setState({ loadProgress: 96, loadHint: "解析盆腔器官" });
        const pelvis = await parseGlb(buffers[2]!, MODEL_FILES[2]!.path);
        if (cancelled) return;

        useStudio.setState({ loadProgress: 98, loadHint: "组装柔体" });
        setScenes({ character, intestines, pelvis });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "模型加载失败";
        useStudio.setState({
          loading: true,
          loadError: message,
          loadHint: "加载失败",
        });
        setScenes(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, retryNonce]);

  return scenes;
}
