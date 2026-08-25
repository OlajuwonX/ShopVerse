"use client";

import { useState } from "react";

import { CHECKOUT_ATTEMPT_KEY } from "@/constants/checkout";

function readStoredAttempt() {
  try {
    return window.sessionStorage.getItem(CHECKOUT_ATTEMPT_KEY);
  } catch {
    return null;
  }
}

function persistAttempt(value: string) {
  try {
    window.sessionStorage.setItem(CHECKOUT_ATTEMPT_KEY, value);
  } catch {
    return;
  }
}

function createAttemptId() {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = readStoredAttempt();

  if (existing !== null && existing.length > 0) {
    return existing;
  }

  const created = window.crypto.randomUUID();

  persistAttempt(created);

  return created;
}

export function clearCheckoutAttempt() {
  try {
    window.sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY);
  } catch {
    return;
  }
}

export function useCheckoutAttempt() {
  const [attemptId] = useState(createAttemptId);

  return attemptId;
}
