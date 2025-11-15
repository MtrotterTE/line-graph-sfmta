import KLineChart from './KLineChart.jsx'

function KLineInboundTime() {
    return (
        <KLineChart
            directionKey="inbound"
            metricKey="time"
            title="Tenco CityScale K Line Intersection Delays For Inbound K Line (Distance vs Time)"
        />
    )
}

export default KLineInboundTime
