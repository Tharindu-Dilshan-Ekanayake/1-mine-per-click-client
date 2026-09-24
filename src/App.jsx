import GameScene from './game/GameScene'
import useNetwork from './net/useNetwork'
import AuthHUD from './ui/AuthHUD'
import HUD from './ui/HUD'
import LoadingScreen from './ui/LoadingScreen'
import Modals from './ui/Modals'

function App() {
  // Joins an 8-player lobby as soon as the Bloxity identity is known.
  useNetwork()

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-sky-300">
      <GameScene />
      <HUD />
      <AuthHUD />
      <LoadingScreen />
      <Modals />
    </div>
  )
}

export default App
