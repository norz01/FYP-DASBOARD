import React from "react";
import "@testing-library/jest-dom";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudentDashboardClient from "@/components/dashboard/StudentDashboardClient";
import JobCard from "@/components/JobCard";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/image", () => ({ default: (props) => <img {...props} alt={props.alt || ""} /> }));
vi.mock("@/app/actions", () => ({ logoutAction: vi.fn() }));
vi.mock("@/lib/client-auth", () => ({ getClientUser: () => ({ role: "user", studentId: "S1", displayName: "Test Student" }), getClientToken: () => "proxy-handled" }));
vi.mock("react-chartjs-2", () => ({ Radar: () => <div aria-label="Radar chart" /> }));

const student = { id: "S1", nama: "Test Student", kursus: "ITW", cgpa: 3, attendance: 90, dropoutRisk: "Sederhana", uploadedCertificates: [] };
const job = { jobId: "J1", title: "Welder Intern", company: "Test Employer", location: "Terengganu", salary: "RM 1,000+", applyLink: "https://example.com/apply", source: "Test Jobs" };
const pathway = {
  supported: true, courseName: "Diploma Kompetensi Kimpalan", readinessScore: 74, readinessExplanation: "Indeks panduan akademik.", targetRoles: ["Welder / Fabricator"],
  actionPlan: [{ title: "Sediakan portfolio", description: "Kumpulkan projek kimpalan anda." }], recommendedCertifications: ["TWIMC"],
  suggestedSearches: [{ label: "Oil & Gas Welder", q: "Pipe Welder NDT Intern", location: "Terengganu", employmentType: "INTERN" }],
};
const response = (body, ok = true) => ({ ok, json: async () => body });
let careerFetch;
let savedFetch;
let storedJobs;

beforeEach(() => {
  storedJobs = [];
  savedFetch = vi.fn(async (url, options = {}) => {
    if (options.method === "POST") { const saved = JSON.parse(options.body).job; storedJobs = [saved]; return response({ success: true, job: saved }); }
    if (options.method === "DELETE") { storedJobs = []; return response({ success: true }); }
    return response({ success: true, jobs: storedJobs });
  });
  careerFetch = vi.fn(async (url) => response(url.startsWith("/api/careers/history")
    ? { success: true, keywords: ["welder", "ndt"], resetAt: Date.now() + 60000 }
    : url.startsWith("/api/careers/job-details")
      ? { success: true, job: { ...job, description: "Join the welding team." }, resetAt: Date.now() + 60000 }
      : { success: true, jobs: [job], pathway, resetAt: Date.now() + 60000 }));
  vi.stubGlobal("fetch", vi.fn(async (url, options) => {
    if (url.startsWith("/api/careers/saved-jobs")) return savedFetch(url, options);
    if (url.startsWith("/api/careers/")) return careerFetch(url, options);
    if (url === "/api/semesters")
      return response([{ _id: "sem1", datasetName: "JJ2026", isCurrentSemester: true, recordsProcessed: 1, status: "Processed" }]);
    if (url.includes("/skill-gap"))
      return response({ student, chart: { labels: ["PLO 1"], current: [60], target: [80] }, insight: { weakestSkill: "PLO 1", message: "Test insight" } });
    if (url.startsWith("/api/students/S1")) return response(student);
    if (url.startsWith("/api/students")) return response([student]);
    throw new Error(`Unexpected request ${url}`);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function openCareers(view) {
  render(<StudentDashboardClient />);
  // The sidebar can briefly render before the selected student's data finishes loading.
  await screen.findByText("Test insight");
  fireEvent.click(await screen.findByRole("button", { name: "Padanan Kerjaya (AI)" }));
  if (view) fireEvent.click(await screen.findByRole("button", { name: view }));
}

describe("career tab", () => {
  it("keeps automatic recommendations and searches through the same-origin proxy", async () => {
    await openCareers("Carian Manual");
    expect(screen.getByText("Mulakan carian anda")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Kata kunci jawatan"), { target: { value: "Welder" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari Jawatan" }));
    expect(await screen.findByRole("link", { name: /Mohon Sekarang untuk Welder Intern/ })).toHaveAttribute("href", "https://example.com/apply");
    const url = new URL(careerFetch.mock.calls[0][0], "http://localhost");
    expect(url.pathname).toBe("/api/careers/search");
    expect(url.searchParams.get("q")).toBe("Welder");
    expect(url.searchParams.get("employmentType")).toBe("INTERN");
    fireEvent.click(screen.getByRole("button", { name: "Cadangan Automatik" }));
    expect(screen.getByText("Juruteknik Kimpalan 6G")).toBeInTheDocument();
    expect(screen.queryByText("Test Employer")).not.toBeInTheDocument();
  });

  it("shows the action plan and preserves suggested location and employment type", async () => {
    await openCareers("Laluan Pembelajaran");
    expect(await screen.findByText("Sediakan portfolio")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "74");
    fireEvent.click(screen.getByRole("button", { name: "Oil & Gas Welder · Terengganu" }));
    await screen.findByLabelText("Kata kunci jawatan");
    expect(screen.getByLabelText("Lokasi di Malaysia")).toHaveValue("Terengganu");
    const url = new URL(careerFetch.mock.calls.at(-1)[0], "http://localhost");
    expect(url.searchParams.get("q")).toBe("Pipe Welder NDT Intern");
    expect(url.searchParams.get("location")).toBe("Terengganu");
    expect(url.searchParams.get("employmentType")).toBe("INTERN");
  });

  it("recovers from a search error and distinguishes empty results", async () => {
    careerFetch.mockResolvedValueOnce(response({ success: false, warning: "Carian tergendala" }, false));
    await openCareers("Carian Manual");
    fireEvent.change(screen.getByLabelText("Kata kunci jawatan"), { target: { value: "Welder" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari Jawatan" }));
    expect(await screen.findByText("Carian tergendala")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cari Jawatan" })).toBeEnabled();
    careerFetch.mockResolvedValueOnce(response({ success: true, jobs: [] }));
    fireEvent.click(screen.getByRole("button", { name: "Cuba Lagi" }));
    expect(await screen.findByText("Tiada jawatan ditemui")).toBeInTheDocument();
  });

  it("keeps the pathway visible if job listings are unavailable", async () => {
    careerFetch.mockResolvedValue(response({ success: true, pathway, jobs: [], warning: "Carian belum diaktifkan" }));
    await openCareers("Laluan Pembelajaran");
    expect(await screen.findByText("Sediakan portfolio")).toBeInTheDocument();
    expect(screen.getByText("Carian belum diaktifkan")).toBeInTheDocument();
  });

  it("does not keep showing a spinner after a network failure", async () => {
    careerFetch.mockRejectedValue(new Error("Sambungan terputus"));
    await openCareers("Laluan Pembelajaran");
    expect(await screen.findByText("Sambungan terputus")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Cuba Lagi" })).toBeEnabled());
  });

  it("loads department recent searches on focus and searches the selected keyword", async () => {
    await openCareers("Carian Manual");
    fireEvent.focus(screen.getByLabelText("Kata kunci jawatan"));
    const option = await screen.findByRole("option", { name: "welder" });
    expect(careerFetch.mock.calls[0][0]).toBe("/api/careers/history?studentId=S1");
    fireEvent.click(option);
    expect(await screen.findByRole("link", { name: /Mohon Sekarang untuk Welder Intern/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Kata kunci jawatan")).toHaveValue("welder");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("retains the original page after a pagination failure and binds retry to original filters", async () => {
    careerFetch.mockResolvedValueOnce(response({ success: true, jobs: [job], cursor: "page2", resetAt: Date.now() + 60000 }));
    await openCareers("Carian Manual");
    fireEvent.change(screen.getByLabelText("Kata kunci jawatan"), { target: { value: "Welder" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari Jawatan" }));
    await screen.findByRole("button", { name: "Muat Lagi" });
    fireEvent.change(screen.getByLabelText("Lokasi di Malaysia"), { target: { value: "Selangor" } });
    careerFetch.mockResolvedValueOnce(response({ success: false, message: "Page unavailable" }, false));
    fireEvent.click(screen.getByRole("button", { name: "Muat Lagi" }));
    expect(await screen.findByText("Page unavailable")).toBeInTheDocument();
    expect(screen.getByText("Test Employer")).toBeInTheDocument();
    careerFetch.mockResolvedValueOnce(response({ success: true, jobs: [job, { ...job, jobId: "J2", title: "NDT Trainee" }], cursor: null, resetAt: Date.now() + 60000 }));
    fireEvent.click(screen.getByRole("button", { name: "Muat Lagi" }));
    expect(await screen.findByRole("heading", { name: "NDT Trainee" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Welder Intern" })).toHaveLength(1);
    const url = new URL(careerFetch.mock.calls.at(-1)[0], "http://localhost");
    expect(url.searchParams.get("cursor")).toBe("page2");
    expect(url.searchParams.get("location")).toBe("Malaysia");
  });

  it("loads job descriptions through the authenticated proxy", async () => {
    await openCareers("Carian Manual");
    fireEvent.change(screen.getByLabelText("Kata kunci jawatan"), { target: { value: "Welder" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari Jawatan" }));
    fireEvent.click(await screen.findByRole("button", { name: "Lihat Butiran untuk Welder Intern" }));
    const description = await screen.findByText("Join the welding team.");
    expect(within(description.closest("article")).getByText("Test Employer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tutup Butiran untuk Welder Intern" }));
    expect(screen.queryByText("Join the welding team.")).not.toBeInTheDocument();
    expect(careerFetch.mock.calls.at(-1)[0]).toBe("/api/careers/job-details?job_id=J1&studentId=S1");
  });

  it("saves a found job, reloads it from the account and removes it", async () => {
    await openCareers("Carian Manual");
    fireEvent.change(screen.getByLabelText("Kata kunci jawatan"), { target: { value: "Welder" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari Jawatan" }));
    const bookmark = await screen.findByRole("button", { name: "Simpan Welder Intern" });
    await waitFor(() => expect(bookmark).toBeEnabled());
    fireEvent.click(bookmark);
    expect(await screen.findByRole("button", { name: "Disimpan Welder Intern" })).toHaveAttribute("aria-pressed", "true");
    const save = savedFetch.mock.calls.find(([, options]) => options?.method === "POST");
    expect(save[0]).toBe("/api/careers/saved-jobs");
    expect(JSON.parse(save[1].body)).toEqual({ job });
    cleanup();
    await openCareers();
    fireEvent.click(screen.getByRole("button", { name: /^Disimpan\s*\d*$/ }));
    const savedButton = await screen.findByRole("button", { name: "Disimpan Welder Intern" });
    fireEvent.click(savedButton);
    expect(await screen.findByText("Belum ada jawatan disimpan")).toBeInTheDocument();
    expect(savedFetch.mock.calls.find(([, options]) => options?.method === "DELETE")[0]).toBe("/api/careers/saved-jobs?job_id=J1");
  });

  it("keeps the bookmark unchanged when saving fails and permits retry", async () => {
    await openCareers("Carian Manual");
    fireEvent.change(screen.getByLabelText("Kata kunci jawatan"), { target: { value: "Welder" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari Jawatan" }));
    const bookmark = await screen.findByRole("button", { name: "Simpan Welder Intern" });
    await waitFor(() => expect(bookmark).toBeEnabled());
    savedFetch.mockResolvedValueOnce(response({ success: false, message: "Simpanan tergendala" }, false));
    fireEvent.click(bookmark);
    expect(await screen.findByText("Simpanan tergendala")).toBeInTheDocument();
    expect(bookmark).toHaveAttribute("aria-pressed", "false");
    expect(bookmark).toBeEnabled();
    fireEvent.click(bookmark);
    expect(await screen.findByRole("button", { name: "Disimpan Welder Intern" })).toHaveAttribute("aria-pressed", "true");
  });

  it("discards responses that arrive after their reset deadline", async () => {
    careerFetch.mockResolvedValueOnce(response({ success: true, jobs: [job], resetAt: Date.now() - 1 }));
    await openCareers("Carian Manual");
    fireEvent.change(screen.getByLabelText("Kata kunci jawatan"), { target: { value: "Welder" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari Jawatan" }));
    expect(await screen.findByText("Carian harian telah ditetapkan semula. Mulakan carian baharu.")).toBeInTheDocument();
    expect(screen.queryByText("Test Employer")).not.toBeInTheDocument();
  });

  it("restarts from page one when the reset occurs after a failed next page", async () => {
    storedJobs = [job];
    careerFetch.mockResolvedValueOnce(response({ success: true, jobs: [job], cursor: "page2", resetAt: Date.now() + 700 }));
    await openCareers("Carian Manual");
    fireEvent.change(screen.getByLabelText("Kata kunci jawatan"), { target: { value: "Welder" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari Jawatan" }));
    await screen.findByRole("button", { name: "Muat Lagi" });
    careerFetch.mockResolvedValueOnce(response({ success: false, message: "Page unavailable" }, false));
    fireEvent.click(screen.getByRole("button", { name: "Muat Lagi" }));
    await screen.findByText("Page unavailable");
    await screen.findByText("Carian harian telah ditetapkan semula pada 8 pagi. Mulakan carian baharu.");
    fireEvent.click(screen.getByRole("button", { name: "Cuba Lagi" }));
    expect(await screen.findByText("Test Employer")).toBeInTheDocument();
    const url = new URL(careerFetch.mock.calls.at(-1)[0], "http://localhost");
    expect(url.searchParams.has("cursor")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /^Disimpan\s*\d*$/ }));
    expect(screen.getByRole("heading", { name: job.title })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disimpan Welder Intern" })).toHaveAttribute("aria-pressed", "true");
  });
});

it("does not render unsafe application links", () => {
  render(<JobCard job={{ ...job, applyLink: "javascript:alert(1)" }} isDynamic />);
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(screen.getByText("Pautan permohonan tidak tersedia.")).toBeInTheDocument();
});
