# LaundroStat presentation

This directory contains the implemented 14-slide presentation based on `docs/laundrostat-canva-update-brief.md`.

## Deliverables

- `LaundroStat-Updated-Deck.pptx` — editable PowerPoint deck
- `LaundroStat-Updated-Deck.pdf` — rendered viewing copy
- `assets/` — current live product screenshots, team image, and generated demo QR code

The online Canva design is separate and is not modified by these files.

## Verification note

Both QR codes decode from the rendered PDF to `https://laundrostat.vercel.app/demo`. A physical-phone scan under the actual projector/room conditions should still be performed before presenting.

## Rebuild

From the repository root:

```bash
python -m venv /tmp/laundrostat-presentation-venv
/tmp/laundrostat-presentation-venv/bin/pip install -r presentation/requirements.txt
node scripts/capture-presentation-assets.mjs
/tmp/laundrostat-presentation-venv/bin/python scripts/build-presentation.py
soffice --headless --convert-to pdf --outdir presentation presentation/LaundroStat-Updated-Deck.pptx
```

The screenshot capture requires the repository's Playwright dependency and network access to `https://laundrostat.vercel.app`. The PowerPoint generator itself is deterministic and performs no network calls.
