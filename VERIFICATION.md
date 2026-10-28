# Verification record

## Automated checks

- TypeScript production compilation.
- ESLint.
- Vitest content and demo publishing tests.
- Database migration executed in embedded PostgreSQL (PGlite), testing actual grants, RLS policies, and publishing functions.
- Repository-subdirectory production build with `VITE_BASE_PATH=/Hari-Portfolio/`.

## Browser checks

Verified in the local browser:

- Desktop public portfolio and dashboard render with the self-hosted reference fonts.
- A project can be created and saved as a private draft.
- The draft is absent from a separate public tab until publication.
- Publishing adds the project to the second tab; subsequent private title edits do not alter the public title.
- A JPEG can be uploaded to the local demo library; an optimized WebP and responsive derivatives are created, retaining the original.
- A demo contact submission appears in the private demo inquiries list.
- A custom page can be created, populated with a text block, published, and opened directly by its route. Bold formatting renders as semantic text.
- The public site and admin have no page-wide horizontal overflow at 390px. The admin drawer opens and closes, and the closed drawer is removed from keyboard/accessibility navigation.
- The production build runs under `/Hari-Portfolio/`, including admin navigation and artwork/font loading.
- The supplied contact email and social profile links appear on the production preview.

No live Supabase connection or GitHub deployment is claimed. Image upload tests use the explicit browser-local demo adapter; deployed signed upload and finalization endpoints still require a live integration check. Video storage and OAuth are not claimed as browser-verified.

## Performance interpretation

Final build: public JavaScript 577.24 KB / 167.85 KB gzip; lazy admin JavaScript 62.03 KB / 18.33 KB gzip. Public CSS 24.14 KB / 5.80 KB gzip; lazy admin CSS 30.09 KB / 6.86 KB gzip. The three self-hosted Latin font files total approximately 111 KB. The hero SVG is approximately 72 KB.

These are build-size estimates, not Core Web Vitals measurements. LCP, CLS, and INP were not measured under a standardized performance profile. No claim of a guaranteed zero-lag experience is made.

Final automated result: **20 tests passed**, ESLint passed, TypeScript passed, and the production build passed.

## Live launch checks still requiring configuration

- Supabase migrations and backend functions deployed.
- First owner provisioned; new public signups disabled.
- OAuth and invitation callbacks on the exact Pages URL.
- SMTP/invitation delivery.
- Real image/video upload and private/public media access.
- Inquiry edge-function proxy headers and rate limiting.
- Publishing and inquiry access from a second device.
- GitHub Actions execution in the target repository.
- Real portfolio assets, email address, availability, and current profile details reviewed by the owner.
