"use client";
import { useState } from "react";
import { Card, Button, EmptyState, Input } from "@/components/ui";
import { useSession } from "@/lib/api/useSession";
import { useApiQuery, useApiAction } from "@/lib/api/hooks";
import { SessionNotice } from "@/components/SessionNotice";
import { listProducts, createProduct } from "@/lib/api/products";

const PRICE_RE = /^\d+(\.\d{1,2})?$/;

export default function DashboardProductsPage() {
  const { ready, userId } = useSession();
  const { data, loading, error, refetch } = useApiQuery(
    () => listProducts({ creatorId: userId!, limit: 50 }),
    [userId],
    ready && !!userId,
  );
  const [showForm, setShowForm] = useState(false);

  if (ready && !userId) return <SessionNotice />;
  const products = data?.items ?? [];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h1 style={{ fontFamily: "var(--font-anton)", fontSize: "clamp(26px, 3.4vw, 38px)", lineHeight: 1.05 }}>
          Products
        </h1>
        <Button variant="primary" onClick={() => setShowForm(true)}>+ New product</Button>
      </div>

      {!ready || loading ? (
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>Loading…</p>
      ) : error ? (
        <Card className="text-center" style={{ padding: 32 }}>
          <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>{error.message}</p>
        </Card>
      ) : products.length === 0 ? (
        <EmptyState title="No products yet" description="Publish your first digital product to start selling." actionLabel="New product" onAction={() => setShowForm(true)} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
          {products.map((p) => (
            <Card key={p.id} hover padding={0} style={{ overflow: "hidden" }}>
              <div className="flex h-[100px] items-center justify-center" style={{ background: p.accent, fontSize: 40 }}>
                {p.emoji}
              </div>
              <div className="p-4">
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>{p.title}</div>
                <div className="mt-3 flex items-center justify-between">
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>{p.category}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 800 }}>${p.price}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && userId && (
        <NewProductForm
          creatorId={userId}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function NewProductForm({
  creatorId,
  onClose,
  onCreated,
}: {
  creatorId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [priceUsd, setPriceUsd] = useState("");
  const [localErr, setLocalErr] = useState<string | null>(null);
  const { run, pending, error } = useApiAction(createProduct);

  const submit = async () => {
    setLocalErr(null);
    if (!title.trim()) return setLocalErr("Title is required.");
    if (!fileUrl.trim()) return setLocalErr("A file URL is required.");
    if (!PRICE_RE.test(priceUsd)) return setLocalErr("Price must be a number like 18 or 18.00.");
    const created = await run({
      title: title.trim(),
      description: description.trim() || undefined,
      fileUrl: fileUrl.trim(),
      priceUsd,
      creatorId,
    });
    if (created) onCreated();
  };

  const message = localErr ?? error?.message ?? null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(10,10,10,.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "8vh 16px",
        overflowY: "auto",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460 }}>
        <Card style={{ padding: 24 }}>
          <div className="mb-4 flex items-center justify-between">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700 }}>New product</span>
            <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 18, color: "var(--muted)" }}>
              ✕
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input id="title" label="Title" placeholder="Lightroom Sunset Presets" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input id="desc" label="Description (optional)" placeholder="Short description" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Input id="fileUrl" label="File URL" placeholder="https://…/download.zip" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} />
            <Input id="price" label="Price (USD)" placeholder="18.00" value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} />
          </div>
          {message && (
            <p style={{ margin: "12px 0 0", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--tone-danger-fg, #b23a00)" }}>{message}</p>
          )}
          <div className="mt-5 flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" disabled={pending} onClick={submit}>
              {pending ? "Creating…" : "Create product"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
