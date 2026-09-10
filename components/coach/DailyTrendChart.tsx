"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  LineController,
  Tooltip,
  Legend,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import type { DailyTrendPoint } from "@/lib/queries/player-detail";

// bar/lineを混在させる<Chart>コンポーネントでは、各データセットのtypeに対応する
// Controller（BarController/LineController）も明示的に登録しないと、実データが
// 1件でもある状態で描画しようとした瞬間に
// "bar" is not a registered controller. というランタイムエラーで落ちる
// （要素・スケールだけ登録しても足りない）。
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  LineController,
  Tooltip,
  Legend
);

export function DailyTrendChart({ points }: { points: DailyTrendPoint[] }) {
  if (points.length === 0) {
    return <p className="text-sm text-slate-400">直近30日のDaily Logがまだありません</p>;
  }

  const labels = points.map((p) => p.logDate.slice(5)); // "MM-DD"

  return (
    <Chart
      type="bar"
      data={{
        labels,
        datasets: [
          {
            type: "bar" as const,
            label: "睡眠時間(h)",
            data: points.map((p) => p.sleepHours),
            backgroundColor: "#10b981",
            yAxisID: "y",
            borderRadius: 4,
          },
          {
            type: "line" as const,
            label: "疲労度",
            data: points.map((p) => p.fatigueLevel),
            borderColor: "#f43f5e",
            backgroundColor: "#f43f5e",
            yAxisID: "y1",
            tension: 0.3,
          },
        ],
      }}
      options={{
        responsive: true,
        scales: {
          y: { position: "left", title: { display: true, text: "睡眠(h)" }, min: 0, max: 12 },
          y1: {
            position: "right",
            title: { display: true, text: "疲労度" },
            min: 0,
            max: 10,
            grid: { drawOnChartArea: false },
          },
        },
        plugins: { legend: { position: "bottom" } },
      }}
    />
  );
}
