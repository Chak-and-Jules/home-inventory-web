This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Quantities and units

The web client follows the contract merged in backend [PR #138](https://github.com/Chak-and-Jules/home-inventory-backend/pull/138), verified at merge commit `1746d7dc9fedb0e508f53206d27a8e6e228c295b`. The final review added backend tests without changing production code or OpenAPI. Coordinate release with that backend change and its fresh database; no client-side data backfill is performed.

Stock, thresholds, targets, linked shopping amounts, maintenance dependencies, recipe requirements, and prediction amounts use family base units. `SizeUnit.Family`, `FactorToBase`, and `base_size_unit_id` identify compatible choices and conversions. Inventory displays use the entry override when present, otherwise the definition default. Raw base amounts are never labelled with a different display unit.

Inventory forms and quick edits keep the input unit independent from the saved display preference. Input-unit switches preserve the represented amount. Saves use `PATCH /inventory/{id}` with only changed fields: omitted overrides are preserved, `null` restores inheritance, and an explicit ID remains explicit even when equal to the default. Display-only edits omit quantity and expiry. Quantity inputs include `quantity_unit_id`; barcode changes remain signed deltas and prediction application remains a deduction.

`quantityUnits.ts` uses exact integer arithmetic for conversion and validation before the JSON number boundary. The contract supports six fractional base-unit digits and amounts up to 1,000,000,000 base units. For example, `0.000000001 kg` represents `0.000001 g`. Quantity fields use decimal text inputs so native number controls cannot round their value on blur. Decimal points and commas are accepted without thousands separators; `QuantityValue` handles localized presentation. The shared catalog cache also supports explicit receipt-unit confirmation. Receipt prices and unlinked shopping counts keep their existing independent meanings; unlinked counts must also satisfy the six-decimal-place and 1,000,000,000 quantity limits.

Predictive restock suggestions use the unmet target shortage first, then the unmet low-stock threshold shortage, then one definition unit. Every shortage is calculated in base units before presentation or submission. Automatic shopping-list updates triggered by backend stock changes remain controlled by the backend's separate policy.

Older catalogs without conversion metadata keep the unit controls read-only and retain their existing quantity request semantics during rollout. The recipe UI is being delivered separately; shared recipe request/response types include the new unit fields and response casing.

## Getting Started

Install packages:

```bash
npm install
```

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
