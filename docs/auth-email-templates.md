# 招待・パスワード再設定メールのテンプレートと確認項目

Supabase ダッシュボードに手作業で貼るための文書です（アプリのコードからは Supabase の設定を変更しません）。

## 前提

- リンク先は `/auth/confirm`（ボタンを押したときだけトークンを使う画面）。`{{ .ConfirmationURL }}` は使わない
  （メールのプレビューやセキュリティ製品の事前アクセスでトークンが消費されるため）。
- リンクには `token_hash` と `type` だけを入れる。`next` は付けない（無くても `/auth/set-password` に進む）。
- リンクが開けない人のために、メール本文に **確認コード（`{{ .Token }}`）** と **コード入力画面の URL** を必ず書く。
  - このプロジェクトのコードは現在 **8桁**（Authentication → Providers → Email → *Email OTP Length*）。
    文面では「6桁」と書かず「確認コード」と書く。コード入力画面は 6〜10 桁を受け付ける。
- 以前の形式のリンク（`&next=...` 付きなど）も、引き続き `/auth/confirm` で動く（後方互換）。

## Invite user（招待）

Authentication → Emails → Templates → **Invite user**

件名:

```
【t-log】アカウントの招待
```

本文:

```html
<p>t-log に招待されました。</p>
<p>下のボタンを押して、パスワードを設定してください。</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite"
     style="display:inline-block;padding:12px 24px;background:#0F2537;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:bold;">
    パスワードを設定する
  </a>
</p>

<p>ボタンが開けない場合は、Safari または Chrome で次の画面を開き、このメールアドレスと確認コードを入力してください。</p>
<p>
  コード入力画面: {{ .SiteURL }}/auth/code<br>
  確認コード: <strong style="font-size:20px;letter-spacing:4px;">{{ .Token }}</strong>
</p>

<p>リンクとコードは一度だけ使えます。期限が切れた場合は、スクールの管理者に再招待を依頼してください。</p>
<p>このメールに心当たりがない場合は、何もせずに削除してください。</p>
```

## Reset Password（パスワード再設定）

Authentication → Emails → Templates → **Reset Password**

件名:

```
【t-log】パスワードの再設定
```

本文:

```html
<p>t-log のパスワード再設定のご案内です。</p>
<p>下のボタンを押して、新しいパスワードを設定してください。</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery"
     style="display:inline-block;padding:12px 24px;background:#0F2537;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:bold;">
    パスワードを再設定する
  </a>
</p>

<p>ボタンが開けない場合は、Safari または Chrome で次の画面を開き、このメールアドレスと確認コードを入力してください。</p>
<p>
  コード入力画面: {{ .SiteURL }}/auth/code<br>
  確認コード: <strong style="font-size:20px;letter-spacing:4px;">{{ .Token }}</strong>
</p>

<p>リンクとコードは一度だけ使えます。期限が切れた場合は、スクールの管理者に再設定を依頼してください。</p>
<p>このメールに心当たりがない場合は、何もせずに削除してください（パスワードは変更されません）。</p>
```

## 確認チェックリスト

### Resend（送信サービス）

- [ ] **Click tracking がオフ**（オンだとリンクが Resend の中継 URL に書き換えられ、`token_hash` が壊れる・事前アクセスで消費される原因になる）
- [ ] **Open tracking がオフ**（トラッキング画像が迷惑メール判定の材料になるため）
- [ ] 送信元ドメインが Resend で Verified になっている
- [ ] DNS に **SPF**（Resend 指定の TXT）、**DKIM**（Resend 指定の CNAME/TXT）、**DMARC**（`_dmarc` の TXT。最低でも `v=DMARC1; p=none; rua=...`）がある
- [ ] Resend の Logs で、遅延（藤田さんのケース）や bounce・complaint が出ていないか

### Supabase Authentication

- [ ] **SMTP Settings**: Custom SMTP（Resend）が有効で、送信元アドレスが上の Verified ドメインのもの
- [ ] **Rate Limits**: 「Rate limit for sending emails」が運用に足りる値か（一斉招待で上限に当たると、後半の人にメールが届かない）
- [ ] **Rate Limits**: 「Rate limit for token verifications」が既定値のまま（コードの総当たり対策）
- [ ] **URL Configuration → Site URL** が本番の URL（`{{ .SiteURL }}` に入る値。ここが違うとリンクが別のサイトを指す）
- [ ] **URL Configuration → Redirect URLs** に本番の URL がある
- [ ] **Providers → Email**: *Email OTP Length*（現在 8）と *Email OTP Expiration*（リンクとコードの有効期限）を確認
- [ ] テンプレートの保存後、デモスクールのダミーアカウント（Gmail のプラスアドレス）宛てに1通だけ送り、
      リンクの URL が自サイトのドメインのまま（中継 URL に書き換わっていない）ことと、コードで `/auth/code` から進めることを確認

### 受け取る側への案内（必要に応じて）

- [ ] キャリアメール（docomo・au・SoftBank）の受信設定で、送信元ドメインを受信許可にしてもらう
- [ ] 届かない・開けない場合は、管理画面のユーザー詳細から「1回限りの登録リンクを作る」で本人に直接渡せる

## アプリ側の環境変数

| 変数 | 用途 | 既定 |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | 管理者が作る登録リンクのドメイン。未設定なら管理画面を開いているサイトの URL | 未設定 |
| `NEXT_PUBLIC_AUTH_LOG_ENABLED` | `1` で、リンク画面・コード画面の診断情報を `/api/auth-log` に送る | 未設定（送らない） |
| `AUTH_LOG_ENABLED` | `1` で、`/api/auth-log` が `auth_link_events` に保存する | 未設定（保存しない） |

`AUTH_LOG_ENABLED` / `NEXT_PUBLIC_AUTH_LOG_ENABLED` は、マイグレーション `0015_auth_link_events.sql` を本番に適用した後に設定する。
