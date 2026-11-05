This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Quantity unit UI

The first stage of [#184](https://github.com/Chak-and-Jules/home-inventory-web/issues/184) prepares quantity inputs, an input-unit selector, and an independent display-unit preference in inventory forms. Until backend [#137](https://github.com/Chak-and-Jules/home-inventory-backend/issues/137) supplies the final contract, both unit selectors remain read-only and show the definition unit and inherited display. Existing quantity requests retain their current meaning and payloads. No per-entry display preference is saved yet.

`InventoryQuantityFields` owns the form layout, `QuantityInput` keeps units visible in compact editors, and `QuantityValue` formats display amounts using the selected language. Formatting does not convert units or change editable values. No catalog relationships or API fields are inferred from unit names.

The integration follow-up must map the final catalog and quantity response fields, implement compatible-unit conversion using the documented decimal precision, wire the two selectors independently, and preserve omitted/null/explicit override states. It must also update quantity requests across receipt, barcode, shopping, maintenance, recipe, and prediction workflows and cover display-only partial updates. Keep this issue open until that integration and its acceptance tests are complete.

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
