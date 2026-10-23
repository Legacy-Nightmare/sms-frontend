import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Globe, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge, DataTable, EmptyRow, PageHeading, Panel } from "@/components/dashboard-ui";
import { fetchClasses } from "@/lib/academics-api";
import {
  createNotice,
  deleteNotice,
  fetchNotices,
  publishNotice,
  publishNoticeToWebsite,
  unpublishNoticeFromWebsite,
  updateNotice,
  type NoticeDto,
} from "@/lib/notices-api";
import { ApiError } from "@/lib/api";

function EditNoticeDialog({
  notice,
  onOpenChange,
}: {
  notice: NoticeDto | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const classes = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [classId, setClassId] = useState("");

  useEffect(() => {
    if (notice) {
      setTitle(notice.title);
      setBody(notice.body);
      setClassId(notice.classId ? String(notice.classId) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice?.id]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!notice) throw new Error("No notice selected");
      return updateNotice(notice.id, {
        title,
        body,
        classId: classId ? parseInt(classId, 10) : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notices"] });
      toast.success("Notice updated");
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't update notice"),
  });

  return (
    <Dialog open={!!notice} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit notice</DialogTitle>
        </DialogHeader>
        {notice && (
          <form
            className="student-form"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            <label>
              Title
              <input required value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              Audience
              <select value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">All classes</option>
                {classes.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    Class {c.level}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Message
              <textarea required value={body} onChange={(e) => setBody(e.target.value)} />
            </label>
            <div className="drawer-actions">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeleteNoticeDialog({
  notice,
  onOpenChange,
}: {
  notice: NoticeDto | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: (id: number) => deleteNotice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notices"] });
      toast.success("Notice deleted");
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't delete notice"),
  });

  return (
    <Dialog open={!!notice} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: 420 }}>
        <DialogHeader>
          <DialogTitle>Delete &quot;{notice?.title}&quot;?</DialogTitle>
        </DialogHeader>
        <p className="muted-cell" style={{ fontSize: 13, margin: 0 }}>
          This permanently removes this notice. If it was already published, guardians who received
          it keep their copy — this only removes it from the admin list. This cannot be undone.
        </p>
        <div className="drawer-actions">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => notice && remove.mutate(notice.id)}
          >
            {remove.isPending ? "Deleting…" : "Delete notice"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function NoticesPage() {
  const queryClient = useQueryClient();
  const notices = useQuery({ queryKey: ["notices"], queryFn: fetchNotices });
  const classes = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [classId, setClassId] = useState("");
  const [editingNotice, setEditingNotice] = useState<NoticeDto | null>(null);
  const [deletingNotice, setDeletingNotice] = useState<NoticeDto | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      createNotice({ title, body, classId: classId ? parseInt(classId, 10) : undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notices"] });
      toast.success("Notice saved as draft");
      setTitle("");
      setBody("");
      setClassId("");
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't save notice"),
  });

  const publishMutation = useMutation({
    mutationFn: (id: number) => publishNotice(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["notices"] });
      toast.success(`Published — emailed ${res.emailed} guardian(s)`);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't publish notice"),
  });

  // Independent of publishMutation above — this only controls whether the
  // notice shows on the public homepage's Notice Board, no email involved.
  const toggleWebsiteMutation = useMutation({
    mutationFn: (notice: NoticeDto) =>
      notice.publishedToWebsiteAt
        ? unpublishNoticeFromWebsite(notice.id)
        : publishNoticeToWebsite(notice.id),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["notices"] });
      toast.success(updated.publishedToWebsiteAt ? "Published to website" : "Removed from website");
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't update website visibility"),
  });

  return (
    <>
      <PageHeading title="Notices" subtitle="Publishing emails every targeted guardian" />
      <div className="notices-grid">
        <Panel>
          <div className="panel-title">
            <h2>All notices</h2>
          </div>
          <DataTable
            headers={["TITLE", "AUDIENCE", "STATUS", "ACTIONS"]}
            widths="1.5fr .7fr .55fr 1.3fr"
          >
            {notices.isLoading && <EmptyRow colSpan={4}>Loading…</EmptyRow>}
            {notices.data?.length === 0 && <EmptyRow colSpan={4}>No notices yet</EmptyRow>}
            {notices.data?.map((notice) => (
              <tr key={notice.id}>
                <td>{notice.title}</td>
                <td>
                  {notice.classEntity ? (
                    <Badge tone="purple">{notice.classEntity.name}</Badge>
                  ) : (
                    <Badge>All classes</Badge>
                  )}
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {notice.publishedAt ? (
                      <Badge tone="green">Published</Badge>
                    ) : (
                      <Badge>Draft</Badge>
                    )}
                    {notice.publishedToWebsiteAt && <Badge tone="teal">On site</Badge>}
                  </div>
                </td>
                <td className="row-actions">
                  {!notice.publishedAt && (
                    <Button
                      size="sm"
                      disabled={publishMutation.isPending}
                      onClick={() => publishMutation.mutate(notice.id)}
                    >
                      Publish
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    title={notice.publishedToWebsiteAt ? "Remove from website" : "Publish to website"}
                    disabled={toggleWebsiteMutation.isPending}
                    onClick={() => toggleWebsiteMutation.mutate(notice)}
                  >
                    <Globe size={16} color={notice.publishedToWebsiteAt ? "var(--teal)" : undefined} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Edit notice"
                    onClick={() => setEditingNotice(notice)}
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Delete notice"
                    onClick={() => setDeletingNotice(notice)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </td>
              </tr>
            ))}
          </DataTable>
        </Panel>
        <Panel className="notice-form">
          <div className="panel-title">
            <h2>New notice</h2>
          </div>
          <form
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              createMutation.mutate();
            }}
          >
            <label>
              Title
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Winter break schedule"
              />
            </label>
            <label>
              Audience
              <select value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">All classes</option>
                {classes.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    Class {c.level}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Message
              <textarea
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="The school will remain closed for winter break from 20 December to 2 January. Classes resume 3 January."
              />
            </label>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving…" : "Save as draft"}
            </Button>
          </form>
        </Panel>
      </div>

      <EditNoticeDialog
        notice={editingNotice}
        onOpenChange={(open) => !open && setEditingNotice(null)}
      />
      <DeleteNoticeDialog
        notice={deletingNotice}
        onOpenChange={(open) => !open && setDeletingNotice(null)}
      />
    </>
  );
}
