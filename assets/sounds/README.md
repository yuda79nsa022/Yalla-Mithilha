# Sound assets

The MVP ships silent. Five original or licensed clips replace this file:

| File | When it plays | Notes |
| --- | --- | --- |
| `countdown.m4a` | last three seconds of a round | short tick, no melody |
| `correct.m4a` | a card is answered | under 300 ms, must not mask speech |
| `skip.m4a` | a card is skipped | lower pitch than `correct` |
| `round-end.m4a` | the clock hits zero | clear stop, no fade |
| `celebrate.m4a` | the winner screen | under two seconds |

Wire them up in `src/platform/audio.ts` by filling in `SOUND_FILES` and adding
`expo-av` playback. Nothing else in the app needs to change.

Licensing: original recordings, or a licence that permits commercial
redistribution inside an app. Do not use clips pulled from other games.
