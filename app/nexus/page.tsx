"use client";

import dynamic from "next/dynamic";

// NexusShell uses dynamic(globe) internally; we still ssr:false this shell
// to keep localStorage + window access safe.
const NexusShell = dynamic(() => import("./NexusShell"), { ssr: false });

export default function NexusPage() {
  return <NexusShell />;
}
