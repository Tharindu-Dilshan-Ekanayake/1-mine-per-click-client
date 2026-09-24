import { useEffect, useState } from 'react'

import { useBloxity } from '../bloxity/BloxityContext'
import { connect, disconnect } from './network'

/** Don't hold the player at "connecting" forever if the Bloxity SDK is slow. */
const SDK_WAIT_MS = 4000

function localId() {
  try {
    let id = localStorage.getItem('mine.uid')
    if (!id) {
      id = `l_${Math.random().toString(36).slice(2, 12)}`
      localStorage.setItem('mine.uid', id)
    }
    return id
  } catch {
    return `l_${Math.random().toString(36).slice(2, 12)}`
  }
}

/** Stable save-slot id: Bloxity user, then Bloxity guest, then this browser. */
function identityKey(user, guest) {
  const pick = (o) => o && (o.id ?? o.userId ?? o.guestId ?? o.username)
  if (pick(user)) return `u_${pick(user)}`
  if (pick(guest)) return `g_${pick(guest)}`
  return localId()
}

/**
 * Joins a lobby once the Bloxity identity is known, and re-joins when it changes
 * (logging in switches the save slot from guest to account).
 */
export function useNetwork() {
  const { status, user, guest, identity, avatar } = useBloxity()
  const [waitedOut, setWaitedOut] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setWaitedOut(true), SDK_WAIT_MS)
    return () => clearTimeout(t)
  }, [])

  const sdkSettled = status === 'ready' || status === 'error' || waitedOut
  const uid = identityKey(user, guest)
  const name = identity?.displayName || identity?.username || 'Guest'
  // Only the identity decides the lobby; cosmetics changes don't force a rejoin.
  const avatarJson = avatar ? JSON.stringify(avatar) : ''

  useEffect(() => {
    if (!sdkSettled) return
    connect({ uid, name, avatar: avatarJson })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkSettled, uid])

  useEffect(() => () => disconnect(), [])
}

export default useNetwork
