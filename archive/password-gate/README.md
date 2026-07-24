# Archived: landing-page access-code gate

Removed from `src/app/page.tsx` for the public / portfolio launch. Preserved here
so it can be restored later. **Git history also retains the exact pre-removal
`page.tsx`** (see the commit that references this archive).

## What it was

A client-side "coming soon" wall on the home page (`/`). On load it showed a
single password input; on the correct code it ran the boot-sequence animation and
revealed the interface.

**It was never real security.** The code was compared in the browser against
`NEXT_PUBLIC_ACCESS_CODE` (default `iceland`) — a `NEXT_PUBLIC_*` value is inlined
into the client bundle and readable by anyone. It only deterred casual visitors.

## How it was wired (inside `HomePage` in `src/app/page.tsx`)

```tsx
const [passwordEntered, setPasswordEntered] = useState(false);
const [password, setPassword] = useState('');
const [passwordError, setPasswordError] = useState(false);

const handlePasswordSubmit = (e: React.FormEvent): void => {
  e.preventDefault();
  const accessCode = process.env['NEXT_PUBLIC_ACCESS_CODE'] || 'iceland';
  if (password === accessCode) {
    setPasswordEntered(true);
    setPasswordError(false);
    setTimeout(() => setBootComplete(true), 8000); // start boot after unlock
  } else {
    setPasswordError(true);
    setPassword('');
  }
};

// …in the returned JSX, before the boot sequence:
{!passwordEntered && (
  <PasswordEntry
    password={password}
    setPassword={setPassword}
    onSubmit={handlePasswordSubmit}
    error={passwordError}
  />
)}
{passwordEntered && !bootComplete && <BootSequence />}
```

The `PasswordEntry` component itself is in `./PasswordEntry.tsx`.

## Restore

1. Copy `PasswordEntry.tsx` back into `src/app/page.tsx` (or import it).
2. Re-add the three `useState` hooks and `handlePasswordSubmit` above.
3. Restore the two JSX branches shown above, and change the current
   `{!bootComplete && <BootSequence />}` back to `{passwordEntered && !bootComplete && …}`.
4. Remove the "run boot sequence on load" `useEffect` added when the gate was removed.
5. Optionally set `NEXT_PUBLIC_ACCESS_CODE` in the environment to override `iceland`.

## Note for a real gate

If you ever need an actual access wall (private beta, etc.), do it server-side —
Next.js middleware or a route handler checking a **server-only** secret / signed
cookie — never a `NEXT_PUBLIC_*` comparison in the client.
