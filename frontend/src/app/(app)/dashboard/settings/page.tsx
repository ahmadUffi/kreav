import { Card, Input, Button, Badge } from "@/components/ui";
import { currentCreator } from "@/lib/mock";

export default function DashboardSettingsPage() {
  return (
    <div className="max-w-[560px]">
      <h1 className="mb-5" style={{ fontFamily: "var(--font-anton)", fontSize: "clamp(26px, 3.4vw, 38px)", lineHeight: 1.05 }}>
        Settings
      </h1>

      <Card style={{ padding: 24 }}>
        <div className="mb-4" style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700 }}>
          Profile
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Input id="displayName" label="Display name" defaultValue={currentCreator.displayName} />
          <Input id="username" label="Username" defaultValue={currentCreator.username} />
          <Input id="country" label="Country" defaultValue={currentCreator.country} />
        </div>
        <div className="mt-5">
          <Button variant="primary">Save changes</Button>
        </div>
      </Card>

      <Card style={{ padding: 24, marginTop: 16 }}>
        <div className="mb-2" style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700 }}>
          Appearance
        </div>
        <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.6, color: "var(--muted)" }}>
          Light / dark theme is controlled from the top navigation toggle. <Badge tone="neutral">Demo</Badge>
        </p>
      </Card>
    </div>
  );
}
