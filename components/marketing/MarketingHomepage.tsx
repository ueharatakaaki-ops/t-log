"use client";

import { useEffect, useRef } from "react";
import { MARKETING_STYLES, MARKETING_BODY_HTML } from "@/lib/marketing/homepage-content";

// 未ログイン・かつ認証リンク（招待/パスワード再設定）経由でもない状態で
// トップページ（"/"）に来た訪問者向けに表示する、製品紹介サイト。
// 中身はDesign Canvas Artifactで作成したデザインをそのまま移植したもの
// （lib/marketing/homepage-content.ts）。フォームの実際の送信処理だけ、
// ここでvanilla DOM操作により後付けしている。
export function MarketingHomepage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const form = root.querySelector<HTMLFormElement>("#contact-form");
    const submitButton = root.querySelector<HTMLButtonElement>("#contact-submit");
    const statusEl = root.querySelector<HTMLParagraphElement>("#contact-status");
    if (!form || !submitButton || !statusEl) return;

    function setStatus(message: string, color: string) {
      if (!statusEl) return;
      statusEl.textContent = message;
      statusEl.style.color = color;
      statusEl.style.display = "block";
    }

    async function handleSubmit() {
      if (!form || !submitButton) return;

      const name = (form.querySelector<HTMLInputElement>("#c-name")?.value ?? "").trim();
      const organizationName = (form.querySelector<HTMLInputElement>("#c-school")?.value ?? "").trim();
      const email = (form.querySelector<HTMLInputElement>("#c-email")?.value ?? "").trim();
      const message = (form.querySelector<HTMLTextAreaElement>("#c-message")?.value ?? "").trim();
      const honeypot = form.querySelector<HTMLInputElement>("#c-hp")?.value ?? "";

      if (!name || !organizationName || !email || !message) {
        setStatus("すべての項目を入力してください。", "#DC2626");
        return;
      }

      submitButton.disabled = true;
      const originalText = submitButton.textContent;
      submitButton.textContent = "送信中...";
      setStatus("", "#64748B");
      statusEl.style.display = "none";

      try {
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, organizationName, email, message, honeypot }),
        });
        const data = await res.json();

        if (res.ok && data.ok) {
          form.reset();
          setStatus("お問い合わせを送信しました。ご連絡ありがとうございます。", "#00763F");
        } else {
          setStatus(data.error ?? "送信に失敗しました。時間をおいて再度お試しください。", "#DC2626");
        }
      } catch {
        setStatus("送信に失敗しました。時間をおいて再度お試しください。", "#DC2626");
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    }

    submitButton.addEventListener("click", handleSubmit);
    return () => submitButton.removeEventListener("click", handleSubmit);
  }, []);

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap"
      />
      <style>{MARKETING_STYLES}</style>
      <div ref={containerRef} dangerouslySetInnerHTML={{ __html: MARKETING_BODY_HTML }} />
    </>
  );
}
