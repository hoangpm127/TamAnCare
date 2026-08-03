"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { campaigns } from "@/lib/demo-data";

export function CampaignChart() {
  const data = campaigns.map((campaign) => ({
    name: campaign.source.replace(" Ads", ""),
    bookings: campaign.bookings,
    completed: campaign.completed,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -24, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7d6ca" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="bookings" fill="#c64b32" radius={[4, 4, 0, 0]} />
          <Bar dataKey="completed" fill="#d9a441" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
