# AlumiFlow Field / Web 0.5 — Pilot Feedback Backlog

Field 0.4.0 is frozen for Pilot. The following non-blocking feedback is intentionally deferred to the 0.5 Pilot Feedback / Stabilization iteration.

## Mobile — company appearance / branding

Goal: allow limited per-company visual branding without compromising usability or semantic status colors.

Candidate scope:

```text
Company branding
→ primary color
→ optional accent color
→ safe fallback to AlumiFlow defaults
→ contrast validation
```

Do not make success/warning/danger/offline semantic colors fully tenant-controlled. Branding should primarily affect identity surfaces and selected primary actions.

Potential bootstrap payload:

```json
{
  "branding": {
    "primary_color": "#...",
    "accent_color": "#..."
  }
}
```

This requires a backend/company-setting contract before Field implementation.

## Web — Product Master Simple / Advanced mode

Pilot feedback: Product Master is too complex for many small-to-mid workshop users and creates unnecessary learning curve.

Direction:

**One domain model, two UX levels.** Simple mode hides complexity; it must not create a separate product database/model or destroy advanced data.

Simple mode candidate:

```text
Nama Produk
Kategori
Satuan
Harga
Deskripsi (optional)
Status aktif
```

Advanced mode can expose the existing/professional configuration such as product codes, material/BOM detail, dimension/parameter rules, waste/pricing configuration, and future professional settings.

Candidate company setting:

```text
Product Setup
○ Simple
○ Advanced
```

Before implementation, audit the current Product schema and screens so the toggle is presentation/capability driven rather than a destructive schema split.

## Pilot feedback process

For each new Pilot note, classify it first:

```text
BLOCKER
→ prevents field/business work, risks data loss, security, or invalid result
→ candidate hotfix to frozen release

UX FRICTION
→ work can continue but flow is confusing/slow
→ 0.5 backlog

NICE TO HAVE
→ enhancement without operational impact
→ later roadmap
```

Avoid reopening Field 0.4 for non-blocking feature expansion.
