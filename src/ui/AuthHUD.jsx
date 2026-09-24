import { useBloxity } from '../bloxity/BloxityContext'

/**
 * Compact account chip under the lobby indicator.
 *
 * Uses the `getUser() || getGuest()` pattern (surfaced as `identity` on the context)
 * so there is always a name and picture to show, even before the player logs in.
 * Logging in moves progress to the account's save slot (see useNetwork).
 */
export function AuthHUD() {
  const { identity, isLoggedIn, login, logout, status, error } = useBloxity()

  const name = identity?.displayName || identity?.username || 'Guest'
  const pfp = identity?.pfp

  return (
    <div className="auth-chip">
      {pfp ? (
        <img src={pfp} alt="" className="auth-pfp" />
      ) : (
        <div className="auth-pfp auth-pfp-letter">{name.charAt(0).toUpperCase()}</div>
      )}
      <div className="auth-name">
        <div>{name}</div>
        <small>{isLoggedIn ? 'Bloxity account' : 'Guest'}</small>
      </div>
      {isLoggedIn ? (
        <button type="button" onClick={logout} className="auth-btn">
          Log out
        </button>
      ) : (
        <button type="button" onClick={login} disabled={status !== 'ready'} className="auth-btn auth-btn-login">
          {status === 'ready' ? 'Log in' : '…'}
        </button>
      )}
      {status === 'error' && <div className="auth-error">Bloxity SDK failed to load. {error?.message}</div>}
    </div>
  )
}

export default AuthHUD
