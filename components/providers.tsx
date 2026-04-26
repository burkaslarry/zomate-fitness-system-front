"use client";

import { ReactNode } from "react";
import { DemoStateProvider } from "../lib/demo-state";

export default function Providers({ children }: { children: ReactNode }) {
  return <DemoStateProvider>{children}</DemoStateProvider>;
}
