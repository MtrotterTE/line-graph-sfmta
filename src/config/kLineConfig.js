const inboundLocationDefinitions = [
    { name: 'San Jose & Geneva Ave', isIntersection: false, stopIndex: 0 },
    { name: 'Ocean Ave & Balboa Park', isIntersection: true, intersectionIndex: 3 },
    { name: 'Howlth St & Ocean Ave', isIntersection: true, intersectionIndex: 1 },
    { name: 'Ocean Ave/CCSF Pedestrian Bridge', isIntersection: false, stopIndex: 1 },
    { name: 'Ocean Ave & Lee St', isIntersection: false, stopIndex: 2 },
    { name: 'Ocean Ave & Plymouth Ave', isIntersection: true, intersectionIndex: 4 },
    { name: 'Ocean Ave & Miramar Ave', isIntersection: false, stopIndex: 3 },
    { name: 'Ocean Ave & Dorado Ter', isIntersection: false, stopIndex: 4 },
    { name: 'Ocean Ave & Fairfield Way', isIntersection: false, stopIndex: 5 },
    { name: 'Ocean Ave & Cerritos Ave', isIntersection: true, intersectionIndex: 5 },
    { name: 'Ocean Ave & Aptos Ave', isIntersection: false, stopIndex: 6 },
    { name: 'Ocean Ave & San Leandro Way', isIntersection: false, stopIndex: 7 },
    { name: 'Junipero Serra Blvd & Ocean Ave', isIntersection: false, stopIndex: 8 },
    { name: 'Junipero Serra Blvd & Monterey Blvd', isIntersection: true, intersectionIndex: 0 },
    { name: 'West Portal Ave & Sloat Blvd', isIntersection: false, stopIndex: 9 },
    { name: 'West Portal Ave & 15th Ave', isIntersection: true, intersectionIndex: 6 },
    { name: 'West Portal Ave & 14th Ave', isIntersection: false, stopIndex: 10 },
    { name: 'West Portal Ave & Vicente St', isIntersection: true, intersectionIndex: 2 },
    { name: 'West Portal Station', isIntersection: false, stopIndex: 11 },
    { name: 'Forest Hill Station', isIntersection: false, stopIndex: 12 },
    { name: 'Castro Station', isIntersection: false, stopIndex: 13 },
    { name: 'Church Station', isIntersection: false, stopIndex: 14 },
    { name: 'Van Ness Station', isIntersection: false, stopIndex: 15 },
    { name: 'Civic Center Station', isIntersection: false, stopIndex: 16 },
    { name: 'Powell Station', isIntersection: false, stopIndex: 17 },
    { name: 'Montgomery Station', isIntersection: false, stopIndex: 18 },
    { name: 'Embarcadero Station', isIntersection: false, stopIndex: 19 },
]

const outboundLocationDefinitions = [
    { name: 'Balboa Park BART Mezzanine Level', isIntersection: false, stopIndex: 19 },
    { name: 'Ocean Ave & Balboa Park', isIntersection: true, intersectionIndex: 3 },
    { name: 'Howlth St & Ocean Ave', isIntersection: true, intersectionIndex: 1 },
    { name: 'Ocean Ave/CCSF Pedestrian Bridge', isIntersection: false, stopIndex: 18 },
    { name: 'Ocean Ave & Lee St', isIntersection: false, stopIndex: 17 },
    { name: 'Ocean Ave & Plymouth Ave', isIntersection: true, intersectionIndex: 4 },
    { name: 'Ocean Ave & Miramar Ave', isIntersection: false, stopIndex: 16 },
    { name: 'Ocean Ave & Jules Ave', isIntersection: false, stopIndex: 15 },
    { name: 'Ocean Ave & Victoria Street', isIntersection: false, stopIndex: 14 },
    { name: 'Ocean Ave & Cerritos Ave', isIntersection: true, intersectionIndex: 5 },
    { name: 'Ocean Ave & Aptos Ave', isIntersection: false, stopIndex: 13 },
    { name: 'Ocean Ave & San Leandro Way', isIntersection: false, stopIndex: 12 },
    { name: 'Junipero Serra Blvd & Ocean Ave', isIntersection: false, stopIndex: 11 },
    { name: 'Junipero Serra Blvd & Monterey Blvd', isIntersection: true, intersectionIndex: 0 },
    { name: 'West Portal Ave & Sloat Blvd', isIntersection: false, stopIndex: 10 },
    { name: 'West Portal Ave & 15th Ave', isIntersection: true, intersectionIndex: 6 },
    { name: 'West Portal Ave & 14th Ave', isIntersection: false, stopIndex: 9 },
    { name: 'West Portal Ave & Vicente St', isIntersection: true, intersectionIndex: 2 },
    { name: 'West Portal Station', isIntersection: false, stopIndex: 8 },
    { name: 'Forest Hill Station', isIntersection: false, stopIndex: 7 },
    { name: 'Castro Station', isIntersection: false, stopIndex: 6 },
    { name: 'Church Station', isIntersection: false, stopIndex: 5 },
    { name: 'Van Ness Station', isIntersection: false, stopIndex: 4 },
    { name: 'Civic Center Station', isIntersection: false, stopIndex: 3 },
    { name: 'Powell Station', isIntersection: false, stopIndex: 2 },
    { name: 'Montgomery Station', isIntersection: false, stopIndex: 1 },
    { name: 'Embarcadero Station', isIntersection: false, stopIndex: 0 },
]

export const DIRECTION_CONFIGS = {
    inbound: {
        key: 'inbound',
        label: 'Inbound',
        directionId: 1,
        stopsKey: 'inbound',
        locationDefinitions: inboundLocationDefinitions,
        startLocationIndex: 0,
        startStationName: 'San Jose & Geneva Ave',
        endStationName: 'Embarcadero Station',
        getStartCoordinates: (stopsEntry) => {
            const start = stopsEntry.inbound.stops[0].location
            return { lat: start.latitude, lon: start.longitude }
        },
        getPath: (polyline) =>
            polyline.shapeArray.map(point => ({
                lat: point.shape_pt_lat,
                lon: point.shape_pt_lon,
                shape_dist_traveled: point.shape_dist_traveled,
            })),
    },
    outbound: {
        key: 'outbound',
        label: 'Outbound',
        directionId: 0,
        stopsKey: 'outbound',
        locationDefinitions: outboundLocationDefinitions,
        startLocationIndex: outboundLocationDefinitions.length - 1,
        startStationName: 'Embarcadero Station',
        endStationName: 'Balboa Park BART Mezzanine Level',
        getStartCoordinates: (stopsEntry) => {
            const startPoint = stopsEntry.polyline.shapeArrayOutbound[0]
            return { lat: startPoint.shape_pt_lat, lon: startPoint.shape_pt_lon }
        },
        getPath: (polyline) =>
            polyline.shapeArrayOutbound.map(point => ({
                lat: point.shape_pt_lat,
                lon: point.shape_pt_lon,
                shape_dist_traveled: point.shape_dist_traveled,
            })),
    },
}

export const METRIC_CONFIGS = {
    time: {
        key: 'time',
        label: 'Distance vs Time',
        xLabel: 'Time (seconds)',
        accessValue: (point) => point?.cumulativeTime ?? 0,
        formatTick: (value) => {
            const minutes = Math.floor(value / 60)
            const seconds = Math.floor(value % 60)
            return `${minutes}m ${seconds}s`
        },
    },
    speed: {
        key: 'speed',
        label: 'Distance vs Speed',
        xLabel: 'Speed (m/s)',
        accessValue: (point) => point?.speed ?? 0,
        formatTick: (value) => `${value} m/s`,
    },
}

export const DATA_FILES = [
    'data/gfts_realtime_data_2025-05-11_8-00_PST.json',
    'data/gfts_realtime_data_2025-05-12_8-00_PST.json',
    'data/gfts_realtime_data_2025-05-13_8-00_PST.json',
    'data/gfts_realtime_data_2025-05-14_8-00_PST.json',
    'data/gfts_realtime_data_2025-05-15_8-00_PST.json',
    'data/gfts_realtime_data_2025-05-16_8-00_PST.json',
]
