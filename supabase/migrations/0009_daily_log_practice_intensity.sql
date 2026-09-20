-- ============================================================
-- Daily Logに「練習強度」を追加
--
-- これまでのDaily Logは睡眠・疲労度・痛み・自己採点など「結果としての体調」
-- しか記録しておらず、「どれだけ練習で追い込んだか」という負荷側の情報が
-- 欠けていた。ジュニアテニスの肘・肩などの使いすぎ障害は、練習負荷が急に
-- 増えたときに起きやすいとされるため、疲労度とセットで見られるようにする。
--
-- has_practice: その日に練習・試合をしたか（nullは本機能追加前の過去データ＝未記録を表す）
-- practice_intensity: 練習のきつさ（1〜10の主観的強度。いわゆるsession RPE的な指標）。
--   練習をしていない日はnullのままにする。
-- ============================================================

alter table daily_logs
  add column has_practice boolean,
  add column practice_intensity smallint check (practice_intensity between 1 and 10);

comment on column daily_logs.has_practice is 'その日に練習・試合をしたか。nullは本機能追加前の未記録データ';
comment on column daily_logs.practice_intensity is '練習のきつさ(1-10)。has_practice=trueの場合のみ入力される想定';
