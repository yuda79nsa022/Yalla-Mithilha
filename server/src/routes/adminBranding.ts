import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { BRANDING_DIR, getBranding, recordAudit, updateBranding } from '../db';
import { handleError } from '../errors';
import { ValidationError, parseUpdateBrandingBody } from '../validate';

export const adminBrandingRouter = Router();

// No SVG: a logo is served from this same origin, and an SVG opened on its
// own can run script. A raster image can't.
const ALLOWED_LOGO_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const uploadLogo = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_LOGO_BYTES } });

/** Best-effort, like a title picture's — the settings row is what matters. */
function deleteLogoFile(logoPath: string | null): void {
  if (!logoPath) return;
  try {
    fs.unlinkSync(path.join(BRANDING_DIR, path.basename(logoPath)));
  } catch {
    // already gone
  }
}

adminBrandingRouter.get('/settings/branding', (_req, res) => {
  res.json(getBranding());
});

/** App name (either language) and timezone — any subset; fields left out are unchanged. */
adminBrandingRouter.put('/settings/branding', (req, res) => {
  try {
    const input = parseUpdateBrandingBody(req.body);
    const before = getBranding();
    const after = updateBranding(input);
    recordAudit({
      actorId: req.admin!.sub,
      actorUsername: req.admin!.username,
      action: 'settings.branding.update',
      target: 'branding',
      before: { appNameAr: before.appNameAr, appNameEn: before.appNameEn, timezone: before.timezone },
      after: { appNameAr: after.appNameAr, appNameEn: after.appNameEn, timezone: after.timezone },
    });
    res.json(after);
  } catch (err) {
    handleError(err, res);
  }
});

/** Multipart: a `logo` file replaces the logo; `removeLogo: 'true'` goes back to the built-in one. */
adminBrandingRouter.put('/settings/branding/logo', uploadLogo.single('logo'), (req, res) => {
  try {
    const before = getBranding();
    let logoPath: string | null;
    if (req.file) {
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (!ALLOWED_LOGO_EXTENSIONS.has(ext)) {
        throw new ValidationError(`unsupported logo type "${ext || '(none)'}" — expected .png, .jpg or .webp`);
      }
      const filename = `logo-${crypto.randomUUID()}${ext}`;
      fs.writeFileSync(path.join(BRANDING_DIR, filename), req.file.buffer);
      logoPath = `/branding/${filename}`;
    } else if ((req.body as Record<string, unknown> | undefined)?.removeLogo === 'true') {
      logoPath = null;
    } else {
      throw new ValidationError('send a "logo" file, or removeLogo=true');
    }
    const after = updateBranding({ logoPath });
    if (before.logoPath !== after.logoPath) deleteLogoFile(before.logoPath);
    recordAudit({
      actorId: req.admin!.sub,
      actorUsername: req.admin!.username,
      action: 'settings.branding.logo',
      target: 'branding',
      before: { logoPath: before.logoPath },
      after: { logoPath: after.logoPath },
    });
    res.json(after);
  } catch (err) {
    handleError(err, res);
  }
});
