# RJ Welding & Wheels — website

Static, bilingual (French-first, English at `/en/`) site. It has no framework and no runtime dependencies.

## Structure
- `research.md`: verified facts, photo sources, and the **owner-confirmation checklist (§6)**. Read it before launch.
- `src/content.mjs`: every business fact and all FR/EN copy. Edit this file to change the address, hours, rating, services or projects.
- `build.mjs`: renders every page into `dist/`.
- `public/`: CSS, JS, icons, and processed images (copied into `dist/`).
- `scripts/images.py`: rebuilds the AVIF/WebP/JPEG variants from `research/instagram/full/`.

## Commands
```bash
node build.mjs            # build → dist/
node scripts/serve.mjs    # preview at http://localhost:4321
python3 scripts/images.py # regenerate images (needs Pillow)
```

## Brand and logo
- Colours come from the client logo (`research/logo-client.jpg`): red `#FB0102`, grey `#E1E1E1`, black. Tokens are in `public/assets/css/main.css`. Buttons use `#D90000` so white text passes contrast.
- `src/logo.mjs` rebuilds the logo as SVG. It's used in the header, the opening splash (home page, once per session) and the footer.
- Add `#intro` to the home URL to replay the opening, or `#introhold` to freeze it for review. The animation is skipped for visitors who have reduced motion turned on.
- Fonts are self-hosted in `public/assets/fonts/`.

## Hero film ("Cabine")
- Made with Higgsfield on 2026-09-29. The look frame is GPT Image 2.5 (`art/hero/frame-a.png`); it was animated with Seedance 2.5, 10 s at 1080p (`art/hero/takeA-spray.mp4`). The gun fires a jet of red powder through the wheel, which turns on its hook. The first and last frames are the same image, so it loops seamlessly.
- Unused takes are in `art/hero/`: `take1-loop.mp4` (too still), `take2-pushin.mp4` (camera push-in) and `takeB-sweep.mp4` (sweeping gun).
- It's AI-generated brand atmosphere, not a customer job, so it isn't captioned or listed as a project.
- Phones get their own vertical take (`art/hero/takeA-phone-loop.mp4`, from the vertical still `art/hero/frame-phone-a.png`), framed with the wheel in the top half so the headline sits below it. `scripts/make-loop.py` crossfaded its end into its start to make the loop seamless.
- Web files in `public/assets/video/`: H.264 in landscape (1920×1080, about 2.9 MB) and vertical for phones (540×960, about 0.5 MB). The posters are the first frame. Rebuild them with `sh scripts/encode-hero.sh`.
- The page uses native autoplay (muted, looping, inline), and the browser picks the portrait file on tall screens. The script adds a pause/play button, pauses when the hero is off-screen, starts paused for reduced motion and data-saver, and retries on the first interaction if autoplay is blocked.
- Note: Chrome won't load video in a tab that has never been on screen, so check it in a visible tab.

## Deploy
`vercel.json` is included (build: `node build.mjs`, output: `dist`). Any static host works; just serve `dist/`. Then point `rjweldingandwheels.com` at it and update the website link on the Google Business Profile.

## Before launch
1. Settle the address conflict (2930 vs 2640 Diab). Update `business.address` in `src/content.mjs` and fix the Google listing if needed.
2. Confirm the hours.
3. Confirm the WhatsApp number (`business.whatsapp`, currently the shop line 514-466-9693) and send yourself a test request.
   How the quote form works: the visitor fills it in and adds up to 6 photos, which are resized in their browser. Submitting opens WhatsApp to that number with the request already written. A WhatsApp link can only carry text, so a second step sends the photos into the same chat: the phone share sheet on mobile, or drag-and-drop on desktop. Nothing is stored on a server.
   Fully automatic delivery (photos arriving without the visitor pressing Send) would need the WhatsApp Business Cloud API plus a small server.
4. Optional: if `business.whatsapp` is set to `null`, the form falls back to `business.formEndpoint` (e.g. Formspree), then `business.email`, then a copy-the-message panel.
5. Get the owner's OK to use the Instagram photos, and higher-resolution originals if possible.
6. Replace the interim wordmark with the official logo files.
