This is **Vilarci Teacher**, the Expo/React Native educator app of the Vilarci Study ecosystem. It is the mobile port of the Vilarci Study Partner portal (`vilarci-study-partner-website`) and shares its architecture and "Porcelain & Wine" design system with the student app (`vilarci-study-st-app`). Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. Before writing code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json` (currently SDK 57).
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt and follow its links; never answer from memory.

## Commands

```bash
npx expo install <package>  # ALWAYS use instead of npm add — resolves SDK-compatible versions
npx expo start              # dev server (do not set CI=1 locally: it disables file watching)
npx tsc --noEmit            # typecheck (npm run check)
npx expo-doctor             # diagnose dependency and config issues
```

Run the typecheck before declaring any task done.

## Architecture

- **Navigation** uses React Navigation (bottom tabs + native stacks) in `src/navigation/RootNavigator.tsx`, matching the student app. Tabs: Today · Batches · Institutes · More. `Deck` (the unified batch command deck) is registered in every tab's stack so Back returns to where it was opened.
- **Data**: `src/lib/data` holds the typed seed mirroring the portal's `TEACHER_PORTAL_DATA`. Keep field names identical to the portal/DB schema.
- **State**: `src/lib/store/useAppStore.ts` (zustand + AsyncStorage) keeps an editable copy of the seed plus every teacher action. Actions are copy-on-write.
- **Queries**: screens read only through `src/lib/api/hooks.ts`, which wraps pure selectors in `src/lib/api/selectors.ts`. A Supabase swap should only touch `src/lib/api` and the store.
- Derived values (attendance rates, syllabus variance, fee overdue state, test ranks) are computed in selectors, never stored.
- **UI kit**: `src/components/ui` (shared with the student app). Use `ConfirmSheet` for destructive actions — `Alert.alert` has no buttons on web.

## Rules

- `ios/` and `android/` are generated (Continuous Native Generation). Never edit them by hand — configure via `app.json` and config plugins.
- Expo Go only includes bundled native modules; adding native code requires a development build.
- Vilarci keeps an academic fee ledger only: never add receipt generation.
