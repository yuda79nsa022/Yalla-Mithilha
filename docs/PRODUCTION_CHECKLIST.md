# Production readiness checklist

What stands between this MVP and a store submission, roughly in the order it
should be done.

## Before a real playtest

- [ ] Run a session with six people in a real diwaniya and watch where they look.
      If anyone is reading the phone instead of the performer, the card is too
      long.
- [ ] Time three sessions per length setting and compare against the 10 / 20 /
      30 minute targets. `LENGTH_TARGET_MINUTES` and `ROUND_OVERHEAD_SECONDS` in
      `src/engine/config.ts` are the two dials.
- [ ] Have a Kuwaiti reader go through all 146 Arabic cards out loud and flag
      anything that reads as written rather than spoken.
- [ ] Verify the Arabic layout on a physical device after a relaunch, not in a
      simulator only.

## Assets

- [ ] Five sound effects, original or licensed (`assets/sounds/README.md`).
- [x] App icon, adaptive icon, and splash image — a simplified mark (smiling
      mask + a pink "OK"-hand ring, echoing the studio logo) in `assets/images/`,
      wired through `app.json`. Own vector artwork, not the literal logo file.
- [ ] A licensed Arabic display face, plus a Latin companion.
- [ ] Store screenshots in both languages.

## Engineering

- [ ] Component tests with `@testing-library/react-native` for the round screen,
      the pass screen and the setup flow.
- [ ] An error boundary around the game stack so a crash mid-round returns to
      the home screen with the saved session intact.
- [ ] Tilt calibration on a range of devices; the thresholds in
      `src/platform/useTilt.ts` were set from the sensor's rotation values and
      have not been tuned on hardware.
- [ ] Confirm behaviour when the app is backgrounded mid-round — the clock
      should pause, not keep running.
- [ ] A migration path for `STATE_VERSION` so a saved game survives an update
      instead of being discarded.
- [ ] Export or share option for locally stored prompt reports.
- [ ] Accessibility pass with VoiceOver and TalkBack in both languages,
      including the round screen under time pressure.
- [ ] Contrast audit against WCAG AA for every mini-game colour on its
      background.

## Content

- [ ] Grow each room to at least 25 cards per mini-game so a second session in
      one evening never recycles.
- [ ] Decide whether the adults level ships in v1; today it only unlocks a
      handful of cards and may not justify its own option.
- [ ] A written moderation policy for user-submitted content, before that
      feature is built rather than after.

## Legal and store

- [ ] Privacy policy page, even though nothing is collected — both stores
      require a URL.
- [ ] Age rating questionnaires for both stores.
- [ ] Confirm the final name is clear of existing marks in Kuwait and the GCC.
- [ ] Data safety form (Android) and privacy nutrition label (iOS): both are
      "no data collected" today; keep them accurate if analytics is ever wired.

## When analytics or purchases are added

- [ ] A consent screen before any event leaves the device.
- [ ] Re-check `src/services/analytics.ts` types still make it impossible to log
      a player name or prompt text.
- [ ] Restore-purchases flow, required by both stores.
