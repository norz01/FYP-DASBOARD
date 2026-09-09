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

export function getClientToken() {
  if (typeof window === "undefined") return null;
  const tokenCookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith("ikmbToken="));
  if (!tokenCookie) return null;
  return tokenCookie.split("=")[1];
}