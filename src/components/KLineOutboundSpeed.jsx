import KLineChart from './KLineChart.jsx'

function KLineOutboundSpeed() {
    return (
        <KLineChart
            directionKey="outbound"
            metricKey="speed"
            title="Tenco CityScale K Line Intersection Delays For Outbound K Line (Distance vs Speed)"
        />
    )
}

export default KLineOutboundSpeed
