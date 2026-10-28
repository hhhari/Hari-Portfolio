# Hari — Kinetic Showcase

A motion design portfolio and content workspace, prepared for **[hhhari/Hari-Portfolio](https://github.com/hhhari/Hari-Portfolio)**.

Public site: `https://hhhari.github.io/Hari-Portfolio/`  
Admin: `https://hhhari.github.io/Hari-Portfolio/#/admin`

The interface follows the supplied Base44 portfolio and dashboard references. It is independently implemented; no Base44 services are required. Public fonts are Space Grotesk, Inter, and JetBrains Mono, self-hosted from Fontsource under their included OFL licenses. Abstract demonstration artwork is generated locally by `tools/artwork.mjs`; it is not a record of client commissions.

## Current status

The frontend, database migration, backend functions, tests, and deployment workflow are included. A live Supabase project has **not** been connected. OAuth, delivery of invitation emails, real file storage, live inquiries, and multi-device publishing require the setup below. Local demonstration mode uses IndexedDB, explicitly labeled in the admin and contact form. It is not a production database or a login system.

Owner defaults come from the supplied [Behance profile](https://www.behance.net/hariportfolio): Sreehari Puthoorammal, Abu Dhabi, graphic design, motion graphics, and web design. The supplied [LinkedIn profile](https://www.linkedin.com/in/infohari/) is linked; its career history was not scraped or inferred. The contact email is `sreeharimailbox@gmail.com`, supplied directly by the owner. Review client list, availability, and project media before publishing.

## Run locally

Use Node.js 22.12+ (Node 24 recommended) and pnpm 11.25.0.

```sh
pnpm install
pnpm dev
```

Open `http://127.0.0.1:5173/` for the portfolio and `http://127.0.0.1:5173/#/admin` for the demo CMS. Without configured Supabase variables, localhost explicitly uses a local demo. Uploaded demo files and content are stored in this browser's IndexedDB. The public site reads a separate published snapshot, so saved drafts remain private to the demo workspace.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm preview
```

To regenerate the original vector sample artwork: `node tools/artwork.mjs`.

## Connect Supabase

### 1. Database and private storage

Create a Supabase project. Apply `supabase/migrations/202610280001_cms.sql` once using the SQL editor, or use the Supabase CLI:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The migration creates:

- Private draft documents and revisions, accessible to staff only.
- Separate published documents readable by visitors.
- Owner/editor memberships with no browser insert/update privileges.
- Private inquiry storage.
- A private media bucket. Browser storage uploads are denied; validated backend functions perform uploads.
- Atomic version checks for competing edits and atomic publication of a single document snapshot.
- Database-enforced owner-only settings and role administration.

### 2. Authentication

Enable GitHub as an OAuth provider in Supabase Auth. In your GitHub OAuth application, use the callback URL shown by Supabase: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.

Set Supabase's Site URL to `https://hhhari.github.io/Hari-Portfolio/`. Add that **exact URL including the trailing slash** to the redirect allowlist. Add `http://127.0.0.1:5173/` for local development if needed. This application processes PKCE `?code=` callbacks and invitation session fragments before initializing its hash router. OAuth secrets belong only in the provider/Supabase dashboards.

### 3. First owner

For initial setup, temporarily allow your own OAuth account to sign in. It initially has no CMS permissions. Open the admin and sign in with GitHub. Find your UUID in Supabase Authentication → Users, then run the following **in the trusted SQL editor**, substituting your actual UUID:

```sql
insert into public.members(user_id,email,role)
select id,email,'owner' from auth.users
where id = 'YOUR_AUTH_USER_UUID'::uuid
on conflict(user_id) do update set role='owner';
```

Disable new user signups afterward. Use owner-managed invitations for subsequent users. Membership is checked against the database, not a browser email field or local storage. Invitees claim an invitation only when the verified email on their authenticated account matches the stored invitation. Confirm your provider's email-linking settings during live testing.

The first owner cannot be demoted until another owner exists. Editors cannot edit site settings or grant roles.

### 4. Backend functions

Deploy all four functions. They validate staff bearer tokens themselves with `auth.getUser`; public contact/media resolution endpoints intentionally accept anonymous calls under their own rules.

```sh
supabase functions deploy resolve-media
supabase functions deploy manage-media
supabase functions deploy manage-members
supabase functions deploy submit-inquiry
```

Set function secrets through Supabase's dashboard or CLI:

- `ALLOWED_ORIGINS`: `https://hhhari.github.io,http://127.0.0.1:5173` (origins have no paths).
- `SITE_URL`: `https://hhhari.github.io/Hari-Portfolio/`.
- `RATE_LIMIT_SALT`: a randomly generated secret of at least 32 bytes.

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are supplied in the standard hosted function environment. Never put the service role key in frontend variables. The inquiry handler hashes the proxy-provided client address with the salt and enforces five requests per hour with an atomic database counter. Verify that your hosting proxy supplies a reliable client IP header. A honeypot and length/type validation provide additional spam checks; add CAPTCHA if the site attracts targeted abuse.

Configure an authenticated SMTP service in Supabase Auth before relying on collaborator invitation email. The app does not pretend that an invitation succeeded when the email API fails.

### 5. Frontend variables

Copy `.env.example` to `.env.local` and provide:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
VITE_BASE_PATH=/
VITE_ENABLE_DEMO=false
```

The URL and publishable key are public configuration. Database RLS, private storage, and backend authorization provide access control. No service role keys, OAuth secrets, or database passwords belong in `VITE_` variables.

Restart the development server after changing environment variables. With Supabase configured, the application never silently falls back to demonstration data after an error.

### 6. Add your content

The live database starts empty. Sign in, open Site settings, save your name, contact details, and theme, then Publish. Add projects and upload media through the CMS. An empty portfolio intentionally contains no sample client claims.

For a starting draft, export the local demo's content manifest and import it into the connected owner's workspace. Built-in `art:` references are portable; `media:` references require the matching media assets to be restored. Import always saves private drafts and never publishes automatically.

## Deploy to hhhari/Hari-Portfolio

Upload this project to your repository, excluding ignored files (`node_modules`, `dist`, environment files). This project has not been pushed automatically.

1. In repository Settings → Pages, choose **GitHub Actions** as the publishing source.
2. In Settings → Secrets and variables → Actions → **Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Set `VITE_BASE_PATH` to `/Hari-Portfolio/` (the workflow defaults to this value).
4. Push to `main` or `master`, or manually run the included workflow.

The workflow installs locked dependencies, lints, runs tests, builds, and deploys `dist`. GitHub Pages hosts only static files. Authentication, database operations, and uploads go directly to Supabase over HTTPS.

If backend configuration is absent, a hosted build shows a setup page. To share a clearly labeled **unsecured demonstration only**, explicitly set repository variable `VITE_ENABLE_DEMO=true`. Anyone opening that hosted demo can use their own browser-local CMS. Never use that mode as the production CMS.

Changes to published content appear without rebuilding the website. The public client refreshes on focus, visibility changes, and every 60 seconds. A same-browser publication broadcasts an immediate refresh. The backend currently issues media URLs valid for one hour; an already shared signed URL can remain usable for its remaining lifetime after unpublishing. The resolver will not issue new URLs for assets absent from published snapshots.

### Custom domain

Set repository variable `VITE_BASE_PATH=/`. Configure your custom domain in GitHub Pages and DNS, then update the Supabase Site URL, auth redirect allowlist, function `SITE_URL`, and `ALLOWED_ORIGINS`. Redeploy. Hash routes require no server rewrites and do not break when opened directly under a repository directory.

## Editing and publishing

- Draft edits autosave after a short pause. Use Publish to replace the public snapshot.
- A stale version cannot overwrite a newer save. Reload the editor and reconcile changes when a conflict is reported.
- Preview requires an authorized session. Draft content never goes through the anonymous public endpoint.
- Reordering two content items saves their new draft order. Publish both items to make that order live.
- Archive removes the public snapshot. Restore returns content as a draft.
- The revision tab restores previous content into a draft; review before publishing.
- Settings publication controls theme, identity, navigation, homepage sections, and maintenance mode. Maintenance mode is a presentation setting, not a confidentiality barrier for previously published content.
- Content is plain text and structured blocks. Arbitrary HTML is never injected. Video embeds use a strict YouTube/Vimeo host and ID allowlist.

## Media and performance

Images are resized to a maximum 2200px edge and converted to WebP when this saves space. 640px and 1200px WebP derivatives are also generated for responsive image loading. Uploaded originals are retained separately. AVIF originals are retained unchanged. Videos retain their uploaded encoding: export web-optimized H.264 MP4 with fast start or WebM **before upload**. Automatic video transcoding is not provided. Large-file resumable uploads require a future TUS/chunked pipeline; current uploads go directly to private object storage using scoped signed upload URLs, supporting progress, cancel, and retry with a 100 MB per-file limit, subject to your Supabase plan's limits. A backend finalization step validates the stored size, MIME type, and a bounded byte sample before creating a usable media record. Incomplete uploads remain private and are cleaned up opportunistically after expiration.

Only media IDs referenced by published snapshots are anonymously resolvable; staff can resolve private media after authorization. Signed URLs come from the private bucket. Used media cannot be deleted until removed from both drafts and published snapshots. Alt text, captions, folders, and metadata are editable. Caption files use WebVTT.

The public page uses native horizontal project scrolling, optimized self-hosted fonts, lazy gallery images, click-to-load third-party players, and a separate lazy admin bundle. Motion respects reduced-motion preferences. No autoplay audio, continuous canvas loop, or scroll hijacking is used. Demonstration artwork is lightweight SVG; real-world performance depends on the media you upload and the network/device.

## Backups and recovery

The CMS export is a **content manifest**, not a complete system backup. It includes documents, media metadata, inquiries, memberships for reference, and the most recent 100 revisions. It excludes media binaries, authentication users/sessions, provider secrets, and older revisions. Treat it as private because it includes inquiry details.

For complete recovery, maintain a Supabase database backup plus a separate copy of every object in `portfolio-private`, preserving object paths. Restore those first. Authentication users and provider settings require their own recovery plan. Do not import exported memberships to grant access automatically; provision authorized accounts through trusted setup.

Content import validates the manifest and saves documents as drafts. Review every imported document and reference before publishing. Imports run one document at a time and report the first error; a partial import is possible, so export a manifest before importing.

## Search and social preview limits

GitHub Pages hash routes are reliable for navigation and reloads but do not give every project an independently generated HTML document. The app updates document titles and descriptions for visitors; many social crawlers ignore those changes. Set the static metadata in `index.html` for the homepage. For reliable per-project indexing and previews later, add build-time prerendering and a controlled rebuild webhook, or migrate the same content model to an SSR/SSG host. Admin and draft routes set `noindex`.

## Verification

`pnpm test` runs content validation and local IndexedDB publishing tests, plus a PostgreSQL-compatible embedded database executing the actual migration. It checks anonymous denial, unauthorized-account denial, editor/owner boundaries, separate public snapshots, stale-write rejection, media visibility, last-owner preservation, unpublishing, and rate limiting.

These tests do not replace live Supabase integration checks. Before launch, verify OAuth redirect URLs, invitation email delivery, real uploads, signed video seeking, server-side file validation, cross-device publishing, inquiry rate limiting, and the authorization matrix on the actual project. See `VERIFICATION.md` for local checks and measured build details.
