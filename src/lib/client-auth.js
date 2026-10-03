"use client";

export function getClientUser() {
  if (typeof window === "undefined") return null;

  const userCookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith("user="));

  if (!userCookie) return null;

  try {
    return JSON.parse(decodeURIComponent(userCookie.split("=")[1]));
  } catch {
    return null;
  }
}

// Token is now httpOnly and cannot be read by JavaScript.
// The Next.js proxy will inject the real token automatically.
export function getClientToken() {
  return "proxy-handled";
}