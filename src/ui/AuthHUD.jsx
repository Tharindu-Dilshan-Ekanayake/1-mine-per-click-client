import { useBloxity } from '../bloxity/BloxityContext'

/**
 * Compact account chip under the lobby indicator.
 *
 * Uses the `getUser() || getGuest()` pattern (surfaced as `identity` on the context)
 * so there is always a name and picture to show, even before the player logs in.
 * Logging in moves progress to the account's save slot (see useNetwork).
 *
 * No logout here: once a player is on their account, the game keeps them on it
 * rather than offering a way to slip back to a guest slot mid-session. Signed
 * out, the name itself is the login button - no separate "Log in" control.
 */
export function AuthHUD() {
  const { identity, isLoggedIn, login, status, error } = useBloxity()

  const name = identity?.displayName || identity?.username || 'Guest'
  const pfp = identity?.pfp
  const canLogin = !isLoggedIn && status === 'ready'

  const avatar = pfp ? (
    <img src={pfp} alt="" className="auth-pfp" />
  ) : (
    <div className="auth-pfp auth-pfp-letter">{name.charAt(0).toUpperCase()}</div>
  )

  return (
    <div className="auth-chip">
      {canLogin ? (
        <button type="button" onClick={login} className="auth-chip-login">
          {avatar}
          <div className="auth-name">
            <div>{name}</div>
            <small>Tap to log in</small>
          </div>
        </button>
      ) : (
        <>
          {avatar}
          <div className="auth-name">
            <div>{name}</div>
            <small>{isLoggedIn ? 'Bloxity account' : 'Guest'}</small>
          </div>
        </>
      )}
      {status === 'error' && <div className="auth-error">Bloxity SDK failed to load. {error?.message}</div>}
    </div>
  )
}

export default AuthHUD
