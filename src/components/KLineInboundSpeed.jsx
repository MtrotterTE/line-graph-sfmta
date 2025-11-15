import KLineChart from './KLineChart.jsx'

function KLineInboundSpeed() {
    return (
        <KLineChart
            directionKey="inbound"
            metricKey="speed"
            title="Tenco CityScale K Line Intersection Delays For Inbound K Line (Distance vs Speed)"
        />
    )
}

export default KLineInboundSpeed
