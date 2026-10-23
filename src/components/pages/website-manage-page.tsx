import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Globe, Images, Info, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge, DataTable, EmptyRow, PageHeading, Panel } from "@/components/dashboard-ui";
import { resolvePublicAssetUrl } from "@/lib/public-api";
import {
  createInstitution,
  deleteGalleryPhoto,
  deleteInstitution,
  deleteSiteDocument,
  fetchGalleryPhotos,
  fetchInstitutions,
  fetchSchoolProfile,
  fetchSiteDocuments,
  updateInstitution,
  updateSchoolProfile,
  uploadGalleryPhoto,
  uploadHeroImage,
  uploadSchoolLogo,
  uploadSiteDocument,
  type InstitutionDto,
} from "@/lib/website-api";
import { ApiError } from "@/lib/api";

type Tab = "profile" | "institutions" | "gallery" | "documents";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "profile", label: "School profile" },
  { id: "institutions", label: "Institutions" },
  { id: "gallery", label: "Photo gallery" },
  { id: "documents", label: "Documents" },
];

function ConfirmDeleteDialog({
  open,
  title,
  description,
  pending,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  description: string;
  pending: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: 420 }}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="muted-cell" style={{ fontSize: 13, margin: 0 }}>
          {description}
        </p>
        <div className="drawer-actions">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProfileTab() {
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ["website-profile"], queryFn: fetchSchoolProfile });
  const logoInputRef = useRef<HTMLInputElement>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    schoolName: "",
    tagline: "",
    aboutText: "",
    address: "",
    phone: "",
    email: "",
    mapUrl: "",
    facebookUrl: "",
    youtubeUrl: "",
    linkedinUrl: "",
    xUrl: "",
  });

  useEffect(() => {
    if (profile.data) {
      setForm({
        schoolName: profile.data.schoolName ?? "",
        tagline: profile.data.tagline ?? "",
        aboutText: profile.data.aboutText ?? "",
        address: profile.data.address ?? "",
        phone: profile.data.phone ?? "",
        email: profile.data.email ?? "",
        mapUrl: profile.data.mapUrl ?? "",
        facebookUrl: profile.data.facebookUrl ?? "",
        youtubeUrl: profile.data.youtubeUrl ?? "",
        linkedinUrl: profile.data.linkedinUrl ?? "",
        xUrl: profile.data.xUrl ?? "",
      });
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () => updateSchoolProfile(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["website-profile"] });
      toast.success("School profile updated");
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't update profile"),
  });

  const logoUpload = useMutation({
    mutationFn: (file: File) => uploadSchoolLogo(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["website-profile"] });
      toast.success("Logo updated");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't upload logo"),
  });

  const heroUpload = useMutation({
    mutationFn: (file: File) => uploadHeroImage(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["website-profile"] });
      toast.success("Hero image updated");
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't upload hero image"),
  });

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  return (
    <Panel>
      <div className="panel-title">
        <h2>School profile</h2>
      </div>
      <form
        className="student-form"
        style={{ padding: 16 }}
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <div className="two-fields" style={{ alignItems: "center" }}>
          <label>
            Logo
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
              <img
                src={profile.data?.logoUrl ? resolvePublicAssetUrl(profile.data.logoUrl) : "/logo.jpeg"}
                alt="Logo preview"
                style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover" }}
              />
              <input
                ref={logoInputRef}
                type="file"
                accept="image/jpeg,image/png"
                style={{ display: "none" }}
                onChange={(e) => e.target.files?.[0] && logoUpload.mutate(e.target.files[0])}
              />
              <Button type="button" size="sm" variant="outline" onClick={() => logoInputRef.current?.click()}>
                <Upload size={14} />
                {logoUpload.isPending ? "Uploading…" : "Change logo"}
              </Button>
            </div>
          </label>
          <label>
            Hero / campus photo
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
              <input
                ref={heroInputRef}
                type="file"
                accept="image/jpeg,image/png"
                style={{ display: "none" }}
                onChange={(e) => e.target.files?.[0] && heroUpload.mutate(e.target.files[0])}
              />
              <Button type="button" size="sm" variant="outline" onClick={() => heroInputRef.current?.click()}>
                <Upload size={14} />
                {heroUpload.isPending ? "Uploading…" : "Change hero photo"}
              </Button>
              {profile.data?.heroImageUrl && (
                <span className="muted-cell" style={{ fontSize: 11 }}>
                  Custom photo set
                </span>
              )}
            </div>
          </label>
        </div>
        <div className="two-fields">
          <label>
            School name
            <input required {...field("schoolName")} />
          </label>
          <label>
            Tagline
            <input {...field("tagline")} placeholder="Learn, Grow, Build a Better Tomorrow" />
          </label>
        </div>
        <label>
          About text <span className="muted-cell">(shown in the site footer)</span>
          <textarea {...field("aboutText")} placeholder="We are committed to providing quality education…" />
        </label>
        <div className="two-fields">
          <label>
            Address
            <input {...field("address")} placeholder="Not yet set" />
          </label>
          <label>
            Google Maps link
            <input {...field("mapUrl")} placeholder="https://maps.google.com/?q=…" />
          </label>
        </div>
        <div className="two-fields">
          <label>
            Phone
            <input {...field("phone")} placeholder="+8801…" />
          </label>
          <label>
            Email
            <input type="email" {...field("email")} placeholder="info@aphs.edu.bd" />
          </label>
        </div>
        <div className="two-fields">
          <label>
            Facebook URL
            <input {...field("facebookUrl")} placeholder="https://facebook.com/…" />
          </label>
          <label>
            YouTube URL
            <input {...field("youtubeUrl")} placeholder="https://youtube.com/…" />
          </label>
        </div>
        <div className="two-fields">
          <label>
            LinkedIn URL
            <input {...field("linkedinUrl")} placeholder="https://linkedin.com/…" />
          </label>
          <label>
            X (Twitter) URL
            <input {...field("xUrl")} placeholder="https://x.com/…" />
          </label>
        </div>
        <div className="drawer-actions" style={{ gridTemplateColumns: "1fr" }}>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function InstitutionFormDialog({
  institution,
  onOpenChange,
}: {
  institution: InstitutionDto | "new" | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = institution !== null && institution !== "new";
  const [name, setName] = useState("");
  const [caption, setCaption] = useState("");
  const [tone, setTone] = useState("blue");

  useEffect(() => {
    if (isEdit && institution) {
      setName(institution.name);
      setCaption(institution.caption ?? "");
      setTone(institution.tone);
    } else if (institution === "new") {
      setName("");
      setCaption("");
      setTone("blue");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit ? institution?.id : institution]);

  const mutation = useMutation({
    mutationFn: () =>
      isEdit && institution
        ? updateInstitution(institution.id, { name, caption, tone })
        : createInstitution({ name, caption, tone }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["website-institutions"] });
      toast.success(isEdit ? "Institution updated" : "Institution added");
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't save institution"),
  });

  return (
    <Dialog open={institution !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit institution" : "Add institution"}</DialogTitle>
        </DialogHeader>
        <form
          className="student-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <label>
            Name
            <input required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Caption
            <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="A short tagline" />
          </label>
          <label>
            Card color
            <select value={tone} onChange={(e) => setTone(e.target.value)}>
              <option value="blue">Blue</option>
              <option value="pink">Pink</option>
              <option value="green">Green</option>
              <option value="ice">Ice</option>
            </select>
          </label>
          <div className="drawer-actions">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InstitutionsTab() {
  const queryClient = useQueryClient();
  const institutions = useQuery({ queryKey: ["website-institutions"], queryFn: fetchInstitutions });
  const [editing, setEditing] = useState<InstitutionDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<InstitutionDto | null>(null);

  const remove = useMutation({
    mutationFn: (id: number) => deleteInstitution(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["website-institutions"] });
      toast.success("Institution deleted");
      setDeleting(null);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't delete institution"),
  });

  return (
    <Panel>
      <div className="panel-title">
        <h2>Institutions</h2>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus size={14} />
          Add institution
        </Button>
      </div>
      <DataTable headers={["NAME", "CAPTION", "COLOR", "ACTIONS"]} widths="1.3fr 1.5fr .7fr 1fr">
        {institutions.isLoading && <EmptyRow colSpan={4}>Loading…</EmptyRow>}
        {institutions.data?.length === 0 && (
          <EmptyRow colSpan={4}>
            No institutions added yet — the public site shows the school itself by default.
          </EmptyRow>
        )}
        {institutions.data?.map((inst) => (
          <tr key={inst.id}>
            <td>{inst.name}</td>
            <td className="muted-cell">{inst.caption || "—"}</td>
            <td>
              <Badge>{inst.tone}</Badge>
            </td>
            <td className="row-actions">
              <Button size="icon" variant="ghost" title="Edit" onClick={() => setEditing(inst)}>
                <Pencil size={16} />
              </Button>
              <Button size="icon" variant="ghost" title="Delete" onClick={() => setDeleting(inst)}>
                <Trash2 size={16} />
              </Button>
            </td>
          </tr>
        ))}
      </DataTable>
      <InstitutionFormDialog institution={editing} onOpenChange={(open) => !open && setEditing(null)} />
      <ConfirmDeleteDialog
        open={!!deleting}
        title={`Delete "${deleting?.name}"?`}
        description="This removes the institution card from the public homepage. This cannot be undone."
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
    </Panel>
  );
}

function GalleryTab() {
  const queryClient = useQueryClient();
  const gallery = useQuery({ queryKey: ["website-gallery"], queryFn: fetchGalleryPhotos });
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: (file: File) => uploadGalleryPhoto(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["website-gallery"] });
      toast.success("Photo added to gallery");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't upload photo"),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteGalleryPhoto(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["website-gallery"] });
      toast.success("Photo removed");
      setDeletingId(null);
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't delete photo"),
  });

  return (
    <Panel>
      <div className="panel-title">
        <h2>Photo gallery</h2>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png"
          style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])}
        />
        <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={upload.isPending}>
          <Upload size={14} />
          {upload.isPending ? "Uploading…" : "Upload photo"}
        </Button>
      </div>
      <div style={{ padding: 16 }}>
        {gallery.isLoading && <p className="muted-cell">Loading…</p>}
        {gallery.data?.length === 0 && (
          <p className="muted-cell" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Images size={16} /> No photos yet — upload one above.
          </p>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 12,
          }}
        >
          {gallery.data?.map((photo) => (
            <div key={photo.id} style={{ position: "relative" }}>
              <img
                src={resolvePublicAssetUrl(photo.imageUrl)}
                alt={photo.caption ?? ""}
                style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}
              />
              <Button
                size="icon"
                variant="destructive"
                style={{ position: "absolute", top: 6, right: 6, width: 28, height: 28 }}
                onClick={() => setDeletingId(photo.id)}
                aria-label="Delete photo"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      </div>
      <ConfirmDeleteDialog
        open={deletingId !== null}
        title="Delete this photo?"
        description="This removes the photo from the public homepage's gallery. This cannot be undone."
        pending={remove.isPending}
        onConfirm={() => deletingId !== null && remove.mutate(deletingId)}
        onOpenChange={(open) => !open && setDeletingId(null)}
      />
    </Panel>
  );
}

function DocumentsTab() {
  const queryClient = useQueryClient();
  const documents = useQuery({ queryKey: ["website-documents"], queryFn: fetchSiteDocuments });
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: ({ file, title }: { file: File; title: string }) => uploadSiteDocument(file, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["website-documents"] });
      toast.success("Document uploaded");
      setTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't upload document"),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteSiteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["website-documents"] });
      toast.success("Document deleted");
      setDeletingId(null);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't delete document"),
  });

  return (
    <Panel>
      <div className="panel-title">
        <h2>Document downloads</h2>
      </div>
      <form
        style={{ display: "flex", gap: 10, padding: 16, alignItems: "flex-end", flexWrap: "wrap" }}
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          const file = fileInputRef.current?.files?.[0];
          if (!file || !title.trim()) {
            toast.error("Pick a PDF and give it a title first");
            return;
          }
          upload.mutate({ file, title: title.trim() });
        }}
      >
        <label style={{ minWidth: 220 }}>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Admission Form 2026" />
        </label>
        <label style={{ minWidth: 220 }}>
          PDF file
          <input ref={fileInputRef} type="file" accept="application/pdf" />
        </label>
        <Button type="submit" disabled={upload.isPending}>
          <Upload size={14} />
          {upload.isPending ? "Uploading…" : "Upload"}
        </Button>
      </form>
      <DataTable headers={["TITLE", "ACTIONS"]} widths="3fr 1fr">
        {documents.isLoading && <EmptyRow colSpan={2}>Loading…</EmptyRow>}
        {documents.data?.length === 0 && <EmptyRow colSpan={2}>No documents uploaded yet</EmptyRow>}
        {documents.data?.map((doc) => (
          <tr key={doc.id}>
            <td>{doc.title}</td>
            <td className="row-actions">
              <Button size="icon" variant="ghost" title="Delete" onClick={() => setDeletingId(doc.id)}>
                <Trash2 size={16} />
              </Button>
            </td>
          </tr>
        ))}
      </DataTable>
      <ConfirmDeleteDialog
        open={deletingId !== null}
        title="Delete this document?"
        description="This removes the document from the public homepage's Document Download list. This cannot be undone."
        pending={remove.isPending}
        onConfirm={() => deletingId !== null && remove.mutate(deletingId)}
        onOpenChange={(open) => !open && setDeletingId(null)}
      />
    </Panel>
  );
}

export function WebsiteManagePage() {
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <>
      <PageHeading
        title="Website manage"
        subtitle="Content shown on the public homepage — profile, institutions, gallery, and documents"
      />
      <p
        className="muted-cell"
        style={{ display: "flex", alignItems: "center", gap: 8, marginTop: -10, marginBottom: 16, fontSize: 12 }}
      >
        <Info size={14} />
        Notices and exam results are published from their own pages (look for the{" "}
        <Globe size={12} style={{ display: "inline" }} /> icon) — this page only covers content that has no
        other home.
      </p>
      <div className="finance-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "finance-tab active" : "finance-tab"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "profile" && <ProfileTab />}
      {tab === "institutions" && <InstitutionsTab />}
      {tab === "gallery" && <GalleryTab />}
      {tab === "documents" && <DocumentsTab />}
    </>
  );
}
