import type { TranslationKey } from './ar';

export const en: Record<TranslationKey, string> = {
  'app.name': 'Yalla Mithilha',
  'app.tagline': 'You do not need to know the answer. You need your friends to understand you.',

  'common.next': 'Next',
  'common.back': 'Back',
  'common.continue': 'Continue',
  'common.cancel': 'Cancel',
  'common.yes': 'Yes',
  'lang.title': 'Choose your language',
  'lang.english': 'English',
  'lang.restartNotice': 'Close and reopen the app so the layout direction updates.',

  'home.settings': 'Settings',
  'home.about': 'About and privacy',

  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.reset': 'Delete all saved data',
  'settings.resetConfirm': 'This removes names, settings and any saved game. Continue?',
  'settings.resetDone': 'Everything was deleted',
  'privacy.title': 'Privacy',
  'privacy.body': 'Team names and your settings are stored on your phone only. No camera, microphone or contacts permission is ever requested.',
  'privacy.network':
    'Charades needs an account and an internet connection to play — there is no offline fallback, since it involves a real wallet. Signing up or signing in sends a username and password to the server, and your wallet balance is held there, never on your device.',
  'privacy.reset': 'Delete my data',

  'resume.continue': 'Resume',
  'resume.discard': 'Start fresh',

  'charades.home.guestNotice': 'Sign in to keep your wallet and find it again later',
  'charades.home.startNew': 'Start a new game',

  'charades.draft.title': 'Set up your game',
  'charades.draft.subtitle': 'Two teams, one deck, twenty rounds between them',
  'charades.draft.teamAName': 'Team A name',
  'charades.draft.teamBName': 'Team B name',
  'charades.draft.deckLabel': 'Pick a deck',
  'charades.draft.deckCount': '{{count}} titles',
  'charades.draft.noDecks': 'Could not load decks. Check your connection and try again.',
  'charades.draft.confirm': 'Continue to checkout',
  'charades.draft.back': 'Back to team names',

  'charades.checkout.title': 'Start the game',
  'charades.checkout.subtitle': 'One payment plays twenty rounds from the deck you picked',
  'charades.checkout.walletBalance': '{{count}} games in your wallet',
  'charades.checkout.price': 'One game — {{price}}',
  'charades.checkout.devNotice':
    'Placeholder checkout. Real payment (KNET) is not wired up yet — these buttons simulate a purchase against a real, account-owned wallet on the server.',
  'charades.checkout.start': 'Start the game',
  'charades.checkout.signInTitle': 'Sign in to top up your wallet',
  'charades.checkout.signInBody':
    'Your wallet belongs to your account, not this device, so you can find it again later. Guest play and setting up a game never need this.',
  'charades.checkout.signInButton': 'Sign in or create an account',
  'charades.checkout.simulateFailure': 'Simulate a failed payment (dev)',
  'charades.play.round': 'Round {{round}} of {{total}}',
  'charades.play.turn': '{{team}}’s turn',
  'charades.play.scanInstruction': 'Have {{team}}’s actor scan this with their phone’s camera to see the title — it never shows here',
  'charades.play.scanUnavailable':
    'Can’t generate a QR code on this device. Set EXPO_PUBLIC_REVEAL_BASE_URL for this to work on a non-browser screen.',
  'charades.play.award': 'Award {{team}}',
  'charades.play.skip': 'No one guessed it',
  'charades.play.complete': 'Game complete',
  'charades.play.winner': '{{team}} wins!',
  'charades.play.tie': 'It’s a tie',
  'charades.play.quit': 'End game',
  'charades.play.quitConfirm': 'End this game? Progress will be lost.',
  'charades.play.home': 'Home',

  'charades.reveal.warning': 'Show this to yourself only — don’t let your team see the screen',
  'charades.reveal.missing': 'Nothing to reveal here. Scan the code on the game screen to see the title.',

  'charades.resume.title': 'You have a game in progress',
  'charades.resume.body': 'Pick up where you stopped?',

  'account.title': 'Account',
  'account.subtitle': 'Optional. Guest play works fully without one — this only saves a username so you can come back to it.',
  'account.username': 'Username',
  'account.password': 'Password',
  'account.signIn': 'Sign in',
  'account.createAccount': 'Create account',
  'account.switchToSignIn': 'Already have an account? Sign in',
  'account.switchToCreate': "Don't have an account? Create one",
  'account.loggedInAs': 'Signed in as {{username}}',
  'account.logout': 'Sign out',
  'account.logoutConfirm': 'Sign out of this account? Guest play keeps working as usual.',

  'landing.eyebrow': 'New here?',
  'landing.intro':
    'Yalla Mithilha is Charades — silent acting built on real titles: Kuwaiti, Khaleeji and Egyptian movies, series and plays. Runs fully in Arabic and English.',
  'landing.charadesTitle': 'Charades',
  'landing.charadesBody':
    'Two teams pick a deck of real titles — Kuwaiti and Egyptian plays, Egyptian series, Khaleeji series — and take turns acting one out at a time, twenty rounds, no words allowed. Top up your wallet once to play a game.',
  'landing.charadesCta': 'Play charades',
  'landing.bilingualTitle': 'Arabic and English',
  'landing.bilingualBody': 'Every screen, in both languages — switch anytime in Settings.',
  'landing.privacyTitle': 'Privacy',
  'landing.privacyBody': 'Read exactly what Charades sends, and when — it needs an account and a wallet to play.',
  'landing.privacyLink': 'Read the privacy page',
  'landing.fullMenu': 'See the full menu',
};
