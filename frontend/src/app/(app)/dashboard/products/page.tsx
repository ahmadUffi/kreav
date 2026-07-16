"use client";
import { useEffect, useState } from "react";
import { Card, Button, EmptyState, Input } from "@/components/ui";
import { useSession } from "@/lib/api/useSession";
import { useApiQuery, useApiAction } from "@/lib/api/hooks";
import { SessionNotice } from "@/components/SessionNotice";
import {
  listProducts,
  createProduct,
  updateProduct,
  getProduct,
  archiveProduct,
  restoreProduct,
} from "@/lib/api/products";
import { getBalance } from "@/lib/api/wallet";
import { ProductGridSkeleton } from "@/components/skeletons";
import type { CreateProductCollaborator, CreateProductBody } from "@/lib/api/types";
import type { Product } from "@/lib/types";

const PRICE_RE = /^\d+(\.\d{1,2})?$/;
const PCT_RE = /^\d+(\.\d{1,2})?$/;
const STELLAR_RE = /^G[A-Z2-7]{55}$/;
const PLATFORM_FEE_BPS = 500; // 5% — mirrors the smart contract + settlement service

/**
 * Preview the on-chain split, in integer cents, so the number shown matches what
 * settlement will actually pay: 5% platform fee first, then the net pool divided
 * by share — the LAST recipient absorbs the rounding remainder, exactly like the
 * contract's `calculate_creator_amounts`.
 */
function computeSplit(priceUsd: string, shares: number[]) {
  const totalCents = Math.round(Number(priceUsd) * 100);
  const feeCents = Math.floor((totalCents * PLATFORM_FEE_BPS) / 10000);
  const poolCents = totalCents - feeCents;
  let distributed = 0;
  const recipientCents = shares.map((pct, i) => {
    if (i === shares.length - 1) return poolCents - distributed;
    const bps = Math.round(pct * 100);
    const cents = Math.floor((poolCents * bps) / 10000);
    distributed += cents;
    return cents;
  });
  return { feeCents, poolCents, recipientCents };
}
const usd = (cents: number) => (cents / 100).toFixed(2);

export default function DashboardProductsPage() {
  const { ready, userId } = useSession();
  const { data, loading, error, refetch } = useApiQuery(
    () => listProducts({ creatorId: userId!, limit: 50 }),
    [userId],
    ready && !!userId,
  );
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Product creation needs a payable wallet — gate the CTA on a USDC trustline.
  const { data: balance } = useApiQuery(() => getBalance(), [userId], ready && !!userId);
  const canCreate = !!balance?.hasUsdcTrustline;

  // Open the form in edit mode: fetch the full product (list rows lack the
  // collaborator split) then hydrate.
  const startEdit = async (id: string) => {
    setBusyId(id);
    try {
      const full = await getProduct(id);
      setEditing(full);
      setShowForm(true);
    } finally {
      setBusyId(null);
    }
  };

  const toggleArchive = async (p: Product) => {
    setBusyId(p.id);
    try {
      if (p.status === "ARCHIVED") await restoreProduct(p.id);
      else await archiveProduct(p.id);
      refetch();
    } finally {
      setBusyId(null);
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  if (ready && !userId) return <SessionNotice />;
  const products = data?.items ?? [];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h1 style={{ fontFamily: "var(--font-anton)", fontSize: "clamp(26px, 3.4vw, 38px)", lineHeight: 1.05 }}>
          Products
        </h1>
        <Button
          variant="primary"
          disabled={!canCreate}
          title={canCreate ? undefined : "Activate your USDC trustline first"}
          onClick={() => canCreate && setShowForm(true)}
        >
          + New product
        </Button>
      </div>

      {!ready || loading ? (
        <ProductGridSkeleton />
      ) : error ? (
        <Card className="text-center" style={{ padding: 32 }}>
          <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>{error.message}</p>
        </Card>
      ) : products.length === 0 ? (
        <EmptyState
          title="No products yet"
          description={
            canCreate
              ? "Publish your first digital product to start selling."
              : "Activate your USDC trustline (banner above) to publish your first product."
          }
          actionLabel={canCreate ? "New product" : undefined}
          onAction={canCreate ? () => setShowForm(true) : undefined}
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
          {products.map((p) => {
            const archived = p.status === "ARCHIVED";
            const busy = busyId === p.id;
            return (
              <Card key={p.id} padding={0} style={{ overflow: "hidden", opacity: archived ? 0.6 : 1 }}>
                <div className="relative flex h-[100px] items-center justify-center" style={{ background: p.accent, fontSize: 40 }}>
                  {p.emoji}
                  {archived && (
                    <span
                      style={{
                        position: "absolute",
                        top: 8,
                        left: 8,
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        background: "var(--card)",
                        color: "var(--muted)",
                        borderRadius: 999,
                        padding: "3px 8px",
                      }}
                    >
                      Archived
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>{p.title}</div>
                  <div className="mt-3 flex items-center justify-between">
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>{p.category}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 800 }}>${p.price}</span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button variant="secondary" onClick={() => void startEdit(p.id)} disabled={busy} style={{ flex: 1, padding: "8px 10px", fontSize: 12 }}>
                      Edit
                    </Button>
                    <Button variant="ghost" onClick={() => void toggleArchive(p)} disabled={busy} style={{ padding: "8px 10px", fontSize: 12 }}>
                      {archived ? "Restore" : "Archive"}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showForm && userId && (
        <NewProductForm
          editing={editing}
          onClose={closeForm}
          onCreated={() => {
            closeForm();
            refetch();
          }}
        />
      )}
    </div>
  );
}

function NewProductForm({
  editing,
  onClose,
  onCreated,
}: {
  editing?: Product | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { walletAddress } = useSession();
  const isEdit = !!editing;
  // Seed collaborators from the edited product, creator wallet first (row 0 is
  // always the locked creator row). >1 recipient → split was enabled.
  const seededCollabs = (editing?.collaborators ?? [])
    .slice()
    .sort((a, b) => (a.walletAddress === walletAddress ? -1 : b.walletAddress === walletAddress ? 1 : 0));

  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [fileUrl, setFileUrl] = useState(editing?.fileUrl ?? "");
  const [priceUsd, setPriceUsd] = useState(editing ? editing.price.toFixed(2) : "");
  const [splitEnabled, setSplitEnabled] = useState(seededCollabs.length > 1);
  const [collaborators, setCollaborators] = useState<CreateProductCollaborator[]>(
    seededCollabs.length > 1
      ? seededCollabs.map((c) => ({ ...c }))
      : [{ walletAddress: "", role: "", revenuePercentage: "" }],
  );
  const [localErr, setLocalErr] = useState<string | null>(null);
  const { run, pending, error } = useApiAction(
    isEdit ? (body: CreateProductBody) => updateProduct(editing!.id, body) : createProduct,
  );

  const updateCollaborator = (i: number, patch: Partial<CreateProductCollaborator>) =>
    setCollaborators((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const addCollaborator = () =>
    setCollaborators((prev) => [...prev, { walletAddress: "", role: "", revenuePercentage: "" }]);
  const removeCollaborator = (i: number) =>
    setCollaborators((prev) => prev.filter((_, idx) => idx !== i));

  // Turning split on pre-fills the first row as the creator (their wallet), so
  // the default is "you keep a stake" rather than a blank slate to give away.
  const toggleSplit = (on: boolean) => {
    setSplitEnabled(on);
    if (on) {
      setCollaborators((prev) =>
        prev.length === 1 && !prev[0].walletAddress && !prev[0].role && !prev[0].revenuePercentage
          ? [{ walletAddress: walletAddress ?? "", role: "Creator", revenuePercentage: "" }]
          : prev,
      );
    }
  };

  // Row 0 is ALWAYS the creator; keep its wallet locked to the session wallet
  // even if the session resolves after the form mounts. The address input is
  // read-only in the UI, so this is the only writer of row 0's wallet.
  useEffect(() => {
    if (!splitEnabled || !walletAddress) return;
    queueMicrotask(() => {
      setCollaborators((prev) =>
        prev[0] && prev[0].walletAddress === walletAddress
          ? prev
          : prev.map((c, i) => (i === 0 ? { ...c, walletAddress } : c)),
      );
    });
  }, [splitEnabled, walletAddress]);

  // Live sum of the split (only meaningful while splitEnabled).
  const pctSum = collaborators.reduce(
    (acc, c) => acc + (PCT_RE.test(c.revenuePercentage.trim()) ? Number(c.revenuePercentage) : 0),
    0,
  );

  // Validate the full split the SAME way as submit, returning null when OK.
  // Mirrors the contract's guards: valid address, positive share, no duplicate
  // wallet, creator must be included, total exactly 100.
  const validateSplit = (): string | null => {
    if (!walletAddress) return "Connect a wallet before splitting revenue.";
    const rows = collaborators.map((c) => ({
      walletAddress: c.walletAddress.trim(),
      role: c.role.trim(),
      revenuePercentage: c.revenuePercentage.trim(),
    }));
    const seen = new Set<string>();
    for (const c of rows) {
      if (!STELLAR_RE.test(c.walletAddress))
        return "Each collaborator needs a valid Stellar address (G… 56 chars).";
      if (seen.has(c.walletAddress)) return "Each wallet can appear only once in the split.";
      seen.add(c.walletAddress);
      if (!c.role) return "Each collaborator needs a role.";
      if (!PCT_RE.test(c.revenuePercentage) || Number(c.revenuePercentage) <= 0)
        return "Each share must be a number greater than 0 (e.g. 50 or 33.33).";
    }
    if (walletAddress && !seen.has(walletAddress))
      return "Include your own wallet in the split — you can't give away 100%.";
    const sum = rows.reduce((acc, c) => acc + Number(c.revenuePercentage), 0);
    if (Math.abs(sum - 100) > 0.001) return `Revenue shares must sum to 100% (currently ${sum}%).`;
    return null;
  };

  // Live money breakdown shown under the form. For the no-split case the creator
  // is the sole recipient (100% of the net pool). For the split case it only
  // renders once the shares are valid + sum to 100, so the numbers are real.
  const priceValid = PRICE_RE.test(priceUsd);
  const splitValid = splitEnabled && validateSplit() === null;
  const breakdownRows = splitEnabled
    ? collaborators.map((c) => ({ label: c.role.trim() || "Collaborator", pct: Number(c.revenuePercentage) }))
    : [{ label: "You (creator)", pct: 100 }];
  const breakdown =
    priceValid && (!splitEnabled || splitValid)
      ? computeSplit(priceUsd, breakdownRows.map((r) => r.pct))
      : null;

  const submit = async () => {
    setLocalErr(null);
    if (!title.trim()) return setLocalErr("Title is required.");
    if (!fileUrl.trim()) return setLocalErr("A file URL is required.");
    if (!PRICE_RE.test(priceUsd)) return setLocalErr("Price must be a number like 18 or 18.00.");

    // Revenue split is optional. When off, the backend auto-adds the creator
    // at 100%. When on, validate the recipient list (contract-equivalent rules).
    let collabPayload: CreateProductCollaborator[] | undefined;
    if (splitEnabled) {
      const err = validateSplit();
      if (err) return setLocalErr(err);
      collabPayload = collaborators.map((c) => ({
        walletAddress: c.walletAddress.trim(),
        role: c.role.trim(),
        revenuePercentage: c.revenuePercentage.trim(),
      }));
    }

    // Creator identity comes from the session token (Fase 1).
    const created = await run({
      title: title.trim(),
      description: description.trim() || undefined,
      fileUrl: fileUrl.trim(),
      priceUsd,
      collaborators: collabPayload,
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
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700 }}>{isEdit ? "Edit product" : "New product"}</span>
            <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 18, color: "var(--muted)" }}>
              ✕
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input id="title" label="Title" placeholder="Lightroom Sunset Presets" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input id="desc" label="Description (optional)" placeholder="Short description" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Input id="fileUrl" label="File URL" placeholder="https://…/download.zip" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} />
            <Input id="price" label="Price (USD)" placeholder="18.00" value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} />

            {/* Optional revenue split. Off → backend gives the creator 100%. */}
            <div style={{ borderTop: "1.5px solid var(--line, rgba(10,10,10,.14))", paddingTop: 16 }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={splitEnabled}
                  onChange={(e) => toggleSplit(e.target.checked)}
                  style={{ marginTop: 2, accentColor: "#FFE600", width: 16, height: 16 }}
                />
                <span>
                  <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                    Split revenue with collaborators
                  </span>
                  <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    Off — you keep 100%. On — divide shares across wallets (must total 100%).
                  </span>
                </span>
              </label>

              {splitEnabled && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
                  {collaborators.map((c, i) => {
                    const isCreator = i === 0;
                    return (
                      <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: "var(--r-sm, 8px)", border: "1.5px solid var(--line, rgba(10,10,10,.14))", background: "var(--surface-2, transparent)" }}>
                        <div className="flex items-center justify-between">
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>
                            {isCreator ? "You (creator)" : `Collaborator ${i}`}
                          </span>
                          {!isCreator && (
                            <button
                              type="button"
                              onClick={() => removeCollaborator(i)}
                              aria-label={`Remove collaborator ${i}`}
                              style={{ background: "transparent", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--tone-danger-fg, #FF4D00)" }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        {isCreator ? (
                          // Creator's own wallet — locked (readable, never editable).
                          <Input
                            id="collab-wallet-0"
                            label="Your wallet (locked)"
                            value={c.walletAddress}
                            readOnly
                            style={{ background: "var(--surface-2, rgba(10,10,10,.04))", color: "var(--muted)", cursor: "not-allowed" }}
                          />
                        ) : (
                          <Input
                            id={`collab-wallet-${i}`}
                            label="Wallet address"
                            placeholder="G…"
                            value={c.walletAddress}
                            onChange={(e) => updateCollaborator(i, { walletAddress: e.target.value.trim() })}
                          />
                        )}
                        <div className="flex gap-3">
                          <Input
                            id={`collab-role-${i}`}
                            label="Role"
                            placeholder={isCreator ? "Creator" : "Author"}
                            value={c.role}
                            onChange={(e) => updateCollaborator(i, { role: e.target.value })}
                          />
                          <Input
                            id={`collab-pct-${i}`}
                            label="Share %"
                            placeholder="50"
                            value={c.revenuePercentage}
                            onChange={(e) => updateCollaborator(i, { revenuePercentage: e.target.value })}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" onClick={addCollaborator}>+ Add collaborator</Button>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: Math.abs(pctSum - 100) < 0.001 ? "var(--tone-success-fg, #1a7f37)" : "var(--muted)" }}>
                      Total: {pctSum}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Payout preview — mirrors the on-chain split (5% platform fee). */}
            {breakdown && (
              <div style={{ borderRadius: "var(--r-sm, 8px)", border: "1.5px solid var(--line, rgba(10,10,10,.14))", background: "var(--surface-2, transparent)", padding: 14 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 10 }}>
                  Payout per sale
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {breakdownRows.map((r, i) => (
                    <div key={i} className="flex items-center justify-between" style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
                      <span style={{ color: "var(--text)" }}>
                        {r.label} <span style={{ color: "var(--muted)" }}>· {r.pct}%</span>
                      </span>
                      <span style={{ fontWeight: 700 }}>${usd(breakdown.recipientCents[i])}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between" style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
                    <span style={{ color: "var(--muted)" }}>Platform fee · 5%</span>
                    <span style={{ color: "var(--muted)" }}>${usd(breakdown.feeCents)}</span>
                  </div>
                  <div className="flex items-center justify-between" style={{ borderTop: "1.5px solid var(--line, rgba(10,10,10,.14))", paddingTop: 7, fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 800 }}>
                    <span>Buyer pays</span>
                    <span>${usd(breakdown.feeCents + breakdown.poolCents)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          {message && (
            <p style={{ margin: "12px 0 0", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--tone-danger-fg, #b23a00)" }}>{message}</p>
          )}
          <div className="mt-5 flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" disabled={pending} onClick={submit}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Create product"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
