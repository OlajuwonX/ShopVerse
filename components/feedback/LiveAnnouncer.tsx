"use client";

import { useEffect, useState } from "react";

import { subscribeToAnnouncements } from "@/components/feedback/announcer";

const CLEAR_AFTER_MS = 5000;

export function LiveAnnouncer() {
  const [message, setMessage] = useState("");

  useEffect(() => subscribeToAnnouncements(setMessage), []);

  useEffect(() => {
    if (message === "") {
      return;
    }

    const timer = setTimeout(() => {
      setMessage("");
    }, CLEAR_AFTER_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [message]);

  return (
    <p aria-atomic="true" aria-live="polite" className="sr-only">
      {message}
    </p>
  );
}
