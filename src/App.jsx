import { useState } from 'react'
import NavigationRail from './components/NavigationRail.jsx'
import KLineOutboundTime from './components/KLineOutboundTime.jsx'
import KLineInboundTime from './components/KLineInboundTime.jsx'
import KLineOutboundSpeed from './components/KLineOutboundSpeed.jsx'
import KLineInboundSpeed from './components/KLineInboundSpeed.jsx'

const views = {
    outboundTime: KLineOutboundTime,
    inboundTime: KLineInboundTime,
    outboundSpeed: KLineOutboundSpeed,
    inboundSpeed: KLineInboundSpeed,
}

function App() {
    const [activeView, setActiveView] = useState('inboundTime')
    const ActiveComponent = views[activeView] ?? KLineInboundTime

    return (
        <div className="app-layout">
            <NavigationRail activeView={activeView} onSelectView={setActiveView} />
            <main className="content">
                <ActiveComponent />
            </main>
        </div>
    )
}

export default App
