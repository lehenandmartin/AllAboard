import { BoardList } from './components/BoardList/BoardList'
import { Canvas } from './components/Canvas/Canvas'
import { DndRoot } from './components/Dnd/DndRoot'
import { DropOverlay } from './components/Import/DropOverlay'
import { ContextMenuHost } from './components/Menu/ContextMenuHost'
import { Notice } from './components/Notice/Notice'
import { SettingsPanel } from './components/SettingsPanel/SettingsPanel'
import { Toolbar } from './components/Toolbar/Toolbar'

export default function App() {
  return (
    <div className="app">
      <Toolbar />
      <DndRoot>
        <main className="app__main">
          <BoardList />
          <Canvas />
          <SettingsPanel />
        </main>
      </DndRoot>
      <DropOverlay />
      <ContextMenuHost />
      <Notice />
    </div>
  )
}
