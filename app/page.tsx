"use client";

import React from "react";

import dynamic from "next/dynamic";

const BlackHole = dynamic(() => import("../components/black-hole"), {
  ssr: false,
  loading: () => <div>Loading...</div>,
});

export default function Page() {
  return (
    <div className="w-full h-screen bg-black">
      <BlackHole />
    </div>
  );
}
