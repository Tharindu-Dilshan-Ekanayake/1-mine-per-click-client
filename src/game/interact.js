import { getGame } from '../net/gameStore'
import { getRoom, pendingPickups, send } from '../net/network'
import { roomFloorY } from '../shared/gameConfig'

/** Runs whatever the current prompt offers (E key or the on-screen button). */
export function interact() {
  const { prompt, setModal } = getGame()
  if (!prompt) return
  if (prompt.kind === 'item') {
    // Remember where it lay: the server deletes it, but we want it to fly to the bag.
    const it = getRoom()?.state?.items?.get(prompt.id)
    if (it) pendingPickups.set(prompt.id, { x: it.x, y: roomFloorY(it.stage) + 0.4, z: it.z })
    send('pickup', { id: prompt.id })
  } else if (prompt.kind === 'pad') send('unlockPad', { id: prompt.id })
  else if (prompt.id === 'sell') send('sell')
  else setModal(prompt.id)
}
