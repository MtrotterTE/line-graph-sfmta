import KLineChart from './KLineChart.jsx'

function KLineOutboundTime() {
    return (
        <KLineChart
            directionKey="outbound"
            metricKey="time"
            title="Tenco CityScale K Line Intersection Delays For Outbound K Line (Distance vs Time)"
        />
    )
}

export default KLineOutboundTime
