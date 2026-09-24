/**
 * Camera orbit angles, shared by the camera (which draws from them), the mouse
 * (which aims them) and the player (whose A/D keys turn them).
 * yaw 0 puts the camera behind the player on +Z, looking toward -Z.
 *
 * The mouse cursor is never hidden or captured - clicking the game swings the
 * pickaxe, nothing more. The camera turns only via A/D or a right-click/touch
 * drag (see FollowCamera.jsx and Player.jsx).
 */
export const view = { yaw: 0, pitch: 0.32, distance: 8 }
