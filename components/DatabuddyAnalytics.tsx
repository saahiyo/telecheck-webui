"use client";

import { Databuddy } from "@databuddy/sdk/react";

export default function DatabuddyAnalytics() {
  const clientId = process.env.NEXT_PUBLIC_DATABUDDY_CLIENT_ID;

  if (!clientId) {
    return null;
  }

  return <Databuddy clientId={clientId} trackWebVitals trackErrors />;
}
