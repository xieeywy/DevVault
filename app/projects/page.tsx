
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import {
  ArrowLeft,
  Plus,
  Folder,
  FolderOpen,
  FolderPlus,
  FilePlus2,
  FileCode2,
  FileImage,
  FileText,
  Trash2,
  Save,
  Upload,
  Download,
  Code2,
  Search,
  Loader2,
  X,
  ChevronRight,
  ChevronDown,
  HardDrive,
  PanelLeftClose,
  PanelLeftOpen,
  Image as ImageIcon,
  ExternalLink,
  Globe,
  Link2,
  Layers,
  Database,
  Clock3,
  MoreHorizontal,
  Home,
  RefreshCw,
  Play,
  Maximize2,
  Minimize2,
  Terminal as TerminalIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Project = {
  id: string;
  name: string;
  description: string | null;
  language: string;
  created_at: string;
};

type ProjectFile = {
  id: string;
  project_id: string;
  name: string;
  path: string;
  item_type: "file" | "folder";
  content: string | null;
  storage_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
};

type Resource = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  url: string;
  tags: string[] | null;
  project_id: string | null;
  created_at: string;
};

const languages = [
  "javascript",
  "typescript",
  "html",
  "css",
  "php",
  "python",
  "java",
  "c",
  "cpp",
  "csharp",
  "json",
  "sql",
  "markdown",
  "bash",
];

const languageLabels: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  html: "HTML",
  css: "CSS",
  php: "PHP",
  python: "Python",
  java: "Java",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  json: "JSON",
  sql: "SQL",
  markdown: "Markdown",
  bash: "Bash",
};

const getLanguage = (filename: string) => {
  const extension = filename.split(".").pop()?.toLowerCase();

  const map: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    ts: "typescript",
    tsx: "typescript",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    php: "php",
    py: "python",
    java: "java",
    c: "c",
    cpp: "cpp",
    h: "c",
    cs: "csharp",
    json: "json",
    sql: "sql",
    md: "markdown",
    sh: "shell",
    yml: "yaml",
    yaml: "yaml",
    xml: "xml",
    svg: "xml",
  };

  return map[extension || ""] || "plaintext";
};

const getFileIcon = (file: ProjectFile) => {
  if (file.item_type === "folder") return Folder;

  const extension = file.name.split(".").pop()?.toLowerCase();

  if (
    ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico"].includes(
      extension || ""
    )
  ) {
    return FileImage;
  }

  if (["md", "txt", "pdf"].includes(extension || "")) return FileText;

  return FileCode2;
};

const getFileColor = (file: ProjectFile) => {
  if (file.item_type === "folder") return "text-amber-500";

  const extension = file.name.split(".").pop()?.toLowerCase();

  const colors: Record<string, string> = {
    html: "text-orange-500",
    htm: "text-orange-500",
    css: "text-blue-500",
    scss: "text-pink-500",
    js: "text-yellow-500",
    jsx: "text-yellow-500",
    ts: "text-blue-500",
    tsx: "text-blue-500",
    py: "text-sky-500",
    php: "text-indigo-500",
    json: "text-yellow-600",
    md: "text-zinc-500",
    sql: "text-cyan-600",
    svg: "text-orange-500",
    png: "text-purple-500",
    jpg: "text-purple-500",
    jpeg: "text-purple-500",
    webp: "text-purple-500",
  };

  return colors[extension || ""] || "text-zinc-500";
};

const isImage = (file: ProjectFile | null) => {
  if (!file?.storage_path) return false;

  return (
    file.mime_type?.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|svg|ico)$/i.test(file.name)
  );
};

const formatBytes = (bytes: number | null) => {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};


const normalizePreviewPath = (basePath: string, relativePath: string) => {
  const parts = [
    ...basePath.split("/").filter(Boolean),
    ...relativePath.split("/").filter(Boolean),
  ];

  const result: string[] = [];

  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      result.pop();
    } else {
      result.push(part);
    }
  }

  return result.join("/");
};

const buildPreviewDocument = (
  htmlFile: ProjectFile,
  allFiles: ProjectFile[],
  activeFile: ProjectFile | null,
  editorContent: string
) => {
  const getContent = (file: ProjectFile) => {
    if (activeFile?.id === file.id && !file.storage_path) {
      return editorContent;
    }

    return file.content || "";
  };

  const htmlDirectory = htmlFile.path.includes("/")
    ? htmlFile.path.substring(0, htmlFile.path.lastIndexOf("/"))
    : "";

  let html = getContent(htmlFile);

  // Hubungkan stylesheet lokal.
  html = html.replace(
    /<link\b([^>]*?)href=["']([^"']+\.css(?:\?[^"']*)?)["']([^>]*)>/gi,
    (original, before, href, after) => {
      if (/^(https?:|\/\/|data:|#)/i.test(href)) return original;

      const cssPath = normalizePreviewPath(
        htmlDirectory,
        href.split("?")[0]
      );

      const cssFile = allFiles.find(
        (file) => file.path === cssPath && file.item_type === "file"
      );

      if (!cssFile || cssFile.storage_path) return original;

      return `<style>\n${getContent(cssFile)}\n</style>`;
    }
  );

  // Hubungkan JavaScript lokal.
  html = html.replace(
    /<script\b([^>]*?)src=["']([^"']+\.js(?:\?[^"']*)?)["']([^>]*)>\s*<\/script>/gi,
    (original, before, src, after) => {
      if (/^(https?:|\/\/|data:|#)/i.test(src)) return original;

      const jsPath = normalizePreviewPath(
        htmlDirectory,
        src.split("?")[0]
      );

      const jsFile = allFiles.find(
        (file) => file.path === jsPath && file.item_type === "file"
      );

      if (!jsFile || jsFile.storage_path) return original;

      return `<script${before}${after}>\n${getContent(jsFile)}\n</script>`;
    }
  );

  return html;
};


export default function ProjectsPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [startedProjectId, setStartedProjectId] = useState<string | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);

  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeFile, setActiveFile] = useState<ProjectFile | null>(null);
  const [editorContent, setEditorContent] = useState("");

  const [currentPath, setCurrentPath] = useState("");
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSidebarTab, setActiveSidebarTab] = useState<
    "explorer" | "resources"
  >("explorer");

  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState("");
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalInput, setTerminalInput] = useState("");
  const [terminalLines, setTerminalLines] = useState<string[]>([
    "DevVault Mini Terminal",
    "Pilih file .js lalu klik Run JS, atau ketik: run / node nama-file.js / help",
  ]);
  const [jsRunnerDocument, setJsRunnerDocument] = useState("");
  const jsRunnerRef = useRef<HTMLIFrameElement>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectLanguage, setProjectLanguage] = useState("javascript");

  const [showNewItem, setShowNewItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemType, setNewItemType] = useState<"file" | "folder">("file");

  const [showResourceModal, setShowResourceModal] = useState(false);
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceDescription, setResourceDescription] = useState("");
  const [resourceCategory, setResourceCategory] = useState("Documentation");

  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      if (a.id === startedProjectId) return -1;
      if (b.id === startedProjectId) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [projects, startedProjectId]);

  useEffect(() => {
    const savedStartedProject = window.localStorage.getItem("devvault-started-project");
    if (savedStartedProject) setStartedProjectId(savedStartedProject);
  }, []);

  const startProject = (project: Project) => {
    setStartedProjectId(project.id);
    window.localStorage.setItem("devvault-started-project", project.id);
    setMessage(`${project.name} diprioritaskan di daftar project.`);
  };

  const isDirty = useMemo(() => {
    if (!activeFile || activeFile.storage_path) return false;
    return editorContent !== (activeFile.content || "");
  }, [activeFile, editorContent]);

  // Auto-save setelah pengguna berhenti mengetik selama 700ms.
  useEffect(() => {
    if (!isDirty || !activeFile || activeFile.storage_path || activeFile.item_type !== "file") return;

    const fileId = activeFile.id;
    const contentToSave = editorContent;
    const timer = window.setTimeout(async () => {
      setSaving(true);
      const { error } = await supabase
        .from("project_files")
        .update({ content: contentToSave, updated_at: new Date().toISOString() })
        .eq("id", fileId);

      if (error) {
        setMessage(`Auto-save gagal: ${error.message}`);
      } else {
        setFiles((current) => current.map((file) =>
          file.id === fileId ? { ...file, content: contentToSave } : file
        ));
        setActiveFile((current) => current?.id === fileId
          ? { ...current, content: contentToSave }
          : current
        );
      }
      setSaving(false);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [isDirty, activeFile, editorContent]);

  // Sinkronkan Live Preview otomatis saat kode berubah.
  useEffect(() => {
    if (!previewOpen || !activeFile) return;
    const timer = window.setTimeout(() => {
      const htmlFile =
        (activeFile.name.toLowerCase() === "index.html" && !activeFile.storage_path ? activeFile : null) ||
        files.find((file) => file.name.toLowerCase() === "index.html" && file.item_type === "file" && !file.storage_path) ||
        files.find((file) => /\.(html|htm)$/i.test(file.name) && file.item_type === "file" && !file.storage_path);
      if (!htmlFile) return;
      setPreviewDocument(buildPreviewDocument(htmlFile, files, activeFile, editorContent));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [previewOpen, activeFile, files, editorContent]);

  // Terima console.log dan error dari JavaScript yang dijalankan di iframe sandbox.
  useEffect(() => {
    const handleRunnerMessage = (event: MessageEvent) => {
      if (event.source !== jsRunnerRef.current?.contentWindow) return;
      const payload = event.data;
      if (!payload || payload.type !== "DEVVAULT_JS_OUTPUT") return;
      setTerminalLines((current) => [...current, String(payload.value ?? "")].slice(-300));
    };
    window.addEventListener("message", handleRunnerMessage);
    return () => window.removeEventListener("message", handleRunnerMessage);
  }, []);

  const loadProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setProjects(data || []);
  }, []);

  const loadFiles = useCallback(async (projectId: string) => {
    const { data, error } = await supabase
      .from("project_files")
      .select("*")
      .eq("project_id", projectId)
      .order("path", { ascending: true });

    if (error) {
      setMessage(error.message);
      return;
    }

    setFiles(data || []);
  }, []);

  const loadResources = useCallback(async (projectId: string) => {
    const { data, error } = await supabase
      .from("resources")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(
        error.message.includes("project_id")
          ? "Kolom project_id belum tersedia. Jalankan SQL migration terlebih dahulu."
          : error.message
      );
      return;
    }

    setResources(data || []);
  }, []);

  useEffect(() => {
    const initialize = async () => {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        setLoading(false);
        return;
      }

      setUser(data.session.user);
      await loadProjects();
      setLoading(false);
    };

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      if (!session) router.push("/");
    });

    return () => subscription.unsubscribe();
  }, [router, loadProjects]);

  useEffect(() => {
    const loadPreview = async () => {
      setPreviewUrl("");

      if (!activeFile?.storage_path || !isImage(activeFile)) return;

      setPreviewLoading(true);

      const { data, error } = await supabase.storage
        .from("devvault-projects")
        .createSignedUrl(activeFile.storage_path, 3600);

      if (error) {
        setMessage(error.message);
      } else {
        setPreviewUrl(data.signedUrl);
      }

      setPreviewLoading(false);
    };

    loadPreview();
  }, [activeFile]);

  const openProject = async (project: Project) => {
    setActiveProject(project);
    setActiveFile(null);
    setEditorContent("");
    setCurrentPath("");
    setSearch("");
    setActiveSidebarTab("explorer");
    setMessage("");

    await Promise.all([
      loadFiles(project.id),
      loadResources(project.id),
    ]);
  };

  const backToProjects = () => {
    // Dari halaman daftar project, panah kembali menuju dashboard utama.
    if (!activeProject) {
      router.push("/");
      return;
    }

    if (isDirty && !window.confirm("Perubahan belum disimpan. Tetap keluar?")) {
      return;
    }

    setActiveProject(null);
    setActiveFile(null);
    setEditorContent("");
    setFiles([]);
    setResources([]);
    setCurrentPath("");
    setPreviewUrl("");
    setPreviewDocument("");
    setPreviewOpen(false);
    setPreviewFullscreen(false);
    setTerminalOpen(false);
  };

  const createProject = async () => {
    if (!projectName.trim()) return;

    setBusy(true);
    setMessage("");

    const { data, error } = await supabase
      .from("projects")
      .insert({
        name: projectName.trim(),
        description: projectDescription.trim(),
        language: projectLanguage,
      })
      .select()
      .single();

    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }

    setProjects((current) => [data, ...current]);
    setShowCreate(false);
    setProjectName("");
    setProjectDescription("");
    setProjectLanguage("javascript");
    setBusy(false);

    await openProject(data);
  };

  const deleteProject = async (project: Project) => {
    const confirmed = window.confirm(
      `Hapus project "${project.name}" beserta seluruh file dan foldernya?`
    );

    if (!confirmed) return;

    setBusy(true);

    const { data: projectFiles } = await supabase
      .from("project_files")
      .select("storage_path")
      .eq("project_id", project.id);

    const storagePaths = (projectFiles || [])
      .map((file) => file.storage_path)
      .filter(Boolean) as string[];

    if (storagePaths.length) {
      await supabase.storage.from("devvault-projects").remove(storagePaths);
    }

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", project.id);

    if (error) {
      setMessage(error.message);
    } else {
      setProjects((current) =>
        current.filter((item) => item.id !== project.id)
      );
    }

    setBusy(false);
  };

  const createItem = async () => {
    if (!activeProject || !newItemName.trim()) return;

    const name = newItemName.trim().replaceAll("/", "");
    if (!name || name === "." || name === "..") return;

    const path = currentPath ? `${currentPath}/${name}` : name;

    if (files.some((file) => file.path === path)) {
      setMessage("Nama file atau folder sudah digunakan di lokasi ini.");
      return;
    }

    setBusy(true);
    setMessage("");

    const { data, error } = await supabase
      .from("project_files")
      .insert({
        project_id: activeProject.id,
        name,
        path,
        item_type: newItemType,
        content: newItemType === "file" ? "" : null,
      })
      .select()
      .single();

    if (error) {
      setMessage(error.message);
    } else {
      setFiles((current) =>
        [...current, data].sort((a, b) => a.path.localeCompare(b.path))
      );

      if (newItemType === "file") {
        setActiveFile(data);
        setEditorContent("");
      }

      setShowNewItem(false);
      setNewItemName("");
    }

    setBusy(false);
  };

  const saveFile = async () => {
    if (!activeFile || activeFile.item_type !== "file" || activeFile.storage_path) {
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("project_files")
      .update({
        content: editorContent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", activeFile.id);

    if (error) {
      setMessage(error.message);
    } else {
      const updatedFile = { ...activeFile, content: editorContent };

      setFiles((current) =>
        current.map((file) =>
          file.id === activeFile.id ? updatedFile : file
        )
      );

      setActiveFile(updatedFile);
      setMessage("File berhasil disimpan.");
    }

    setSaving(false);
  };

  const runPreview = () => {
  const htmlFile =
    (activeFile?.name.toLowerCase() === "index.html" && !activeFile.storage_path
      ? activeFile
      : null) ||
    files.find(
      (file) =>
        file.name.toLowerCase() === "index.html" &&
        file.item_type === "file" &&
        !file.storage_path
    ) ||
    files.find(
      (file) =>
        /\.(html|htm)$/i.test(file.name) &&
        file.item_type === "file" &&
        !file.storage_path
    );

  if (!htmlFile) {
    setMessage("Belum ada file HTML. Buat index.html terlebih dahulu.");
    return;
  }

  const document = buildPreviewDocument(
    htmlFile,
    files,
    activeFile,
    editorContent
  );

  setPreviewDocument(document);
  setPreviewOpen(true);
  setMessage("Preview berhasil dijalankan.");
};

  const uploadFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;

    if (!uploadedFiles || !activeProject || !user) return;

    setBusy(true);
    setMessage("");

    for (const file of Array.from(uploadedFiles)) {
      const relativePath = currentPath
        ? `${currentPath}/${file.name}`
        : file.name;

      const storagePath = `${user.id}/${activeProject.id}/${relativePath}`;

      const { error: uploadError } = await supabase.storage
        .from("devvault-projects")
        .upload(storagePath, file, { upsert: true });

      if (uploadError) {
        setMessage(`${file.name}: ${uploadError.message}`);
        continue;
      }

      const { data, error } = await supabase
        .from("project_files")
        .upsert(
          {
            project_id: activeProject.id,
            name: file.name,
            path: relativePath,
            item_type: "file",
            content: null,
            storage_path: storagePath,
            mime_type: file.type || "application/octet-stream",
            size_bytes: file.size,
          },
          { onConflict: "project_id,path" }
        )
        .select()
        .single();

      if (error) {
        setMessage(`${file.name}: ${error.message}`);
      } else {
        setFiles((current) =>
          [...current.filter((item) => item.path !== data.path), data].sort(
            (a, b) => a.path.localeCompare(b.path)
          )
        );
      }
    }

    event.target.value = "";
    setBusy(false);
  };

  const downloadFile = async (file: ProjectFile) => {
    if (!file.storage_path) return;

    const { data, error } = await supabase.storage
      .from("devvault-projects")
      .createSignedUrl(file.storage_path, 60);

    if (error) {
      setMessage(error.message);
      return;
    }

    window.open(data.signedUrl, "_blank");
  };

  const deleteFile = async (file: ProjectFile) => {
    const isFolder = file.item_type === "folder";

    const confirmed = window.confirm(
      isFolder
        ? `Hapus folder "${file.name}" beserta seluruh isinya?`
        : `Hapus file "${file.name}"?`
    );

    if (!confirmed) return;

    setBusy(true);
    setMessage("");

    const targets = isFolder
      ? files.filter(
          (item) =>
            item.path === file.path ||
            item.path.startsWith(`${file.path}/`)
        )
      : [file];

    const storagePaths = targets
      .map((item) => item.storage_path)
      .filter(Boolean) as string[];

    if (storagePaths.length) {
      const { error: storageError } = await supabase.storage
        .from("devvault-projects")
        .remove(storagePaths);

      if (storageError) {
        setMessage(storageError.message);
        setBusy(false);
        return;
      }
    }

    const ids = targets.map((item) => item.id);

    const { error } = await supabase
      .from("project_files")
      .delete()
      .in("id", ids);

    if (error) {
      setMessage(error.message);
    } else {
      setFiles((current) =>
        current.filter((item) => !ids.includes(item.id))
      );

      if (activeFile && ids.includes(activeFile.id)) {
        setActiveFile(null);
        setEditorContent("");
        setPreviewUrl("");
      }

      if (isFolder && currentPath.startsWith(file.path)) {
        setCurrentPath("");
      }
    }

    setBusy(false);
  };

  const selectFile = (file: ProjectFile) => {
    if (file.item_type === "folder") {
      setCurrentPath(file.path);
      setActiveFile(null);
      setEditorContent("");
      setPreviewUrl("");
      return;
    }

    if (isDirty && !window.confirm("Perubahan belum disimpan. Lanjutkan?")) {
      return;
    }

    setActiveFile(file);
    setEditorContent(file.content || "");
    setMessage("");
  };

  const createResource = async () => {
    if (!activeProject || !resourceTitle.trim() || !resourceUrl.trim()) return;

    setBusy(true);
    setMessage("");

    const { data, error } = await supabase
      .from("resources")
      .insert({
        title: resourceTitle.trim(),
        url: resourceUrl.trim(),
        description: resourceDescription.trim(),
        category: resourceCategory,
        project_id: activeProject.id,
        tags: [],
      })
      .select()
      .single();

    if (error) {
      setMessage(error.message);
    } else {
      setResources((current) => [data, ...current]);
      setShowResourceModal(false);
      setResourceTitle("");
      setResourceUrl("");
      setResourceDescription("");
      setResourceCategory("Documentation");
    }

    setBusy(false);
  };

  const deleteResource = async (resource: Resource) => {
    if (!window.confirm(`Hapus resource "${resource.title}"?`)) return;

    const { error } = await supabase
      .from("resources")
      .delete()
      .eq("id", resource.id);

    if (error) {
      setMessage(error.message);
    } else {
      setResources((current) =>
        current.filter((item) => item.id !== resource.id)
      );
    }
  };

  const visibleFiles = useMemo(() => {
    return files
      .filter((file) => {
        const parent = file.path.includes("/")
          ? file.path.substring(0, file.path.lastIndexOf("/"))
          : "";

        return parent === currentPath;
      })
      .filter((file) =>
        file.name.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => {
        if (a.item_type !== b.item_type) {
          return a.item_type === "folder" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
  }, [files, currentPath, search]);

  const breadcrumbs = currentPath ? currentPath.split("/") : [];

  const currentFolderItems = files.filter((file) => {
    const parent = file.path.includes("/")
      ? file.path.substring(0, file.path.lastIndexOf("/"))
      : "";
    return parent === currentPath;
  });

  const imageCount = files.filter((file) => isImage(file)).length;

  const runJavaScript = (requestedPath?: string) => {
    const targetPath = (requestedPath || "").replace(/^\.\//, "").replace(/^\//, "");
    const targetFile = targetPath
      ? files.find((file) => file.path === (currentPath ? `${currentPath}/${targetPath}` : targetPath) || file.path === targetPath)
      : activeFile;

    if (!targetFile || targetFile.item_type !== "file" || targetFile.storage_path) {
      setTerminalLines((current) => [...current, `Error: file JavaScript tidak ditemukan${targetPath ? `: ${targetPath}` : ". Pilih file .js terlebih dahulu."}`].slice(-300));
      return;
    }
    if (!/\.(js|mjs|cjs)$/i.test(targetFile.name)) {
      setTerminalLines((current) => [...current, `Error: ${targetFile.name} bukan file JavaScript.`].slice(-300));
      return;
    }

    const code = activeFile?.id === targetFile.id ? editorContent : (targetFile.content || "");
    const safeCode = code.replace(/<\/script/gi, "<\\/script");
    const codeLiteral = JSON.stringify(safeCode);
    const runnerHtml = `<!doctype html><html><body><script>
      (() => {
        const send = (value) => parent.postMessage({ type: "DEVVAULT_JS_OUTPUT", value }, "*");
        const format = (value) => {
          if (typeof value === "string") return value;
          try { return JSON.stringify(value, null, 2); } catch { return String(value); }
        };
        ["log", "info", "warn", "error", "debug"].forEach((method) => {
          console[method] = (...args) => send(args.map(format).join(" "));
        });
        window.onerror = (message, source, line) => send("Uncaught error: " + message + " (line " + line + ")");
        send("[DevVault] JavaScript started");
        try {
          const source = ${codeLiteral};
          const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
          Promise.resolve(new AsyncFunction(source)()).then(() => send("[DevVault] Execution finished")).catch((error) => send("Error: " + (error?.stack || error)));
        } catch (error) { send("Error: " + (error?.stack || error)); }
      })();
    <\/script></body></html>`;

    setTerminalLines((current) => [...current, `$ node ${targetFile.path}`, `▶ Running ${targetFile.name}...`].slice(-300));
    setJsRunnerDocument(`${runnerHtml}\\n<!-- run:${Date.now()} -->`);
  };

  const runTerminalCommand = () => {
    const raw = terminalInput.trim();
    if (!raw) return;
    const [command, ...args] = raw.split(/\s+/);
    const cmd = command.toLowerCase();
    const output: string[] = [`$ ${raw}`];
    const currentItems = files.filter((file) => {
      const parent = file.path.includes("/") ? file.path.substring(0, file.path.lastIndexOf("/")) : "";
      return parent === currentPath;
    });

    if (cmd === "clear" || cmd === "cls") {
      setTerminalLines([]);
      setTerminalInput("");
      return;
    }
    if (cmd === "run" || cmd === "node") {
      const target = args.join(" ").trim();
      setTerminalLines((current) => [...current, ...output].slice(-300));
      setTerminalInput("");
      runJavaScript(target || undefined);
      return;
    }
    if (cmd === "help") {
      output.push("Perintah mini terminal:", "  run              Jalankan file JS yang sedang dibuka", "  node file.js     Jalankan file JavaScript tertentu", "  ls               Lihat file di folder aktif", "  pwd              Lihat lokasi folder aktif", "  echo <teks>      Tampilkan teks", "  clear            Bersihkan output", "", "Terminal ini menjalankan JavaScript di sandbox browser. Bukan shell Windows dan tidak menjalankan npm.");
    } else if (cmd === "pwd") {
      output.push(`/${activeProject?.name || "project"}${currentPath ? `/${currentPath}` : ""}`);
    } else if (cmd === "ls" || cmd === "dir") {
      output.push(...(currentItems.length ? currentItems.map((file) => `${file.item_type === "folder" ? "📁" : "📄"} ${file.name}`) : ["(folder kosong)"]));
    } else if (cmd === "echo") {
      output.push(args.join(" "));
    } else {
      output.push(`Perintah tidak tersedia: ${cmd}. Ketik help untuk bantuan.`);
    }
    setTerminalLines((current) => [...current, ...output].slice(-300));
    setTerminalInput("");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f8fa] flex items-center justify-center text-zinc-700">
        <Loader2 className="animate-spin" size={28} />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#f7f8fa] flex flex-col items-center justify-center text-zinc-900 gap-4">
        <Code2 size={42} />
        <h1 className="text-2xl font-bold">Login diperlukan</h1>
        <p className="text-zinc-500">Silakan login untuk membuka DevVault.</p>
        <button
          onClick={() => router.push("/")}
          className="bg-zinc-900 text-white px-5 py-2.5 rounded-xl font-semibold"
        >
          Kembali ke Dashboard
        </button>
      </main>
    );
  }

  return (
    <main className={`min-h-screen ${activeProject ? "bg-[#0d0d0d] text-zinc-100" : "bg-white text-zinc-900"}`}>
      {/* TOP BAR */}
      <header
        className={`h-[62px] border-b flex items-center justify-between px-4 md:px-6 sticky top-0 z-30 ${
          activeProject
            ? "bg-[#181818] border-zinc-800 text-white"
            : "bg-white border-zinc-200 text-zinc-900"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={backToProjects}
            className={`p-2 rounded-lg ${activeProject ? "text-zinc-400 hover:bg-zinc-800 hover:text-white" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"}`} 
            title="Back to projects"
          >
            <ArrowLeft size={18} />
          </button>

          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${activeProject ? "bg-white text-zinc-900" : "bg-zinc-900 text-white"}`}>
            <Code2 size={17} />
          </div>

          <span className="font-bold tracking-tight">DevVault</span>
          <span className="text-zinc-300">/</span>

          {activeProject ? (
            <span className="text-sm font-medium truncate">
              {activeProject.name}
            </span>
          ) : (
            <span className="text-sm text-zinc-500">My Projects</span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeProject && (
            <>
              <button
                onClick={() => setSidebarOpen((value) => !value)}
                className="hidden md:flex p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white"
                title="Toggle Explorer"
              >
                {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
              </button>
              <label className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 text-xs font-medium text-zinc-300 hover:bg-zinc-800">
                <Upload size={15} />
                <span className="hidden sm:block">Upload</span>
                <input type="file" multiple className="hidden" onChange={uploadFiles} />
              </label>
              <button
                onClick={() => setTerminalOpen((value) => !value)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition ${terminalOpen ? "bg-zinc-700 border-zinc-600 text-white" : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"}`}
                title="Toggle terminal"
              >
                <TerminalIcon size={15} /> <span className="hidden sm:block">Terminal</span>
              </button>
              <button
                onClick={runPreview}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition"
              >
                <Play size={15} /> Start
              </button>
              <button
                onClick={saveFile}
                disabled={!activeFile || !!activeFile.storage_path || !isDirty || saving}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-700 text-white text-xs font-semibold disabled:opacity-35 hover:bg-zinc-600 transition"
                title="Save file (auto-save is enabled)"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                <span className="hidden sm:block">Save</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* NOTIFICATION */}
      {message && (
        <div className="fixed top-[74px] right-4 z-50 max-w-md bg-white border border-zinc-200 shadow-lg rounded-xl px-4 py-3 text-sm flex items-start gap-3">
          <span className="flex-1 text-zinc-700">{message}</span>
          <button
            onClick={() => setMessage("")}
            className="text-zinc-400 hover:text-zinc-900"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* PROJECT LIST */}
      {!activeProject ? (
        <section className="min-h-[calc(100vh-62px)] max-w-7xl mx-auto px-5 md:px-8 py-10 text-zinc-900">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-9">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.15em] text-zinc-500 mb-3">
                <Home size={14} />
                WORKSPACE
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                My Projects
              </h1>
              <p className="text-zinc-600 mt-2">
                Semua project development-mu, tersusun dalam satu workspace.
              </p>
            </div>

            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center justify-center gap-2 bg-zinc-900 text-white px-5 py-3 rounded-xl font-semibold hover:bg-zinc-700 transition"
            >
              <Plus size={18} />
              New Project
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[
              {
                label: "Total Projects",
                value: projects.length,
                icon: Layers,
              },
              {
                label: "Stored Files",
                value: files.length,
                icon: FileCode2,
              },
              {
                label: "Your Resources",
                value: resources.length,
                icon: Link2,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-white border border-zinc-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm"
              >
                <div className="w-11 h-11 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-700">
                  <item.icon size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{item.value}</p>
                  <p className="text-xs text-zinc-500">{item.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-lg">All Projects</h2>
              <p className="text-sm text-zinc-600 mt-1">
                Pilih project untuk membuka workspace.
              </p>
            </div>
            <span className="text-xs text-zinc-500">
              {projects.length} projects
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedProjects.map((project) => (
              <div
                key={project.id}
                className={`group bg-white border rounded-2xl p-5 hover:border-zinc-400 hover:shadow-lg hover:shadow-zinc-200/70 transition ${startedProjectId === project.id ? "border-emerald-400 ring-1 ring-emerald-100" : "border-zinc-200"}`}
              >
                <div className="flex justify-between items-start mb-5">
                  <div className="w-11 h-11 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-700">
                    <Code2 size={21} />
                  </div>

                  <button
                    onClick={() => deleteProject(project)}
                    disabled={busy}
                    className="p-2.5 text-red-600 bg-red-50 border border-red-100 hover:text-white hover:bg-red-600 hover:border-red-600 rounded-lg opacity-100 transition"
                    title="Delete project"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <button
                  onClick={() => openProject(project)}
                  className="text-left w-full"
                >
                  <h2 className="font-semibold text-lg truncate">
                    {project.name}
                  </h2>
                  <p className="text-sm text-zinc-600 mt-2 min-h-10 line-clamp-2">
                    {project.description || "No description provided."}
                  </p>
                </button>

                <div className="flex items-center justify-between mt-5 pt-4 border-t border-zinc-200">
                  <span className="text-xs bg-zinc-100 text-zinc-700 px-3 py-1.5 rounded-lg">
                    {languageLabels[project.language] || project.language}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startProject(project)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${startedProjectId === project.id ? "bg-emerald-100 text-emerald-700" : "bg-zinc-900 text-white hover:bg-zinc-700"}`}
                    >
                      <Play size={12} fill="currentColor" />
                      {startedProjectId === project.id ? "Active" : "Start"}
                    </button>
                    <button
                      onClick={() => openProject(project)}
                      className="text-xs font-semibold text-zinc-600 hover:text-zinc-950 flex items-center gap-1"
                    >
                      Open <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {projects.length === 0 && (
            <div className="border border-dashed border-zinc-300 rounded-2xl py-20 text-center mt-5 bg-zinc-50">
              <Folder size={38} className="mx-auto text-zinc-400 mb-4" />
              <h2 className="font-semibold text-lg">Belum ada project</h2>
              <p className="text-sm text-zinc-600 mt-2">
                Buat project pertamamu untuk mulai menyimpan kode.
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-5 text-sm bg-white text-zinc-900 px-4 py-2.5 rounded-lg font-semibold hover:bg-zinc-200"
              >
                Create your first project
              </button>
            </div>
          )}
        </section>
      ) : (
        /* PROJECT IDE WORKSPACE */
        <section className="h-[calc(100vh-62px)] flex flex-col overflow-hidden">
          {/* IDE COLUMNS */}
          <div className="flex flex-1 min-h-0">
            {/* LEFT SIDEBAR */}
            {sidebarOpen && (
              <aside className="w-[255px] shrink-0 bg-[#181818] text-zinc-200 border-r border-zinc-800 flex flex-col">
                <div className="h-12 px-3 border-b border-zinc-800 flex items-center gap-1">
                  <button
                    onClick={() => setActiveSidebarTab("explorer")}
                    className={`flex-1 h-8 rounded-md text-xs font-semibold flex items-center justify-center gap-2 ${
                      activeSidebarTab === "explorer"
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Folder size={14} />
                    Explorer
                  </button>
                  <button
                    onClick={() => setActiveSidebarTab("resources")}
                    className={`flex-1 h-8 rounded-md text-xs font-semibold flex items-center justify-center gap-2 ${
                      activeSidebarTab === "resources"
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Link2 size={14} />
                    Resources
                    {resources.length > 0 && (
                      <span className="text-[10px] text-zinc-400">
                        {resources.length}
                      </span>
                    )}
                  </button>
                </div>

                {activeSidebarTab === "explorer" ? (
                  <>
                    <div className="px-3 py-3 border-b border-zinc-800">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold tracking-[0.15em] text-zinc-400">
                          PROJECT FILES
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setNewItemType("file");
                              setShowNewItem(true);
                            }}
                            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded"
                            title="New file"
                          >
                            <FilePlus2 size={15} />
                          </button>
                          <button
                            onClick={() => {
                              setNewItemType("folder");
                              setShowNewItem(true);
                            }}
                            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded"
                            title="New folder"
                          >
                            <FolderPlus size={15} />
                          </button>
                        </div>
                      </div>

                      <div className="relative">
                        <Search
                          size={13}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                        />
                        <input
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Search files..."
                          className="w-full bg-[#252526] border border-zinc-700 text-zinc-200 placeholder:text-zinc-500 rounded-lg pl-8 pr-3 py-2 text-xs outline-none focus:border-zinc-400"
                        />
                      </div>
                    </div>

                    {/* BREADCRUMBS */}
                    <div className="px-3 py-2 border-b border-zinc-800 flex items-center gap-1 text-[10px] overflow-x-auto whitespace-nowrap">
                      <button
                        onClick={() => setCurrentPath("")}
                        className={`hover:text-white ${
                          !currentPath ? "text-white font-semibold" : "text-zinc-400"
                        }`}
                      >
                        Root
                      </button>

                      {breadcrumbs.map((part, index) => {
                        const path = breadcrumbs.slice(0, index + 1).join("/");
                        return (
                          <span key={path} className="flex items-center gap-1">
                            <ChevronRight size={11} className="text-zinc-300" />
                            <button
                              onClick={() => setCurrentPath(path)}
                              className={`hover:text-white ${
                                index === breadcrumbs.length - 1
                                  ? "text-white font-semibold"
                                  : "text-zinc-400"
                              }`}
                            >
                              {part}
                            </button>
                          </span>
                        );
                      })}
                    </div>

                    {/* FILE TREE */}
                    <div className="flex-1 overflow-y-auto p-2">
                      {currentPath && (
                        <button
                          onClick={() => {
                            const parent = currentPath.includes("/")
                              ? currentPath.substring(
                                  0,
                                  currentPath.lastIndexOf("/")
                                )
                              : "";
                            setCurrentPath(parent);
                          }}
                          className="w-full flex items-center gap-2 px-2 py-2 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg mb-1"
                        >
                          <ArrowLeft size={13} />
                          Go back
                        </button>
                      )}

                      {visibleFiles.map((file) => {
                        const Icon = getFileIcon(file);
                        const selected = activeFile?.id === file.id;

                        return (
                          <div
                            key={file.id}
                            className={`group flex items-center gap-1 rounded-lg px-2 py-2 text-xs mb-0.5 ${
                              selected
                                ? "bg-zinc-700 text-white"
                                : "text-zinc-300 hover:bg-zinc-800"
                            }`}
                          >
                            <button
                              onClick={() => selectFile(file)}
                              className="flex flex-1 min-w-0 items-center gap-2 text-left"
                            >
                              <Icon
                                size={15}
                                className={`shrink-0 ${getFileColor(file)}`}
                              />
                              <span className="truncate">{file.name}</span>
                            </button>

                            {file.storage_path && (
                              <button
                                onClick={() => downloadFile(file)}
                                className="text-zinc-500 hover:text-white opacity-0 group-hover:opacity-100"
                                title="Download"
                              >
                                <Download size={13} />
                              </button>
                            )}

                            <button
                              onClick={() => deleteFile(file)}
                              className="text-zinc-400 hover:text-red-500 p-1 rounded hover:bg-red-500/10"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })}

                      {visibleFiles.length === 0 && (
                        <div className="text-center text-xs text-zinc-400 py-10">
                          <Folder size={23} className="mx-auto mb-2 text-zinc-300" />
                          {search ? "No matching files" : "This folder is empty"}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-zinc-800 px-3 py-3 text-[10px] text-zinc-400 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <HardDrive size={13} />
                        {files.length} items
                      </span>
                      <span>{formatBytes(files.reduce((sum, f) => sum + (f.size_bytes || 0), 0))}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="px-3 py-3 border-b border-zinc-800 flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-[0.15em] text-zinc-400">
                        PROJECT RESOURCES
                      </span>
                      <button
                        onClick={() => setShowResourceModal(true)}
                        className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded"
                        title="Add resource"
                      >
                        <Plus size={15} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2">
                      {resources.map((resource) => (
                        <div
                          key={resource.id}
                          className="group p-3 rounded-lg hover:bg-zinc-800 border border-transparent hover:border-zinc-700 mb-1"
                        >
                          <div className="flex items-start gap-2">
                            <div className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-300 flex items-center justify-center shrink-0">
                              <Globe size={14} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <a
                                href={resource.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-semibold text-zinc-200 hover:text-blue-400 line-clamp-2"
                              >
                                {resource.title}
                              </a>
                              <p className="text-[10px] text-zinc-400 mt-1">
                                {resource.category || "Resource"}
                              </p>
                            </div>
                            <button
                              onClick={() => deleteResource(resource)}
                              className="text-zinc-400 hover:text-red-500 p-1 rounded hover:bg-red-500/10"
                              title="Delete resource"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}

                      {resources.length === 0 && (
                        <div className="text-center py-10 px-3">
                          <Link2 size={24} className="mx-auto text-zinc-300 mb-3" />
                          <p className="text-xs font-medium text-zinc-300">
                            No resources yet
                          </p>
                          <p className="text-[10px] text-zinc-400 mt-1">
                            Simpan dokumentasi dan referensi project di sini.
                          </p>
                          <button
                            onClick={() => setShowResourceModal(true)}
                            className="mt-4 text-xs font-semibold text-zinc-200 hover:text-white"
                          >
                            Add your first resource
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </aside>
            )}

            {/* CENTER EDITOR */}
            <div className="flex-1 min-w-0 flex flex-col bg-[#1e1e1e]">
              {/* EDITOR TABS */}
              <div className="h-10 bg-[#252526] border-b border-zinc-700 flex items-center overflow-x-auto">
                {activeFile ? (
                  <div className="h-full px-4 flex items-center gap-2 border-r border-zinc-700 bg-[#1e1e1e] text-xs min-w-0">
                    {(() => {
                      const Icon = getFileIcon(activeFile);
                      return (
                        <Icon
                          size={14}
                          className={getFileColor(activeFile)}
                        />
                      );
                    })()}
                    <span className="text-zinc-200 truncate max-w-[180px]">
                      {activeFile.name}
                    </span>
                    {isDirty && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    )}
                    <button
                      onClick={() => {
                        if (
                          isDirty &&
                          !window.confirm("Perubahan belum disimpan. Tutup file?")
                        ) {
                          return;
                        }
                        setActiveFile(null);
                        setEditorContent("");
                        setPreviewUrl("");
                      }}
                      className="text-zinc-500 hover:text-white ml-1"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="h-full px-4 flex items-center gap-2 text-xs text-zinc-400">
                    <Code2 size={14} />
                    Workspace
                  </div>
                )}

                <div className="ml-auto flex items-center gap-3 px-3 text-[10px] text-zinc-400">
                  {activeFile && (
                    <>
                      {saving ? "Auto-saving..." : isDirty ? "Unsaved changes" : "Saved"}
                      <span className="text-zinc-600">•</span>
                      {getLanguage(activeFile.name)}
                    </>
                  )}
                </div>
              </div>

              {/* EDITOR CONTENT */}
              <div className="flex-1 min-h-0 relative flex">
                <div className="flex-1 min-w-0 h-full relative">
                {activeFile?.storage_path && isImage(activeFile) ? (
                  <div className="h-full overflow-auto bg-[#202020] flex flex-col items-center justify-center p-6">
                    {previewLoading ? (
                      <Loader2 className="animate-spin text-zinc-400" size={28} />
                    ) : previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={activeFile.name}
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                      />
                    ) : (
                      <div className="text-center text-zinc-400">
                        <ImageIcon size={42} className="mx-auto mb-3" />
                        <p className="text-sm">Preview tidak tersedia.</p>
                      </div>
                    )}
                  </div>
                ) : activeFile?.storage_path ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-[#202020]">
                    <HardDrive size={42} className="text-zinc-500 mb-4" />
                    <h2 className="font-semibold text-white">
                      {activeFile.name}
                    </h2>
                    <p className="text-sm text-zinc-400 mt-2">
                      File ini disimpan sebagai asset di Supabase Storage.
                    </p>
                    <p className="text-xs text-zinc-500 mt-2">
                      {formatBytes(activeFile.size_bytes)}
                    </p>
                    <button
                      onClick={() => downloadFile(activeFile)}
                      className="mt-5 flex items-center gap-2 bg-white text-zinc-900 px-4 py-2 rounded-lg text-xs font-semibold hover:bg-zinc-200"
                    >
                      <Download size={15} />
                      Download file
                    </button>
                  </div>
                ) : activeFile ? (
                  <Editor
                    height="100%"
                    theme="vs-dark"
                    language={getLanguage(activeFile.name)}
                    value={editorContent}
                    onChange={(value) => setEditorContent(value || "")}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      fontFamily: "Consolas, 'Courier New', monospace",
                      padding: { top: 18 },
                      automaticLayout: true,
                      scrollBeyondLastLine: false,
                      wordWrap: "on",
                      tabSize: 2,
                      renderLineHighlight: "all",
                      smoothScrolling: true,
                      cursorBlinking: "smooth",
                      bracketPairColorization: { enabled: true },
                    }}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-[#202020]">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-5">
                      <Code2 size={30} className="text-zinc-400" />
                    </div>
                    <h2 className="text-lg font-semibold text-white">
                      {activeProject.name}
                    </h2>
                    <p className="text-sm text-zinc-400 mt-2 max-w-sm leading-6">
                      Pilih file dari Explorer untuk mulai coding, atau buat
                      struktur project-mu sendiri.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 mt-6">
                      <button
                        onClick={() => {
                          setNewItemType("file");
                          setShowNewItem(true);
                        }}
                        className="flex items-center gap-2 bg-white text-zinc-900 px-4 py-2.5 rounded-lg text-xs font-semibold hover:bg-zinc-200"
                      >
                        <FilePlus2 size={15} />
                        New file
                      </button>
                      <button
                        onClick={() => {
                          setNewItemType("folder");
                          setShowNewItem(true);
                        }}
                        className="flex items-center gap-2 border border-white/15 text-zinc-300 px-4 py-2.5 rounded-lg text-xs font-semibold hover:bg-white/5"
                      >
                        <FolderPlus size={15} />
                        New folder
                      </button>
                    </div>
                  </div>
                )}
                </div>

                {previewOpen && (
                  <div className={`${previewFullscreen ? "fixed inset-0 z-[80] w-screen h-screen" : "w-1/2 min-w-[320px]"} border-l border-zinc-700 bg-white flex flex-col`}>
                    <div className="h-10 shrink-0 bg-[#181818] border-b border-zinc-700 px-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-zinc-300">
                        <Globe size={14} />
                        Live Preview
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setPreviewFullscreen((value) => !value)}
                          className="text-zinc-400 hover:text-white"
                          title={previewFullscreen ? "Exit fullscreen" : "Fullscreen preview"}
                        >
                          {previewFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        </button>
                        <button
                          onClick={runPreview}
                          className="text-zinc-400 hover:text-white"
                          title="Refresh preview"
                        >
                          <RefreshCw size={14} />
                        </button>

                        <button
                          onClick={() => { setPreviewOpen(false); setPreviewFullscreen(false); }}
                          className="text-zinc-400 hover:text-white"
                          title="Close preview"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </div>

                    <iframe
                      title="DevVault Preview"
                      srcDoc={previewDocument}
                      sandbox="allow-scripts allow-forms allow-modals"
                      className="flex-1 w-full bg-white"
                    />
                  </div>
                )}
              </div>

              {terminalOpen && (
                <section className="h-56 shrink-0 bg-[#111111] border-t border-zinc-700 flex flex-col relative">
                  <div className="h-9 shrink-0 px-3 flex items-center justify-between border-b border-zinc-800 text-xs">
                    <div className="flex items-center gap-2 text-zinc-300">
                      <TerminalIcon size={14} />
                      <span className="font-semibold">JavaScript Runner</span>
                      <span className="text-zinc-600">— sandboxed output</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => runJavaScript()}disabled={!activeFile || Boolean(activeFile.storage_path) || !/\.(js|mjs|cjs)$/i.test(activeFile.name)} className="flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-black disabled:opacity-40"><Play size={12} /> Run JS</button>
                      <button onClick={() => setTerminalLines([])} className="text-zinc-500 hover:text-white">Clear</button>
                      <button onClick={() => setTerminalOpen(false)} className="text-zinc-500 hover:text-white" title="Close terminal"><X size={14} /></button>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-5 text-zinc-300">
                    {terminalLines.map((line, index) => <pre key={index} className="whitespace-pre-wrap break-words">{line}</pre>)}
                  </div>
                  <form onSubmit={(event) => { event.preventDefault(); runTerminalCommand(); }} className="h-9 shrink-0 flex items-center gap-2 px-3 border-t border-zinc-800">
                    <span className="text-emerald-400 font-mono text-xs">$</span>
                    <input value={terminalInput} onChange={(event) => setTerminalInput(event.target.value)} placeholder="run / node script.js / help" className="flex-1 min-w-0 bg-transparent outline-none text-xs font-mono text-white placeholder:text-zinc-600" />
                  </form>
                  {jsRunnerDocument && <iframe ref={jsRunnerRef} title="DevVault JavaScript sandbox" srcDoc={jsRunnerDocument} sandbox="allow-scripts" className="hidden" />}
                </section>
              )}

              {/* STATUS BAR */}
              <div className="h-7 bg-zinc-900 text-zinc-400 px-3 flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    DevVault Workspace
                  </span>
                  {activeFile && <span>{activeFile.path}</span>}
                </div>
                <div className="flex items-center gap-3">
                  {activeFile && <span>UTF-8</span>}
                  <span>{files.length} files</span>
                </div>
              </div>
            </div>

          </div>
        </section>
      )}

      {/* CREATE PROJECT MODAL */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold">Create Project</h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Start a new development workspace.
                </p>
              </div>
              <button
                onClick={() => setShowCreate(false)}
                className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <label className="text-xs font-semibold text-zinc-600">
              Project name
            </label>
            <input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="My awesome project"
              className="w-full mt-2 mb-4 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-zinc-400"
            />

            <label className="text-xs font-semibold text-zinc-600">
              Description
            </label>
            <textarea
              value={projectDescription}
              onChange={(event) => setProjectDescription(event.target.value)}
              placeholder="What are you building?"
              rows={3}
              className="w-full mt-2 mb-4 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-zinc-400 resize-none"
            />

            <label className="text-xs font-semibold text-zinc-600">
              Main language
            </label>
            <select
              value={projectLanguage}
              onChange={(event) => setProjectLanguage(event.target.value)}
              className="w-full mt-2 mb-6 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none"
            >
              {languages.map((language) => (
                <option key={language} value={language}>
                  {languageLabels[language] || language}
                </option>
              ))}
            </select>

            <button
              onClick={createProject}
              disabled={!projectName.trim() || busy}
              className="w-full bg-zinc-900 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-40 hover:bg-zinc-700"
            >
              {busy ? "Creating..." : "Create Project"}
            </button>
          </div>
        </div>
      )}

      {/* CREATE FILE / FOLDER MODAL */}
      {showNewItem && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#181818] text-white border border-zinc-700 rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {newItemType === "file" ? "Create New File" : "Create Folder"}
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Location: {currentPath || "Project root"}
                </p>
              </div>
              <button
                onClick={() => setShowNewItem(false)}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <input
              autoFocus
              value={newItemName}
              onChange={(event) => setNewItemName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") createItem();
              }}
              placeholder={
                newItemType === "file" ? "index.html" : "components"
              }
              className="w-full bg-[#252525] border border-zinc-600 text-white placeholder:text-zinc-500 rounded-xl px-4 py-3 text-sm outline-none focus:border-zinc-300 mb-5"
            />

            <button
              onClick={createItem}
              disabled={!newItemName.trim() || busy}
              className="w-full bg-white text-zinc-900 rounded-xl py-3 text-sm font-semibold disabled:opacity-40 hover:bg-zinc-200 transition"
            >
              {busy ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      )}

      {/* ADD RESOURCE MODAL */}
      {showResourceModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-[#181818] border border-zinc-700 rounded-2xl p-6 text-white shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-bold text-white">Add Project Resource</h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Simpan link dokumentasi atau referensi project.
                </p>
              </div>
              <button
                onClick={() => setShowResourceModal(false)}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"
                aria-label="Close resource form"
              >
                <X size={18} />
              </button>
            </div>

            <label className="block text-xs font-semibold text-zinc-300">
              Resource title
            </label>
            <input
              value={resourceTitle}
              onChange={(event) => setResourceTitle(event.target.value)}
              placeholder="React documentation"
              className="w-full mt-2 mb-4 bg-[#252525] text-white placeholder:text-zinc-500 border border-zinc-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-zinc-400"
            />

            <label className="block text-xs font-semibold text-zinc-300">
              URL
            </label>
            <input
              value={resourceUrl}
              onChange={(event) => setResourceUrl(event.target.value)}
              placeholder="https://..."
              type="url"
              className="w-full mt-2 mb-4 bg-[#252525] text-white placeholder:text-zinc-500 border border-zinc-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-zinc-400"
            />

            <label className="block text-xs font-semibold text-zinc-300">
              Category
            </label>
            <select
              value={resourceCategory}
              onChange={(event) => setResourceCategory(event.target.value)}
              className="w-full mt-2 mb-4 bg-[#252525] text-white border border-zinc-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-zinc-400"
            >
              <option className="bg-[#252525] text-white">Documentation</option>
              <option className="bg-[#252525] text-white">Tutorial</option>
              <option className="bg-[#252525] text-white">Reference</option>
              <option className="bg-[#252525] text-white">Tools</option>
              <option className="bg-[#252525] text-white">Inspiration</option>
              <option className="bg-[#252525] text-white">Other</option>
            </select>

            <label className="block text-xs font-semibold text-zinc-300">
              Description
            </label>
            <textarea
              value={resourceDescription}
              onChange={(event) => setResourceDescription(event.target.value)}
              placeholder="What is this resource for?"
              rows={2}
              className="w-full mt-2 mb-5 bg-[#252525] text-white placeholder:text-zinc-500 border border-zinc-700 rounded-xl px-4 py-3 text-sm outline-none resize-none focus:border-zinc-400"
            />

            <button
              onClick={createResource}
              disabled={!resourceTitle.trim() || !resourceUrl.trim() || busy}
              className="w-full bg-white text-zinc-900 rounded-xl py-3 text-sm font-semibold disabled:opacity-40 hover:bg-zinc-200 transition"
            >
              {busy ? "Saving..." : "Save Resource"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
