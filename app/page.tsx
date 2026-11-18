"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  LayoutDashboard, Bookmark, FolderKanban, Code2, Search, Plus, ExternalLink,
  Star, Globe, BookOpen, Layers, MoreHorizontal, X, Pencil, Trash2,
  AlertTriangle, LogOut, Loader2, Lock, Mail, ArrowUpRight, FolderOpen, Sparkles,
  PanelLeftClose, PanelLeftOpen, Image as ImageIcon, FileText, Upload, Download,
  File, FileArchive, FileImage, FileCode, Folder, ChevronRight, HardDrive,
  RefreshCw, Check, Filter, ArrowLeft, Link2, Tag, Copy, Eye,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Resource = {
  id: string; title: string; description: string; category: string; url: string;
  icon?: string; color?: string; tags: string[]; is_favorite: boolean;
  project_id: string | null; created_at?: string;
};
type Project = { id: string; name: string; description: string | null; language: string; created_at: string };
type Snippet = { id: string; title: string; description: string | null; language: string; code: string; tags: string[]; project_id: string | null; created_at: string };
type StoredFile = { id: string; name: string; description: string | null; file_path: string; file_url?: string | null; mime_type: string | null; size_bytes: number; project_id: string | null; created_at: string };
type View = "dashboard" | "resources" | "bookmarks" | "snippets" | "assets" | "documentation";
type FileKind = "assets" | "documentation";

const categories = ["All Resources", "Frontend", "Backend", "Database", "Language", "Tools"];
const languageNames: Record<string, string> = { javascript: "JavaScript", typescript: "TypeScript", html: "HTML", css: "CSS", php: "PHP", python: "Python", java: "Java", cpp: "C++", csharp: "C#", sql: "SQL", laravel: "Laravel" };
const buckets: Record<FileKind, string> = { assets: "devvault-assets", documentation: "devvault-documents" };
const prettySize = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const fileIcon = (mime: string | null) => mime?.startsWith("image/") ? FileImage : mime?.includes("pdf") ? FileText : mime?.includes("zip") ? FileArchive : mime?.includes("text") || mime?.includes("json") ? FileCode : File;

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [viewer, setViewer] = useState<{ title: string; kind: "code" | "image" | "pdf" | "text" | "unsupported"; content?: string; url?: string; language?: string; download?: { kind: FileKind; path: string; name: string } } | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [resources, setResources] = useState<Resource[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [assets, setAssets] = useState<StoredFile[]>([]);
  const [documents, setDocuments] = useState<StoredFile[]>([]);
  const [projectBookmarks, setProjectBookmarks] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All Resources");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [modal, setModal] = useState<"resource" | "snippet" | "file" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: string; id: string; path?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [resourceForm, setResourceForm] = useState({ title: "", description: "", url: "", category: "Frontend", tags: "", project_id: "" });
  const [snippetForm, setSnippetForm] = useState({ title: "", description: "", language: "typescript", code: "", tags: "", project_id: "" });
  const [fileForm, setFileForm] = useState({ description: "", project_id: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bookmarkPickerOpen, setBookmarkPickerOpen] = useState(false);
  const [exportPickerOpen, setExportPickerOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [organizationProjectId, setOrganizationProjectId] = useState("all");

  const loadAll = useCallback(async () => {
    setLoading(true); setError("");
    const [r, p, s, a, d, b] = await Promise.all([
      supabase.from("resources").select("*").order("created_at", { ascending: false }),
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("code_snippets").select("*").order("created_at", { ascending: false }),
      supabase.from("project_assets").select("*").order("created_at", { ascending: false }),
      supabase.from("project_documents").select("*").order("created_at", { ascending: false }),
      supabase.from("project_bookmarks").select("project_id").order("created_at", { ascending: false }),
    ]);
    const failed = [r, p, s, a, d, b].find((x) => x.error);
    if (failed?.error) setError(failed.error.message);
    if (r.data) setResources(r.data as Resource[]);
    if (p.data) setProjects(p.data as Project[]);
    if (s.data) setSnippets(s.data as Snippet[]);
    if (a.data) setAssets(a.data as StoredFile[]);
    if (d.data) setDocuments(d.data as StoredFile[]);
    if (b.data) setProjectBookmarks(b.data.map((x: any) => x.project_id));
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error: authError }) => {
      if (!mounted) return;
      if (authError) setError(authError.message);
      setSession(data.session); setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession); setError("");
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);
  useEffect(() => { if (session?.user?.id) void loadAll(); else { setResources([]); setProjects([]); setSnippets([]); setAssets([]); setDocuments([]); setProjectBookmarks([]); } }, [session?.user?.id, loadAll]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(""), 3000); return () => window.clearTimeout(timer); }, [notice]);

  async function handleAuth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); setNotice(""); setAuthLoading(true);
    if (authMode === "login") {
      const { error: e1 } = await supabase.auth.signInWithPassword({ email, password });
      if (e1) setError(e1.message);
    } else {
      const { data, error: e1 } = await supabase.auth.signUp({ email, password });
      if (e1) setError(e1.message); else if (!data.session) setNotice("Registrasi berhasil. Silakan cek email untuk konfirmasi akun."); else setNotice("Akun berhasil dibuat.");
    }
    setAuthLoading(false);
  }
  async function googleLogin() {
    setError(""); const { error: e } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/` } }); if (e) setError(e.message);
  }
  async function logout() { const { error: e } = await supabase.auth.signOut(); if (e) setError(e.message); }
  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name ?? "General Library";
  const openProject = (id: string) => { setSelectedProjectId(id); setActiveView("bookmarks"); setSearch(""); };
  const toggleProjectBookmark = async (project: Project) => {
    if (!session?.user?.id) return;
    const exists = projectBookmarks.includes(project.id);
    const result = exists
      ? await supabase.from("project_bookmarks").delete().eq("project_id", project.id).eq("user_id", session.user.id)
      : await supabase.from("project_bookmarks").insert({ project_id: project.id, user_id: session.user.id });
    if (result.error) { setError(`Bookmark gagal diperbarui: ${result.error.message}`); return; }
    setProjectBookmarks((old) => exists ? old.filter((id) => id !== project.id) : [project.id, ...old.filter((id) => id !== project.id)]);
    setNotice(exists ? "Project dilepas dari Bookmarks." : "Project disimpan ke Bookmarks.");
  };

  async function downloadBackup(selection: { id: string; type: "project" | "bookmark" }) {
    if (!session?.user?.id || exporting) return;
    const chosenProject = projects.find((p) => p.id === selection.id);
    if (!chosenProject) { setError("Project tidak ditemukan."); return; }
    if (selection.type === "bookmark" && !projectBookmarks.includes(selection.id)) {
      setError("Project ini tidak ada di Bookmarks."); return;
    }
    setExporting(true); setError(""); setNotice(`Menyiapkan ${selection.type === "bookmark" ? "bookmark" : "project"}...`);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const isIncluded = (id: string | null) => id === chosenProject.id;
      const [projectFilesResult, resourcesResult, snippetsResult, assetsResult, docsResult] = await Promise.all([
        supabase.from("project_files").select("*").eq("project_id", chosenProject.id),
        supabase.from("resources").select("*").eq("project_id", chosenProject.id).order("created_at", { ascending: true }),
        supabase.from("code_snippets").select("*").eq("project_id", chosenProject.id).order("created_at", { ascending: true }),
        supabase.from("project_assets").select("*").eq("project_id", chosenProject.id).order("created_at", { ascending: true }),
        supabase.from("project_documents").select("*").eq("project_id", chosenProject.id).order("created_at", { ascending: true }),
      ]);
      const queryError = [projectFilesResult, resourcesResult, snippetsResult, assetsResult, docsResult].find((x) => x.error)?.error;
      if (queryError) throw new Error(queryError.message);

      const projectFiles = projectFilesResult.data ?? [];
      const selectedResources = (resourcesResult.data ?? []).filter((x: any) => isIncluded(x.project_id));
      const selectedSnippets = (snippetsResult.data ?? []).filter((x: any) => isIncluded(x.project_id));
      const selectedAssets = (assetsResult.data ?? []).filter((x: any) => isIncluded(x.project_id));
      const selectedDocs = (docsResult.data ?? []).filter((x: any) => isIncluded(x.project_id));
      const safe = (value: string) => value.replace(/[\\/:*?"<>|]/g, "_").trim() || "untitled";
      const folderType = selection.type === "bookmark" ? "Bookmarks" : "Projects";
      const root = `${folderType}/${safe(chosenProject.name)}`;

      for (const folder of projectFiles.filter((f: any) => f.item_type === "folder")) {
        const folderPath = String(folder.path || folder.name).replace(/^[/\\]+/, "");
        zip.folder(`${root}/${folderPath}`);
      }
      for (const file of projectFiles.filter((f: any) => f.item_type === "file")) {
        const relative = String(file.path || file.name).replace(/^[/\\]+/, "");
        if (file.storage_path) {
          const { data, error: downloadError } = await supabase.storage.from("devvault-projects").download(file.storage_path);
          if (downloadError) throw new Error(`Gagal mengunduh ${file.name}: ${downloadError.message}`);
          if (data) zip.file(`${root}/${relative}`, data);
        } else if (file.content != null) zip.file(`${root}/${relative}`, file.content);
      }

      const projectMeta = {
        ...chosenProject,
        resources: selectedResources,
        snippets: selectedSnippets,
        assets: selectedAssets,
        documentation: selectedDocs,
        export_type: selection.type,
      };
      zip.file(`${root}/devvault-project-data.json`, JSON.stringify(projectMeta, null, 2));

      async function addStoredFiles(items: any[], kind: FileKind) {
        const folder = kind === "assets" ? "Assets" : "Documentation";
        for (const item of items) {
          const { data, error: downloadError } = await supabase.storage.from(buckets[kind]).download(item.file_path);
          if (downloadError) throw new Error(`Gagal mengunduh ${item.name} (${folder}): ${downloadError.message}`);
          if (data) zip.file(`${root}/${folder}/${safe(item.name)}`, data);
        }
      }
      await addStoredFiles(selectedAssets, "assets");
      await addStoredFiles(selectedDocs, "documentation");
      zip.file(`${root}/resources.json`, JSON.stringify(selectedResources, null, 2));
      zip.file(`${root}/snippets.json`, JSON.stringify(selectedSnippets, null, 2));
      zip.file(`${root}/README.txt`, `DevVault ${selection.type} export\nProject: ${chosenProject.name}\n\nThis archive contains this ${selection.type}, its project files, resources, code snippets, assets, and documentation.\n`);

      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safe(chosenProject.name)}-${selection.type}-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      setNotice(`${selection.type === "bookmark" ? "Bookmark" : "Project"} ${chosenProject.name} berhasil diunduh.`);
      setExportPickerOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download ZIP gagal dibuat.");
      setNotice("");
    } finally { setExporting(false); }
  }

  const toggleResourceBookmark = async (resource: Resource) => {
    const next = !resource.is_favorite;
    const { error: e } = await supabase.from("resources").update({ is_favorite: next }).eq("id", resource.id);
    if (e) { setError(e.message); return; }
    setResources((old) => old.map((x) => x.id === resource.id ? { ...x, is_favorite: next } : x));
  };
  const openResourceModal = (item?: Resource) => {
    setEditingId(item?.id ?? null);
    setResourceForm(item ? { title: item.title, description: item.description, url: item.url, category: item.category, tags: (item.tags ?? []).join(", "), project_id: item.project_id ?? "" } : { title: "", description: "", url: "", category: "Frontend", tags: "", project_id: selectedProjectId ?? "" });
    setModal("resource");
  };
  async function saveResource(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setError("");
    let url = ""; try { const u = new URL(resourceForm.url.trim()); if (!["http:", "https:"].includes(u.protocol)) throw new Error(); url = u.href; } catch { setError("URL harus valid dan diawali http:// atau https://"); setSaving(false); return; }
    const payload = { title: resourceForm.title.trim(), description: resourceForm.description.trim(), url, category: resourceForm.category, tags: resourceForm.tags.split(",").map((x) => x.trim()).filter(Boolean), project_id: resourceForm.project_id || null, icon: "Code2", color: "bg-gray-100 text-gray-800" };
    const result = editingId ? await supabase.from("resources").update(payload).eq("id", editingId) : await supabase.from("resources").insert(payload);
    if (result.error) setError(result.error.message); else { setModal(null); setNotice("Resource berhasil disimpan."); await loadAll(); }
    setSaving(false);
  }
  const openSnippetModal = (item?: Snippet) => { setEditingId(item?.id ?? null); setSnippetForm(item ? { title: item.title, description: item.description ?? "", language: item.language, code: item.code, tags: (item.tags ?? []).join(", "), project_id: item.project_id ?? "" } : { title: "", description: "", language: "typescript", code: "", tags: "", project_id: selectedProjectId ?? "" }); setModal("snippet"); };
  async function saveSnippet(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setError("");
    const payload = { title: snippetForm.title.trim(), description: snippetForm.description.trim() || null, language: snippetForm.language, code: snippetForm.code, tags: snippetForm.tags.split(",").map((x) => x.trim()).filter(Boolean), project_id: snippetForm.project_id || null };
    const result = editingId ? await supabase.from("code_snippets").update(payload).eq("id", editingId) : await supabase.from("code_snippets").insert(payload);
    if (result.error) setError(result.error.message); else { setModal(null); setNotice("Code snippet berhasil disimpan."); await loadAll(); }
    setSaving(false);
  }
  const openFileModal = (kind: FileKind) => { setEditingId(null); setSelectedFile(null); setFileForm({ description: "", project_id: selectedProjectId ?? "" }); setModal("file"); setFileModalKind(kind); };
  const [fileModalKind, setFileModalKind] = useState<FileKind>("documentation");
  async function uploadFile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!selectedFile) { setError("Pilih file yang mau di-upload."); return; }
    if (selectedFile.size > 50 * 1024 * 1024) { setError("Ukuran maksimal file 50 MB."); return; }
    setSaving(true); setError("");
    const kind = fileModalKind; const bucket = buckets[kind];
    const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${session.user.id}/${fileForm.project_id || "general"}/${Date.now()}-${safeName}`;
    const up = await supabase.storage.from(bucket).upload(path, selectedFile, { upsert: false, contentType: selectedFile.type || "application/octet-stream" });
    if (up.error) { setError(up.error.message); setSaving(false); return; }
    const payload = { name: selectedFile.name, description: fileForm.description.trim() || null, file_path: path, mime_type: selectedFile.type || null, size_bytes: selectedFile.size, project_id: fileForm.project_id || null };
    const table = kind === "assets" ? "project_assets" : "project_documents";
    const ins = await supabase.from(table).insert(payload);
    if (ins.error) {
      const cleanup = await supabase.storage.from(bucket).remove([path]);
      setError(cleanup.error ? `${ins.error.message}. File sementara juga gagal dibersihkan: ${cleanup.error.message}` : ins.error.message);
    } else { setModal(null); setNotice(`${kind === "assets" ? "Asset" : "Dokumentasi"} berhasil di-upload.`); await loadAll(); }
    setSaving(false);
  }
  async function downloadStoredFile(kind: FileKind, path: string, fileName: string) {
    setError("");
    try {
      const { data, error: downloadError } = await supabase.storage.from(buckets[kind]).download(path);
      if (downloadError) throw new Error(downloadError.message);
      if (!data) throw new Error("File tidak ditemukan di Storage.");
      const objectUrl = URL.createObjectURL(data);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName || "devvault-file";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
      setNotice(`${fileName} berhasil diunduh.`);
    } catch (err) {
      setError(`Download ${fileName} gagal: ${err instanceof Error ? err.message : "Terjadi kesalahan."}`);
    }
  }
  function openSnippetViewer(snippet: Snippet) {
    setViewer({ title: snippet.title, kind: "code", content: snippet.code, language: snippet.language });
  }

  async function openStoredFileViewer(kind: FileKind, item: StoredFile) {
    setError("");
    try {
      const { data, error: downloadError } = await supabase.storage.from(buckets[kind]).download(item.file_path);
      if (downloadError) throw new Error(downloadError.message);
      if (!data) throw new Error("File tidak ditemukan di Storage.");
      const mime = (item.mime_type || data.type || "").toLowerCase();
      const extension = item.name.split(".").pop()?.toLowerCase() || "";
      const download = { kind, path: item.file_path, name: item.name };
      if (mime.startsWith("image/")) {
        setViewer({ title: item.name, kind: "image", url: URL.createObjectURL(data), download });
      } else if (mime.includes("pdf") || extension === "pdf") {
        setViewer({ title: item.name, kind: "pdf", url: URL.createObjectURL(data), download });
      } else if (mime.startsWith("text/") || ["txt", "md", "json", "js", "jsx", "ts", "tsx", "css", "html", "xml", "csv", "sql", "py", "php", "java", "sh", "yml", "yaml"].includes(extension)) {
        setViewer({ title: item.name, kind: "text", content: await data.text(), download });
      } else {
        setViewer({ title: item.name, kind: "unsupported", download });
      }
    } catch (err) {
      setError(`File tidak bisa dibuka: ${err instanceof Error ? err.message : "Terjadi kesalahan."}`);
    }
  }

  function closeViewer() {
    if (viewer?.url) URL.revokeObjectURL(viewer.url);
    setViewer(null);
  }

  async function removeTarget() {
    if (!deleteTarget) return; setSaving(true); setError("");
    let result: any;
    if (deleteTarget.kind === "resource") result = await supabase.from("resources").delete().eq("id", deleteTarget.id);
    if (deleteTarget.kind === "snippet") result = await supabase.from("code_snippets").delete().eq("id", deleteTarget.id);
    if (deleteTarget.kind === "assets" || deleteTarget.kind === "documentation") {
      const kind = deleteTarget.kind as FileKind; const table = kind === "assets" ? "project_assets" : "project_documents";
      result = await supabase.from(table).delete().eq("id", deleteTarget.id);
      if (!result.error && deleteTarget.path) { const removed = await supabase.storage.from(buckets[kind]).remove([deleteTarget.path]); if (removed.error) setError(`Metadata terhapus, tetapi file storage gagal dihapus: ${removed.error.message}`); }
    }
    if (result?.error) setError(result.error.message); else { setNotice("Item berhasil dihapus."); await loadAll(); }
    setDeleteTarget(null); setSaving(false);
  }

  const filteredResources = useMemo(() => resources.filter((r) => {
    const q = search.toLowerCase(); return (activeCategory === "All Resources" || r.category === activeCategory) && (!selectedProjectId || r.project_id === selectedProjectId) && (activeView !== "bookmarks" || selectedProjectId || r.is_favorite) && [r.title, r.description, ...(r.tags ?? [])].join(" ").toLowerCase().includes(q);
  }), [resources, search, activeCategory, activeView, selectedProjectId]);
  const filteredSnippets = useMemo(() => snippets.filter((x) =>
    (!selectedProjectId || x.project_id === selectedProjectId) &&
    (organizationProjectId === "all" || (organizationProjectId === "general" ? x.project_id === null : x.project_id === organizationProjectId)) &&
    [x.title, x.description ?? "", x.language, x.code, ...(x.tags ?? [])].join(" ").toLowerCase().includes(search.toLowerCase())
  ), [snippets, selectedProjectId, search, organizationProjectId]);
  const filterFiles = (items: StoredFile[]) => items.filter((x) =>
    (!selectedProjectId || x.project_id === selectedProjectId) &&
    (organizationProjectId === "all" || (organizationProjectId === "general" ? x.project_id === null : x.project_id === organizationProjectId)) &&
    `${x.name} ${x.description ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );
  const favoriteCount = resources.filter((x) => x.is_favorite).length;
  const bookmarkedProjects = projects.filter((x) => projectBookmarks.includes(x.id));
  const selectedProject = projects.find((x) => x.id === selectedProjectId);
  const projectResources = resources.filter((x) => x.project_id === selectedProjectId);
  const projectSnippets = snippets.filter((x) => x.project_id === selectedProjectId);
  const projectAssets = assets.filter((x) => x.project_id === selectedProjectId);
  const projectDocuments = documents.filter((x) => x.project_id === selectedProjectId);

  if (authLoading) return <div className="flex min-h-screen items-center justify-center bg-[#f8f9fb]"><Loader2 className="animate-spin text-gray-700" size={30} /></div>;
  if (!session) return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f9fb] px-5 py-10"><div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
      <div className="mb-8 flex items-center gap-3"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-black"><img src="/devvault-logo.png" alt="DevVault logo" className="h-full w-full object-cover" /></div><div><h1 className="text-2xl font-bold text-gray-950">DevVault</h1><p className="text-xs font-medium text-gray-500">Developer workspace</p></div></div>
      <h2 className="text-2xl font-bold text-gray-950">{authMode === "login" ? "Welcome back" : "Create account"}</h2><p className="mt-2 text-sm text-gray-600">Sign in to access your personal developer workspace.</p>
      <button type="button" onClick={googleLogin} className="mt-7 flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3.5 text-sm font-semibold text-gray-800 hover:bg-gray-50">Continue with Google</button>
      <div className="my-6 flex items-center gap-3"><div className="h-px flex-1 bg-gray-200" /><span className="text-xs font-medium text-gray-500">OR CONTINUE WITH EMAIL</span><div className="h-px flex-1 bg-gray-200" /></div>
      <form onSubmit={handleAuth} className="space-y-4"><label className="block text-sm font-semibold text-gray-800">Email<div className="mt-2 flex items-center gap-3 rounded-xl border border-gray-300 px-4"><Mail size={17} className="text-gray-500" /><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-transparent py-3 text-sm text-gray-900 outline-none" placeholder="you@example.com" /></div></label>
        <label className="block text-sm font-semibold text-gray-800">Password<div className="mt-2 flex items-center gap-3 rounded-xl border border-gray-300 px-4"><Lock size={17} className="text-gray-500" /><input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-transparent py-3 text-sm text-gray-900 outline-none" placeholder="Minimum 6 characters" /></div></label>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{notice && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{notice}</p>}
        <button disabled={authLoading} className="w-full rounded-xl bg-black px-5 py-3.5 text-sm font-semibold text-white">{authMode === "login" ? "Sign In" : "Create Account"}</button></form>
      <p className="mt-6 text-center text-sm text-gray-600">{authMode === "login" ? "Don't have an account?" : "Already have an account?"} <button onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setError(""); }} className="font-bold text-gray-950 hover:underline">{authMode === "login" ? "Register" : "Sign in"}</button></p>
      <p className="mt-8 text-center text-xs text-gray-400">DevVault © 2026</p>
    </div></main>
  );

  const navItems: { key: View; label: string; icon: any; count?: number }[] = [
    { key: "resources", label: "Resources", icon: BookOpen, count: resources.length },
    { key: "bookmarks", label: "Bookmarks", icon: Bookmark, count: bookmarkedProjects.length },
    { key: "snippets", label: "Code Snippets", icon: Code2, count: snippets.length },
    { key: "assets", label: "Assets", icon: ImageIcon, count: assets.length },
    { key: "documentation", label: "Documentation", icon: Layers, count: documents.length },
  ];
  const title = selectedProjectId && selectedProject ? selectedProject.name : ({ dashboard: "Overview", resources: "Resources", bookmarks: "Bookmarks", snippets: "Code Snippets", assets: "Assets", documentation: "Documentation" } as Record<View, string>)[activeView];
  const viewTitle: Record<View, string> = { dashboard: "Your Workspace", resources: "Resources", bookmarks: "Bookmarks", snippets: "Code Snippets", assets: "Assets", documentation: "Documentation" };

  return <div className="min-h-screen bg-[#f7f8fa] text-[#202124] md:flex">
    <aside className={`hidden shrink-0 border-r border-gray-200 bg-white px-3 py-6 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] md:flex md:flex-col ${sidebarCollapsed ? "w-[76px]" : "w-[250px]"}`}>
      <div className={`mb-10 flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3 px-2"}`}><div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-black"><img src="/devvault-logo.png" alt="DevVault logo" className="h-full w-full object-cover" /></div>{!sidebarCollapsed && <div><h1 className="text-xl font-bold tracking-tight text-gray-950">DevVault</h1><p className="text-[11px] text-gray-500">Developer workspace</p></div>}</div>
      <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title="Collapse sidebar" className={`mb-6 flex min-h-10 items-center rounded-lg p-2 text-gray-500 transition-colors duration-200 ease-in-out hover:bg-gray-100 ${sidebarCollapsed ? "justify-center" : "justify-start"}`}>{sidebarCollapsed ? <PanelLeftOpen size={19} /> : <><span className="mr-2 text-xs">Collapse sidebar</span><PanelLeftClose size={19} /></>}</button>
      {!sidebarCollapsed && <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[1.5px] text-gray-400">Workspace</p>}
      <nav className="space-y-1"><button onClick={() => { setActiveView("dashboard"); setSelectedProjectId(null); }} className={`flex w-full items-center rounded-xl px-3 py-3 text-sm transition-[background-color,color] duration-200 ease-in-out ${sidebarCollapsed ? "justify-center" : "gap-3"} ${activeView === "dashboard" ? "bg-gray-100 font-semibold text-gray-950" : "text-gray-600 hover:bg-gray-50"}`}><LayoutDashboard size={18} />{!sidebarCollapsed && "Overview"}</button>
        <Link href="/projects" className={`flex items-center rounded-xl px-3 py-3 text-sm text-gray-600 hover:bg-gray-50 ${sidebarCollapsed ? "justify-center" : "gap-3"}`}><FolderKanban size={18} />{!sidebarCollapsed && <>My Projects <ArrowUpRight size={14} className="ml-auto text-gray-400" /></>}</Link></nav>
      {!sidebarCollapsed && <p className="mb-3 mt-9 px-3 text-[10px] font-bold uppercase tracking-[1.5px] text-gray-400">Developer Library</p>}{sidebarCollapsed && <div className="my-5 border-t border-gray-100" />}
      <nav className="space-y-1">{navItems.map((item) => { const Icon = item.icon; return <button key={item.key} title={item.label} onClick={() => { setActiveView(item.key); setSelectedProjectId(null); setSearch(""); }} className={`flex w-full items-center rounded-xl px-3 py-3 text-sm transition-[background-color,color] duration-200 ease-in-out ${sidebarCollapsed ? "justify-center" : "gap-3"} ${activeView === item.key ? "bg-gray-100 font-semibold text-gray-950" : "text-gray-600 hover:bg-gray-50"}`}><Icon size={18} />{!sidebarCollapsed && <><span>{item.label}</span><span className="ml-auto text-xs text-gray-400">{item.count}</span></>}</button>; })}</nav>
      <div className="mt-auto border-t border-gray-100 pt-5"><button onClick={logout} className={`flex w-full items-center rounded-xl px-3 py-3 text-sm text-gray-600 hover:bg-gray-50 hover:text-red-600 ${sidebarCollapsed ? "justify-center" : "gap-3"}`}><LogOut size={18} />{!sidebarCollapsed && "Sign Out"}</button>{!sidebarCollapsed && <div className="mt-4 flex items-center gap-3 rounded-xl bg-gray-50 p-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-sm font-bold text-white">{(session.user.email?.[0] ?? "D").toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-900">Developer</p><p className="truncate text-xs text-gray-500">{session.user.email}</p></div><MoreHorizontal size={18} className="text-gray-400" /></div>}</div>
    </aside>

    <main className="min-w-0 flex-1 px-5 py-7 md:px-10 md:py-9 lg:px-12">
      <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><p className="mb-1 text-sm text-gray-500">Workspace / {title}</p><h2 className="text-2xl font-bold tracking-tight text-gray-950 md:text-3xl">{title}</h2><p className="mt-1 text-sm text-gray-500">{selectedProjectId ? "All resources and files connected to this project." : "Your projects, tools and development materials in one workspace."}</p></div>
        <div className="flex flex-wrap gap-2">{activeView === "bookmarks" && !selectedProjectId && <button disabled={exporting} onClick={() => setExportPickerOpen(true)} className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 disabled:opacity-50"><Download size={16} /> Download Project / Bookmark</button>}{selectedProjectId && <button onClick={() => setSelectedProjectId(null)} className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700"><ArrowLeft size={16} /> All Bookmarks</button>}
          
          {activeView === "resources" && <button onClick={() => openResourceModal()} className="flex items-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white"><Plus size={17} /> Add Resource</button>}
          {activeView === "snippets" && <button onClick={() => openSnippetModal()} className="flex items-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white"><Plus size={17} /> Add Snippet</button>}
          {(activeView === "assets" || activeView === "documentation") && <button onClick={() => openFileModal(activeView)} className="flex items-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white"><Upload size={17} /> Upload {activeView === "assets" ? "Asset" : "Document"}</button>}
        </div>
      </header>
      {error && <div className="mb-5 flex items-center justify-between rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><button onClick={() => setError("")}><X size={17} /></button></div>}
      {notice && <div className="mb-5 flex items-center justify-between rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-800"><span className="flex items-center gap-2"><Check size={16} />{notice}</span><button onClick={() => setNotice("")}><X size={17} /></button></div>}

      {activeView === "dashboard" && <>
        <section className="mb-9 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{[{ label: "Projects", value: projects.length, icon: FolderKanban }, { label: "Resources", value: resources.length, icon: BookOpen }, { label: "Snippets", value: snippets.length, icon: Code2 }, { label: "Stored Files", value: assets.length + documents.length, icon: HardDrive }].map((x) => { const Icon = x.icon; return <div key={x.label} className="rounded-2xl border border-gray-200 bg-white p-5"><div className="mb-4 flex items-center justify-between text-sm text-gray-500">{x.label}<Icon size={19} className="text-gray-400" /></div><h3 className="text-3xl font-bold text-gray-950">{x.value}</h3></div>; })}</section>
        <section className="mb-10"><div className="mb-5 flex items-center justify-between"><div><h3 className="text-lg font-bold text-gray-950">Your Projects</h3><p className="mt-1 text-sm text-gray-500">Bookmark a project to collect all related materials in one dashboard.</p></div><Link href="/projects" className="text-sm font-semibold text-gray-600 hover:text-black">View all <ArrowUpRight size={14} className="inline" /></Link></div>
          {projects.length === 0 ? <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-14 text-center"><FolderOpen size={35} className="mx-auto mb-3 text-gray-400" /><h4 className="font-semibold text-gray-900">No projects yet</h4><p className="mt-1 text-sm text-gray-500">Create your first project to start organizing.</p><Link href="/projects" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16} /> Create Project</Link></div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{projects.slice(0, 9).map((p) => <article key={p.id} className="rounded-2xl border border-gray-200 bg-white p-5"><div className="mb-4 flex items-center justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100"><Code2 size={20} /></div><button onClick={() => toggleProjectBookmark(p)} title={projectBookmarks.includes(p.id) ? "Remove bookmark" : "Bookmark project"} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><Bookmark size={19} fill={projectBookmarks.includes(p.id) ? "currentColor" : "none"} className={projectBookmarks.includes(p.id) ? "text-black" : ""} /></button></div><h4 className="font-bold text-gray-950">{p.name}</h4><p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-gray-500">{p.description || "No description provided."}</p><div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4"><span className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs text-gray-600">{languageNames[p.language] || p.language}</span><button onClick={() => openProject(p.id)} className="text-xs font-semibold text-gray-700 hover:text-black">Open dashboard <ArrowUpRight size={13} className="inline" /></button></div></article>)}</div>}</section>
        <section className="mb-10"><h3 className="mb-4 text-lg font-bold text-gray-950">Developer Library</h3><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{navItems.map((item) => { const Icon = item.icon; return <button key={item.key} onClick={() => { setActiveView(item.key); setSelectedProjectId(null); }} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-5 text-left hover:border-gray-400 hover:shadow-sm"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100"><Icon size={19} /></div><div><p className="font-semibold text-gray-900">{item.label}</p><p className="text-xs text-gray-500">{item.count} items</p></div></button>; })}</div></section>
      </>}

      {activeView === "bookmarks" && !selectedProjectId && <>
        <div className="mb-7 flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3"><Search size={19} className="text-gray-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bookmarked projects..." className="w-full bg-transparent text-sm text-gray-900 outline-none" /></div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-bold text-gray-950">Your Project Bookmarks</h3><p className="mt-1 text-sm text-gray-500">Open a project to see its resources, snippets, assets, and documents together.</p></div><div className="flex items-center gap-2"><span className="text-sm text-gray-500">{bookmarkedProjects.length} projects</span><button onClick={() => setBookmarkPickerOpen(true)} className="flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-xs font-semibold text-white"><Plus size={15} /> Add Bookmark</button></div></div>
        {bookmarkedProjects.filter((p) => `${p.name} ${p.description ?? ""}`.toLowerCase().includes(search.toLowerCase())).length === 0 ? <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center"><Bookmark size={32} className="mx-auto mb-3 text-gray-400" /><p className="font-semibold text-gray-900">Belum ada project di Bookmarks</p><p className="mt-1 text-sm text-gray-500">Buka Overview, lalu tekan ikon bookmark pada project.</p></div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{bookmarkedProjects.filter((p) => `${p.name} ${p.description ?? ""}`.toLowerCase().includes(search.toLowerCase())).map((p) => <button key={p.id} onClick={() => openProject(p.id)} className="rounded-2xl border border-gray-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md"><div className="mb-4 flex items-center justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100"><FolderKanban size={21} /></div><Bookmark size={18} fill="currentColor" /></div><h4 className="font-bold text-gray-950">{p.name}</h4><p className="mt-1 min-h-10 text-xs text-gray-500">{p.description || "Project workspace"}</p><div className="mt-4 grid grid-cols-4 gap-2 border-t border-gray-100 pt-4 text-center"><div><p className="font-bold">{resources.filter((x) => x.project_id === p.id).length}</p><p className="text-[10px] text-gray-500">Links</p></div><div><p className="font-bold">{snippets.filter((x) => x.project_id === p.id).length}</p><p className="text-[10px] text-gray-500">Snippets</p></div><div><p className="font-bold">{assets.filter((x) => x.project_id === p.id).length}</p><p className="text-[10px] text-gray-500">Assets</p></div><div><p className="font-bold">{documents.filter((x) => x.project_id === p.id).length}</p><p className="text-[10px] text-gray-500">Docs</p></div></div><p className="mt-4 text-xs font-semibold text-gray-700">Open project dashboard <ChevronRight size={14} className="inline" /></p></button>)}</div>}
        <div className="mt-10 border-t border-gray-200 pt-7"><h3 className="mb-1 font-bold text-gray-950">Bookmarked Resources</h3><p className="mb-4 text-sm text-gray-500">Favorite links, separate from project collections.</p>{resources.filter((r) => r.is_favorite).length === 0 ? <p className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500">Belum ada resource favorit.</p> : <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">{resources.filter((r) => r.is_favorite).map((r) => <div key={r.id} className="flex items-center gap-3 p-4"><Star size={17} fill="currentColor" className="text-amber-500" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-900">{r.title}</p><p className="text-xs text-gray-500">{projectName(r.project_id)}</p></div><a href={r.url} target="_blank" rel="noreferrer" className="text-xs font-semibold">Visit <ExternalLink size={13} className="inline" /></a></div>)}</div>}</div>
      </>}

      {selectedProjectId && selectedProject && <>
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[{ label: "Resources", count: projectResources.length, icon: BookOpen }, { label: "Snippets", count: projectSnippets.length, icon: Code2 }, { label: "Assets", count: projectAssets.length, icon: ImageIcon }, { label: "Documents", count: projectDocuments.length, icon: FileText }].map((x) => { const Icon = x.icon; return <div key={x.label} className="rounded-xl border border-gray-200 bg-white p-4"><Icon size={18} className="mb-2 text-gray-500" /><p className="text-2xl font-bold">{x.count}</p><p className="text-xs text-gray-500">{x.label}</p></div>; })}
        </section>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">{(["resources", "snippets", "assets", "documentation"] as View[]).map((v) => <button key={v} onClick={() => setActiveView(v)} className={`rounded-lg px-4 py-2 text-xs font-semibold ${activeView === v ? "bg-black text-white" : "border border-gray-200 bg-white text-gray-600"}`}>{viewTitle[v]}</button>)}</div>
          <div className="flex flex-wrap gap-2"><button disabled={exporting} onClick={() => downloadBackup({ id: selectedProject.id, type: "project" })} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"><Download size={14} className="mr-1 inline" />{exporting ? "Preparing..." : "Download Project"}</button><button onClick={() => toggleProjectBookmark(selectedProject)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"><Bookmark size={14} className="mr-1 inline" fill={projectBookmarks.includes(selectedProject.id) ? "currentColor" : "none"} />{projectBookmarks.includes(selectedProject.id) ? "Remove bookmark" : "Bookmark project"}</button></div>
        </div>

        {activeView === "bookmarks" && <section className="space-y-7">
          <div>
            <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-bold text-gray-950">Project Resources</h3><p className="text-xs text-gray-500">Link dan referensi yang terhubung ke project ini.</p></div><button onClick={() => openResourceModal()} className="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white"><Plus size={14} className="mr-1 inline" /> Add Resource</button></div>
            {projectResources.length ? <div className="grid gap-3 md:grid-cols-2">{projectResources.map((r) => <article key={r.id} className="rounded-xl border border-gray-200 bg-white p-4"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="font-semibold text-gray-900">{r.title}</p><p className="mt-1 line-clamp-2 text-xs text-gray-500">{r.description}</p><p className="mt-2 text-[11px] text-gray-400">{r.category}</p></div><button onClick={() => toggleResourceBookmark(r)} title="Favorite resource" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><Star size={16} fill={r.is_favorite ? "currentColor" : "none"} className={r.is_favorite ? "text-amber-500" : ""} /></button></div><div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3"><a href={r.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-gray-700 hover:text-black">Open resource <ExternalLink size={12} className="inline" /></a><div className="flex gap-1"><button onClick={() => openResourceModal(r)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" title="Edit"><Pencil size={14} /></button><button onClick={() => setDeleteTarget({ kind: "resource", id: r.id })} className="rounded-md p-2 text-gray-500 hover:bg-red-50 hover:text-red-600" title="Delete"><Trash2 size={14} /></button></div></div></article>)}</div> : <EmptyState label="No resources for this project" hint="Tambahkan link referensi untuk project ini." />}
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-bold text-gray-950">Code Snippets</h3><p className="text-xs text-gray-500">Potongan kode yang disimpan untuk project ini.</p></div><button onClick={() => openSnippetModal()} className="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white"><Plus size={14} className="mr-1 inline" /> Add Snippet</button></div>
            {projectSnippets.length ? <div className="grid gap-3 lg:grid-cols-2">{projectSnippets.map((snippet) => <article key={snippet.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white"><div className="flex items-start justify-between gap-3 p-4"><div className="min-w-0"><p className="font-semibold text-gray-900">{snippet.title}</p><p className="mt-1 text-xs text-gray-500">{snippet.language} · {snippet.description || "No description"}</p></div><div className="flex gap-1"><button onClick={() => openSnippetViewer(snippet)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" title="View snippet"><Eye size={14} /></button><button onClick={() => navigator.clipboard.writeText(snippet.code).then(() => setNotice("Kode disalin."))} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" title="Copy"><Copy size={14} /></button><button onClick={() => openSnippetModal(snippet)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" title="Edit"><Pencil size={14} /></button><button onClick={() => setDeleteTarget({ kind: "snippet", id: snippet.id })} className="rounded-md p-2 text-gray-500 hover:bg-red-50 hover:text-red-600" title="Delete"><Trash2 size={14} /></button></div></div><pre className="max-h-48 overflow-auto bg-[#111827] p-4 text-xs leading-5 text-gray-100"><code>{snippet.code}</code></pre></article>)}</div> : <EmptyState label="No snippets for this project" hint="Simpan potongan kode yang berkaitan dengan project ini." />}
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-bold text-gray-950">Assets</h3><p className="text-xs text-gray-500">Gambar, arsip, dan file pendukung project.</p></div><button onClick={() => openFileModal("assets")} className="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white"><Upload size={14} className="mr-1 inline" /> Upload Asset</button></div>
            {projectAssets.length ? <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">{projectAssets.map((f) => { const Icon = fileIcon(f.mime_type); return <div key={f.id} className="flex items-center gap-3 border-b border-gray-100 p-3 last:border-0"><Icon size={18} className="shrink-0 text-gray-500" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-900">{f.name}</p><p className="text-xs text-gray-500">{prettySize(f.size_bytes)} · {f.description || f.mime_type || "Asset"}</p></div><button onClick={() => openStoredFileViewer("assets", f)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" title="View file"><Eye size={15} /></button><button onClick={() => downloadStoredFile("assets", f.file_path, f.name)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" title="Download file"><Download size={15} /></button><button onClick={() => setDeleteTarget({ kind: "assets", id: f.id, path: f.file_path })} className="rounded-md p-2 text-gray-500 hover:bg-red-50 hover:text-red-600" title="Delete"><Trash2 size={15} /></button></div>; })}</div> : <EmptyState label="No assets for this project" hint="Upload file pendukung seperti gambar, ZIP, atau source file." />}
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-bold text-gray-950">Documentation</h3><p className="text-xs text-gray-500">PDF, dokumen, catatan, dan berkas penting project.</p></div><button onClick={() => openFileModal("documentation")} className="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white"><Upload size={14} className="mr-1 inline" /> Upload Document</button></div>
            {projectDocuments.length ? <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">{projectDocuments.map((f) => { const Icon = fileIcon(f.mime_type); return <div key={f.id} className="flex items-center gap-3 border-b border-gray-100 p-3 last:border-0"><Icon size={18} className="shrink-0 text-gray-500" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-900">{f.name}</p><p className="text-xs text-gray-500">{prettySize(f.size_bytes)} · {f.description || f.mime_type || "Document"}</p></div><button onClick={() => openStoredFileViewer("documentation", f)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" title="View file"><Eye size={15} /></button><button onClick={() => downloadStoredFile("documentation", f.file_path, f.name)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" title="Download file"><Download size={15} /></button><button onClick={() => setDeleteTarget({ kind: "documentation", id: f.id, path: f.file_path })} className="rounded-md p-2 text-gray-500 hover:bg-red-50 hover:text-red-600" title="Delete"><Trash2 size={15} /></button></div>; })}</div> : <EmptyState label="No documents for this project" hint="Upload PDF, DOCX, TXT, ZIP, atau file dokumentasi lainnya." />}
          </div>
        </section>}
      </>}

      {activeView === "resources" && <>
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3"><Search size={19} className="text-gray-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search developer resources..." className="w-full bg-transparent text-sm text-gray-900 outline-none" /></div>
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">{categories.map((c) => <button key={c} onClick={() => setActiveCategory(c)} className={`shrink-0 rounded-lg px-4 py-2 text-xs font-semibold ${activeCategory === c ? "bg-black text-white" : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-100"}`}>{c}</button>)}</div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{filteredResources.map((r) => <article key={r.id} className="rounded-2xl border border-gray-200 bg-white p-5"><div className="mb-4 flex items-start justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100"><Globe size={21} /></div><div className="flex gap-1"><button onClick={() => toggleResourceBookmark(r)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-50"><Star size={18} fill={r.is_favorite ? "currentColor" : "none"} className={r.is_favorite ? "text-amber-500" : ""} /></button><button onClick={() => openResourceModal(r)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><Pencil size={16} /></button><button onClick={() => setDeleteTarget({ kind: "resource", id: r.id })} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button></div></div><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">{r.category}</p><h4 className="mb-2 font-bold text-gray-950">{r.title}</h4><p className="min-h-10 text-xs leading-6 text-gray-500">{r.description}</p><div className="mt-4 flex flex-wrap gap-2">{(r.tags ?? []).map((t) => <span key={t} className="rounded-md bg-gray-100 px-2 py-1 text-[10px] text-gray-600">{t}</span>)}</div><div className="mt-4 flex items-center border-t border-gray-100 pt-4 text-xs text-gray-500"><Folder size={13} className="mr-1" />{projectName(r.project_id)}<a href={r.url} target="_blank" rel="noreferrer" className="ml-auto font-semibold text-gray-800">Visit <ExternalLink size={13} className="inline" /></a></div></article>)}</div>
        {!filteredResources.length && <EmptyState label="No resources found" hint="Tambahkan resource baru atau ubah pencarian." />}
      </>}

      {activeView === "snippets" && <><LibraryProjectFilter value={organizationProjectId} projects={projects} onChange={setOrganizationProjectId} /><SearchBar value={search} onChange={setSearch} placeholder="Search snippets by title, language or code..." />{filteredSnippets.length ? <div className="grid gap-4 lg:grid-cols-2">{filteredSnippets.map((s) => <article key={s.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white"><div className="flex items-start justify-between p-5"><div><h3 className="font-bold text-gray-950">{s.title}</h3><p className="mt-1 text-xs text-gray-500">{s.language} · {projectName(s.project_id)}</p><p className="mt-2 text-sm text-gray-500">{s.description}</p></div><div className="flex gap-1"><button onClick={() => openSnippetViewer(s)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" title="View snippet"><Eye size={16} /></button><button onClick={() => navigator.clipboard.writeText(s.code).then(() => setNotice("Kode disalin."))} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" title="Copy"><Copy size={16} /></button><button onClick={() => openSnippetModal(s)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><Pencil size={16} /></button><button onClick={() => setDeleteTarget({ kind: "snippet", id: s.id })} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button></div></div><pre className="max-h-72 overflow-auto bg-[#111827] p-5 text-xs leading-6 text-gray-100"><code>{s.code}</code></pre><div className="flex flex-wrap gap-2 p-4">{(s.tags ?? []).map((t) => <span key={t} className="rounded-md bg-gray-100 px-2 py-1 text-[10px] text-gray-600">{t}</span>)}</div></article>)}</div> : <EmptyState label="No snippets yet" hint="Simpan potongan kode yang sering kamu gunakan." />}</>}

      {activeView === "assets" && <><LibraryProjectFilter value={organizationProjectId} projects={projects} onChange={setOrganizationProjectId} /><FileList items={filterFiles(assets)} kind="assets" onView={openStoredFileViewer} onDownload={downloadStoredFile} onDelete={(x) => setDeleteTarget({ kind: "assets", id: x.id, path: x.file_path })} /></>}
      {activeView === "documentation" && <><LibraryProjectFilter value={organizationProjectId} projects={projects} onChange={setOrganizationProjectId} /><FileList items={filterFiles(documents)} kind="documentation" onView={openStoredFileViewer} onDownload={downloadStoredFile} onDelete={(x) => setDeleteTarget({ kind: "documentation", id: x.id, path: x.file_path })} /></>}

      <footer className="mt-14 border-t border-gray-200 py-6 text-center text-xs text-gray-400">DevVault © 2026 — Your personal developer workspace.</footer>
    </main>

    {exportPickerOpen && <div className="fixed inset-0 z-[56] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => !exporting && setExportPickerOpen(false)}><section className="max-h-[82vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-gray-800 bg-[#171717] p-5 text-white shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-bold">Choose what to download</h2><p className="mt-1 text-xs text-gray-400">Pilih satu folder project atau bookmark. Setiap pilihan menghasilkan ZIP terpisah.</p></div><button disabled={exporting} onClick={() => setExportPickerOpen(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-800"><X size={18} /></button></div><div className="mb-5"><h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Project folders</h3>{projects.length ? <div className="space-y-2">{projects.map((p) => <div key={`project-${p.id}`} className="flex items-center gap-3 rounded-xl border border-gray-800 bg-[#202020] p-3"><FolderKanban size={18} className="shrink-0 text-gray-400"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{p.name}</p><p className="text-xs text-gray-500">{languageNames[p.language] || p.language}</p></div><button disabled={exporting} onClick={() => downloadBackup({ id: p.id, type: "project" })} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-50">{exporting ? "Preparing..." : "Download"}</button></div>)}</div> : <p className="rounded-lg border border-gray-800 p-4 text-sm text-gray-500">No projects available.</p>}</div><div><h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Bookmarked folders</h3>{bookmarkedProjects.length ? <div className="space-y-2">{bookmarkedProjects.map((p) => <div key={`bookmark-${p.id}`} className="flex items-center gap-3 rounded-xl border border-gray-800 bg-[#202020] p-3"><Bookmark size={18} className="shrink-0 text-gray-400"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{p.name}</p><p className="text-xs text-gray-500">Complete bookmarked project</p></div><button disabled={exporting} onClick={() => downloadBackup({ id: p.id, type: "bookmark" })} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-50">{exporting ? "Preparing..." : "Download"}</button></div>)}</div> : <p className="rounded-lg border border-gray-800 p-4 text-sm text-gray-500">No bookmarked projects yet.</p>}</div>{error && <p className="mt-4 rounded-lg bg-red-950/60 p-3 text-sm text-red-300">{error}</p>}</section></div>}
    {bookmarkPickerOpen && <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setBookmarkPickerOpen(false)}><div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-800 bg-[#171717] p-5 text-white shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-bold">Add projects to Bookmarks</h2><p className="mt-1 text-xs text-gray-400">Pilih project sebanyak yang kamu mau.</p></div><button onClick={() => setBookmarkPickerOpen(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-800"><X size={18} /></button></div>{projects.filter((p) => !projectBookmarks.includes(p.id)).length ? <div className="space-y-2">{projects.filter((p) => !projectBookmarks.includes(p.id)).map((p) => <div key={p.id} className="flex items-center gap-3 rounded-xl border border-gray-800 bg-[#202020] p-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-800"><FolderKanban size={17} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{p.name}</p><p className="text-xs text-gray-500">{languageNames[p.language] || p.language}</p></div><button onClick={() => toggleProjectBookmark(p)} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black"><Plus size={13} className="mr-1 inline" /> Add</button></div>)}</div> : <p className="rounded-xl border border-gray-800 p-5 text-center text-sm text-gray-400">Semua project sudah masuk Bookmarks.</p>}</div></div>}
    {modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setModal(null)}><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-gray-800 bg-[#171717] p-6 text-white shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="mb-6 flex items-center justify-between"><div><h2 className="text-xl font-bold">{modal === "resource" ? editingId ? "Edit Resource" : "Add Resource" : modal === "snippet" ? editingId ? "Edit Snippet" : "Add Code Snippet" : `Upload ${fileModalKind === "assets" ? "Asset" : "Documentation"}`}</h2><p className="mt-1 text-sm text-gray-400">Simpan data dan hubungkan ke project.</p></div><button onClick={() => setModal(null)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-800"><X size={20} /></button></div>
      {modal === "resource" && <form onSubmit={saveResource} className="space-y-4"><DarkField label="Resource Name"><input required value={resourceForm.title} onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })} placeholder="React Documentation" className={darkInput} /></DarkField><DarkField label="Website URL"><input required type="url" value={resourceForm.url} onChange={(e) => setResourceForm({ ...resourceForm, url: e.target.value })} placeholder="https://example.com" className={darkInput} /></DarkField><DarkField label="Description"><textarea required rows={3} value={resourceForm.description} onChange={(e) => setResourceForm({ ...resourceForm, description: e.target.value })} className={darkInput} /></DarkField><div className="grid gap-4 sm:grid-cols-2"><DarkField label="Category"><select value={resourceForm.category} onChange={(e) => setResourceForm({ ...resourceForm, category: e.target.value })} className={darkInput}>{categories.slice(1).map((x) => <option key={x}>{x}</option>)}</select></DarkField><DarkField label="Project"><ProjectSelect value={resourceForm.project_id} projects={projects} onChange={(v) => setResourceForm({ ...resourceForm, project_id: v })} /></DarkField></div><DarkField label="Tags (pisahkan koma)"><input value={resourceForm.tags} onChange={(e) => setResourceForm({ ...resourceForm, tags: e.target.value })} className={darkInput} placeholder="React, Next.js" /></DarkField><ModalActions saving={saving} onCancel={() => setModal(null)} /></form>}
      {modal === "snippet" && <form onSubmit={saveSnippet} className="space-y-4"><DarkField label="Snippet title"><input required value={snippetForm.title} onChange={(e) => setSnippetForm({ ...snippetForm, title: e.target.value })} className={darkInput} placeholder="Fetch API helper" /></DarkField><div className="grid gap-4 sm:grid-cols-2"><DarkField label="Language"><select value={snippetForm.language} onChange={(e) => setSnippetForm({ ...snippetForm, language: e.target.value })} className={darkInput}>{["javascript", "typescript", "html", "css", "php", "python", "java", "sql", "json", "bash"].map((x) => <option key={x}>{x}</option>)}</select></DarkField><DarkField label="Project"><ProjectSelect value={snippetForm.project_id} projects={projects} onChange={(v) => setSnippetForm({ ...snippetForm, project_id: v })} /></DarkField></div><DarkField label="Description"><input value={snippetForm.description} onChange={(e) => setSnippetForm({ ...snippetForm, description: e.target.value })} className={darkInput} /></DarkField><DarkField label="Code"><textarea required rows={10} value={snippetForm.code} onChange={(e) => setSnippetForm({ ...snippetForm, code: e.target.value })} className={`${darkInput} font-mono text-xs`} placeholder="Paste your code here..." /></DarkField><DarkField label="Tags"><input value={snippetForm.tags} onChange={(e) => setSnippetForm({ ...snippetForm, tags: e.target.value })} className={darkInput} placeholder="api, helper" /></DarkField><ModalActions saving={saving} onCancel={() => setModal(null)} /></form>}
      {modal === "file" && <form onSubmit={uploadFile} className="space-y-4"><div className="rounded-xl border border-dashed border-gray-600 bg-[#202020] p-6 text-center"><Upload size={28} className="mx-auto mb-3 text-gray-400" /><label className="cursor-pointer text-sm font-semibold text-white">{selectedFile ? selectedFile.name : "Choose a file to upload"}<input type="file" accept=".pdf,.doc,.docx,.txt,.md,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.png,.jpg,.jpeg,.webp,.svg,.gif,.mp4,.webm,.json,.js,.jsx,.ts,.tsx,.css,.html,.sql" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} /></label><p className="mt-2 text-xs text-gray-500">Maximum 50 MB · PDF, DOCX, ZIP, images, source files and more</p>{selectedFile && <p className="mt-2 text-xs text-gray-400">{prettySize(selectedFile.size)}</p>}</div><DarkField label="Description"><textarea rows={2} value={fileForm.description} onChange={(e) => setFileForm({ ...fileForm, description: e.target.value })} className={darkInput} placeholder="Optional file notes" /></DarkField><DarkField label="Connect to project"><ProjectSelect value={fileForm.project_id} projects={projects} onChange={(v) => setFileForm({ ...fileForm, project_id: v })} /></DarkField><ModalActions saving={saving} onCancel={() => setModal(null)} submitLabel="Upload file" /></form>}
      {error && <p className="mt-4 rounded-lg bg-red-950/60 p-3 text-sm text-red-300">{error}</p>}
    </div></div>}
    {viewer && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={closeViewer}>
      <section className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-700 bg-[#171717] text-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between gap-3 border-b border-gray-800 px-5 py-4">
          <div className="min-w-0"><h2 className="truncate font-semibold">{viewer.title}</h2><p className="text-xs text-gray-400">Preview</p></div>
          <div className="flex shrink-0 items-center gap-2">
            {viewer.download && <button onClick={() => downloadStoredFile(viewer.download!.kind, viewer.download!.path, viewer.download!.name)} className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-gray-800"><Download size={14} className="mr-1 inline" /> Download</button>}
            <button onClick={closeViewer} className="rounded-lg p-2 text-gray-400 hover:bg-gray-800" aria-label="Close viewer"><X size={18} /></button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-auto bg-[#0d0d0d]">
          {viewer.kind === "code" && <div className="p-5"><div className="mb-3 text-xs text-gray-400">{viewer.language}</div><pre className="overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[#111827] p-5 text-sm leading-6 text-gray-100"><code>{viewer.content}</code></pre></div>}
          {viewer.kind === "text" && <pre className="min-h-full whitespace-pre-wrap break-words p-6 font-mono text-sm leading-6 text-gray-100">{viewer.content}</pre>}
          {viewer.kind === "image" && <div className="flex min-h-[50vh] items-center justify-center p-5"><img src={viewer.url} alt={viewer.title} className="max-h-[75vh] max-w-full rounded-lg object-contain" /></div>}
          {viewer.kind === "pdf" && <iframe src={viewer.url} title={viewer.title} className="h-[78vh] w-full bg-white" />}
          {viewer.kind === "unsupported" && <div className="flex min-h-[40vh] flex-col items-center justify-center p-8 text-center"><FileArchive size={42} className="mb-4 text-gray-500" /><h3 className="font-semibold">Preview belum tersedia untuk format ini</h3><p className="mt-2 max-w-md text-sm text-gray-400">File tetap tersimpan. Gunakan tombol Download untuk membukanya dengan aplikasi yang sesuai.</p></div>}
        </div>
      </section>
    </div>}
    {deleteTarget && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600"><AlertTriangle size={23} /></div><h2 className="text-lg font-bold text-gray-950">Delete this item?</h2><p className="mt-2 text-sm leading-6 text-gray-500">Item akan dihapus dari DevVault. Tindakan ini tidak dapat dibatalkan.</p><div className="mt-6 flex gap-3"><button onClick={() => setDeleteTarget(null)} className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700">Cancel</button><button disabled={saving} onClick={removeTarget} className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white">{saving ? "Deleting..." : "Delete"}</button></div></div></div>}
  </div>;
}

const darkInput = "mt-2 w-full rounded-xl border border-gray-700 bg-[#242424] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-gray-400";
function DarkField({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-sm font-medium text-gray-200">{label}{children}</label>; }
function ProjectSelect({ value, projects, onChange }: { value: string; projects: Project[]; onChange: (v: string) => void }) { return <select value={value} onChange={(e) => onChange(e.target.value)} className={darkInput}><option value="">General Library (no project)</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>; }
function ModalActions({ saving, onCancel, submitLabel = "Save" }: { saving: boolean; onCancel: () => void; submitLabel?: string }) { return <div className="flex gap-3 pt-2"><button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-gray-700 px-4 py-3 text-sm font-semibold text-gray-300 hover:bg-gray-800">Cancel</button><button type="submit" disabled={saving} className="flex-1 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-gray-200 disabled:opacity-50">{saving ? "Saving..." : submitLabel}</button></div>; }
function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) { return <div className="mb-6 flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3"><Search size={18} className="text-gray-400" /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-transparent text-sm text-gray-900 outline-none" /></div>; }
function EmptyState({ label, hint }: { label: string; hint: string }) { return <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center"><Search size={30} className="mx-auto mb-3 text-gray-400" /><p className="font-semibold text-gray-900">{label}</p><p className="mt-1 text-sm text-gray-500">{hint}</p></div>; }
function LibraryProjectFilter({ value, projects, onChange }: { value: string; projects: Project[]; onChange: (value: string) => void }) {
  return <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <div><p className="text-sm font-semibold text-gray-800">Organize by project</p><p className="text-xs text-gray-500">Filter koleksi berdasarkan project atau General Library.</p></div>
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-gray-400 sm:min-w-56">
      <option value="all">All projects</option><option value="general">General Library</option>
      {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
    </select>
  </div>;
}
function FileList({ items, kind, onView, onDownload, onDelete }: { items: StoredFile[]; kind: FileKind; onView: (kind: FileKind, item: StoredFile) => void; onDownload: (kind: FileKind, path: string, name: string) => void; onDelete: (item: StoredFile) => void }) {
  const [query, setQuery] = useState("");
  const visible = items.filter((x) => `${x.name} ${x.description ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  return <><SearchBar value={query} onChange={setQuery} placeholder={`Search ${kind === "assets" ? "assets" : "documents"}...`} />{visible.length ? <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">{visible.map((x) => { const Icon = fileIcon(x.mime_type); return <div key={x.id} className="flex items-center gap-3 border-b border-gray-100 p-4 last:border-0"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600"><Icon size={19} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-900">{x.name}</p><p className="mt-1 truncate text-xs text-gray-500">{x.description || "No description"} · {prettySize(x.size_bytes)} · {x.mime_type || "Unknown type"}</p></div><button onClick={() => onView(kind, x)} title="View file" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><Eye size={17} /></button><button onClick={() => onDownload(kind, x.file_path, x.name)} title="Download file" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><Download size={17} /></button><button onClick={() => onDelete(x)} title="Delete" className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={17} /></button></div>; })}</div> : <EmptyState label="No files found" hint="Upload file untuk menambahkannya ke koleksi ini." />}</>;
}
