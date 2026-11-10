"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// 製品紹介サイトの「操作デモ動画」の動画部分。
// - 画面に入ったら再生し、外れたら止める（IntersectionObserver）。
// - クリック／タップ／Enter／Space で再生と一時停止を切り替える。手動で止めたら、再び画面に入っても勝手に再生しない。
// - prefers-reduced-motion: reduce の場合は自動再生せず、標準の controls に任せる（独自の切り替え処理は付けない）。
// - preload="none" なので、再生するまで動画本体は読み込まない（ポスター画像だけ表示する）。

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const VISIBLE_THRESHOLD = 0.45;

function subscribeReducedMotion(onChange: () => void) {
  const mql = window.matchMedia(REDUCED_MOTION_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getReducedMotion() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

// サーバー描画（および hydration 中）では「動きを減らす設定ではない」として描画し、hydration 後に実際の値で描き直す
function getReducedMotionOnServer() {
  return false;
}

type Props = {
  src: string;
  poster: string;
  label: string;
};

export function DemoVideo({ src, poster, label }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const userPausedRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, getReducedMotionOnServer);

  // 再生状態を表示（ボタンのラベル）に反映する。標準の controls で操作された場合も含めて video のイベントから拾う
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    setPlaying(!video.paused);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, []);

  // 画面に入ったら再生、外れたら一時停止。動きを減らす設定のときは監視しない
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (reducedMotion) {
      // 自動再生中に設定が「動きを減らす」へ変わった場合は止める（以降の操作は標準の controls に任せる）
      if (!video.paused) video.pause();
      return;
    }

    // React は muted を属性ではなくプロパティで扱うため、自動再生の条件を満たすよう明示する
    video.muted = true;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting && entry.intersectionRatio >= VISIBLE_THRESHOLD) {
          if (userPausedRef.current) return;
          // 低電力モードなどで自動再生が拒否されても、エラーにしない
          video.play().catch(() => {});
        } else if (!video.paused) {
          video.pause();
        }
      },
      { threshold: VISIBLE_THRESHOLD },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [reducedMotion]);

  const toggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      userPausedRef.current = false;
      video.play().catch(() => {});
    } else {
      userPausedRef.current = true;
      video.pause();
    }
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggle();
      }
    },
    [toggle],
  );

  // 動きを減らす設定でなければ、動画を包む要素を「再生／一時停止のボタン」にする。
  // 動きを減らす設定のときは役割を外し、標準の controls だけで操作する。
  const buttonProps = reducedMotion
    ? {}
    : {
        role: "button",
        tabIndex: 0,
        "aria-label": playing ? `${label}を一時停止` : `${label}を再生`,
        onClick: toggle,
        onKeyDown,
      };

  return (
    <div
      {...buttonProps}
      data-demo-video-wrapper=""
      style={{
        width: "100%",
        maxWidth: 960,
        margin: "48px auto 0",
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: "0 12px 28px rgba(15,37,55,0.14)",
        background: "#0F2537",
        cursor: reducedMotion ? undefined : "pointer",
      }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        muted
        loop
        playsInline
        preload="none"
        controls={reducedMotion}
        width={1920}
        height={1080}
        aria-label={label}
        style={{ display: "block", width: "100%", height: "auto", aspectRatio: "16 / 9" }}
      />
    </div>
  );
}
