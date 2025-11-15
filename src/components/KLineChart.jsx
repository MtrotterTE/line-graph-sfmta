import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import {
    calculateTimeElapsed,
    safeToArray,
    findNearestIndex,
    isWithinDistance,
    getDistanceInFeet,
} from '../utils/helpers.js'
import { DATA_FILES, DIRECTION_CONFIGS, METRIC_CONFIGS } from '../config/kLineConfig.js'

const VEHICLE_AT_STOP_RADIUS_FEET = 250
const GRAPH_WIDTH = 1100
const GRAPH_HEIGHT = 760
const GRAPH_MARGIN = { top: 20, right: 140, bottom: 50, left: 200 }
const WEST_PORTAL_COORDS = { lat: 37.741171, lon: -122.465609 }
const ZOOM_FACTOR = 2.5
const LENS_SIZE = 220
const CURSOR_OFFSET = 24

const DATA_ROOT = import.meta.env.BASE_URL ?? '/'

const fetchJson = async (path) => {
    const response = await fetch(`${DATA_ROOT}${path}`)
    if (!response.ok) {
        throw new Error(`Failed to load ${path}`)
    }
    return response.json()
}

function KLineChart({ directionKey, metricKey, title }) {
    const directionConfig = DIRECTION_CONFIGS[directionKey]
    const metricConfig = METRIC_CONFIGS[metricKey]

    if (!directionConfig || !metricConfig) {
        console.error('Missing graph configuration', { directionKey, metricKey })
        return null
    }

    const graphContainerRef = useRef(null)
    const graphSvgRef = useRef(null)

    const [graphData, setGraphData] = useState([])
    const [currentTripIndex, setCurrentTripIndex] = useState(-1)
    const [isLoading, setIsLoading] = useState(true)
    const [availableDates, setAvailableDates] = useState([])
    const [selectedDate, setSelectedDate] = useState(null)
    const [allDatesMode, setAllDatesMode] = useState(false)
    const [locationBlueprint, setLocationBlueprint] = useState([])
    const [locationStats, setLocationStats] = useState([])
    const [stationDistances, setStationDistances] = useState([])
    const [intersectionDistances, setIntersectionDistances] = useState([])
    const [westPortalDistance, setWestPortalDistance] = useState(null)
    const [totalNumberOfFullTrips, setTotalNumberOfFullTrips] = useState(0)
    const [totalDurationOfFullTrips, setTotalDurationOfFullTrips] = useState(0)
    const [isZoomEnabled, setIsZoomEnabled] = useState(false)
    const [isZoomLensVisible, setIsZoomLensVisible] = useState(false)
    const [zoomLensPosition, setZoomLensPosition] = useState({ left: 0, top: 0 })
    const [zoomBackgroundSize, setZoomBackgroundSize] = useState('0px 0px')
    const [zoomBackgroundPosition, setZoomBackgroundPosition] = useState('0px 0px')
    const [zoomImageUrl, setZoomImageUrl] = useState('')

    const startLocation = locationBlueprint[directionConfig.startLocationIndex]

    const filteredTrips = useMemo(() => {
        if (!graphData.length || !startLocation) return []
        const startLat = startLocation.location.latitude
        const startLon = startLocation.location.longitude

        return graphData.filter((trip) => {
            if (!trip?.length) return false
            if (!allDatesMode) {
                if (!selectedDate) return false
                const matchesDate = trip.some(item => item.date_pst === selectedDate)
                if (!matchesDate) return false
            }

            const includesStartStation = trip.some(item =>
                isWithinDistance(item.latitude, item.longitude, startLat, startLon, 350)
            )
            if (!includesStartStation) return false

            const movedDuringTrip = !isWithinDistance(
                trip[0].latitude,
                trip[0].longitude,
                trip[trip.length - 1].latitude,
                trip[trip.length - 1].longitude,
                350
            )
            return movedDuringTrip
        })
    }, [graphData, allDatesMode, selectedDate, startLocation])

    const displayTrips = useMemo(() => {
        if (currentTripIndex === -1) return filteredTrips
        const trip = filteredTrips[currentTripIndex]
        return trip ? [trip] : []
    }, [filteredTrips, currentTripIndex])

    useEffect(() => {
        if (currentTripIndex === -1) return
        if (currentTripIndex >= filteredTrips.length) {
            setCurrentTripIndex(filteredTrips.length ? 0 : -1)
        }
    }, [currentTripIndex, filteredTrips.length])

    const totalTimeAtIntersections = useMemo(
        () => locationStats.reduce((sum, loc) => (loc.isIntersection ? sum + loc.timeAtStop : sum), 0),
        [locationStats]
    )

    const totalVehiclesAtIntersections = useMemo(
        () => locationStats.reduce((sum, loc) => (loc.isIntersection ? sum + loc.numVehicles : sum), 0),
        [locationStats]
    )

    const averageIntersectionDurationDisplay = useMemo(() => {
        const avgSeconds = totalTimeAtIntersections / totalVehiclesAtIntersections
        return Number.isFinite(avgSeconds) ? `${avgSeconds.toFixed(2)} (seconds)` : 'No intersection data'
    }, [totalTimeAtIntersections, totalVehiclesAtIntersections])

    const averageFullTripDurationDisplay = useMemo(() => {
        const avgMinutes = totalDurationOfFullTrips / (totalNumberOfFullTrips || 1) / 60
        return Number.isFinite(avgMinutes) ? `${avgMinutes.toFixed(2)} (minutes)` : 'No full trips'
    }, [totalDurationOfFullTrips, totalNumberOfFullTrips])

    const zoomLensStyles = useMemo(
        () => ({
            width: `${LENS_SIZE}px`,
            height: `${LENS_SIZE}px`,
            left: `${zoomLensPosition.left}px`,
            top: `${zoomLensPosition.top}px`,
            backgroundImage: zoomImageUrl,
            backgroundSize: zoomBackgroundSize,
            backgroundPosition: zoomBackgroundPosition,
        }),
        [zoomLensPosition, zoomBackgroundSize, zoomBackgroundPosition, zoomImageUrl]
    )

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

    const updateZoomSnapshot = useCallback(() => {
        if (!graphSvgRef.current || typeof window === 'undefined') return
        const serializer = new XMLSerializer()
        let source = serializer.serializeToString(graphSvgRef.current)
        if (!source.includes('xmlns="http://www.w3.org/2000/svg"')) {
            source = source.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
        }
        const encoded = window.btoa(unescape(encodeURIComponent(source)))
        setZoomImageUrl(`url("data:image/svg+xml;base64,${encoded}")`)
    }, [])

    const handleGraphMouseMove = (event) => {
        if (!isZoomEnabled || !graphSvgRef.current || !graphContainerRef.current || !zoomImageUrl) return

        const svgRect = graphSvgRef.current.getBoundingClientRect()
        const containerRect = graphContainerRef.current.getBoundingClientRect()

        const pointerX = event.clientX - svgRect.left
        const pointerY = event.clientY - svgRect.top

        const clampedX = clamp(pointerX, 0, svgRect.width)
        const clampedY = clamp(pointerY, 0, svgRect.height)

        const bgX = clampedX * ZOOM_FACTOR - LENS_SIZE / 2
        const bgY = clampedY * ZOOM_FACTOR - LENS_SIZE / 2

        setZoomBackgroundSize(`${svgRect.width * ZOOM_FACTOR}px ${svgRect.height * ZOOM_FACTOR}px`)
        setZoomBackgroundPosition(`${-bgX}px ${-bgY}px`)

        const lensLeft = clamp(event.clientX - containerRect.left + CURSOR_OFFSET, 0, containerRect.width - LENS_SIZE)
        const lensTop = clamp(event.clientY - containerRect.top + CURSOR_OFFSET, 0, containerRect.height - LENS_SIZE)

        setZoomLensPosition({ left: lensLeft, top: lensTop })
        setIsZoomLensVisible(true)
    }

    const handleGraphMouseLeave = () => {
        setIsZoomLensVisible(false)
    }

    const toggleZoom = () => {
        setIsZoomEnabled((prev) => !prev)
    }

    useEffect(() => {
        if (!isZoomEnabled) {
            setIsZoomLensVisible(false)
            return
        }
        updateZoomSnapshot()
    }, [isZoomEnabled, displayTrips, updateZoomSnapshot])

    useEffect(() => {
        let ignore = false

        const loadData = async () => {
            setIsLoading(true)
            setGraphData([])
            setCurrentTripIndex(-1)
            setAllDatesMode(false)
            setSelectedDate(null)
            setLocationBlueprint([])
            setLocationStats([])
            setStationDistances([])
            setIntersectionDistances([])
            setTotalDurationOfFullTrips(0)
            setTotalNumberOfFullTrips(0)

            try {
                const datasetResponses = await Promise.all(DATA_FILES.map(fetchJson))
                const combinedData = datasetResponses.flatMap(safeToArray)

                const groupedTrips = Object.values(
                    combinedData.reduce((acc, item) => {
                        if (item.route_id === 'K' && item.direction_id === directionConfig.directionId) {
                            const key = `${item.trip_id}_${item.vehicle_id}_${item.date_pst}`
                            if (!acc[key]) acc[key] = []
                            acc[key].push(item)
                        }
                        return acc
                    }, {})
                )

                const stopsData = await fetchJson('data/stops.json')
                const stopsArray = Array.isArray(stopsData) ? stopsData : Object.values(stopsData)
                const stopsEntry = stopsArray[0]

                const blueprint = directionConfig.locationDefinitions.map((definition) => {
                    const source = definition.isIntersection
                        ? stopsEntry.intersections.stops[definition.intersectionIndex]
                        : stopsEntry[directionConfig.stopsKey].stops[definition.stopIndex]
                    return {
                        isIntersection: definition.isIntersection,
                        name: definition.name,
                        location: source.location,
                        timeAtStop: 0,
                        numVehicles: 0,
                    }
                })

                const path = directionConfig.getPath(stopsEntry.polyline)
                const startCoords = directionConfig.getStartCoordinates(stopsEntry)

                const processedTrips = groupedTrips.map((trip) => {
                    let cumulativeDistance = 0
                    let cumulativeTime = 0
                    const startIdx = findNearestIndex(path, { lat: trip[0].latitude, lon: trip[0].longitude })
                    const startDistance = path[startIdx].shape_dist_traveled

                    return trip.map((point, index, array) => {
                        if (
                            index === 0 ||
                            isWithinDistance(point.latitude, point.longitude, startCoords.lat, startCoords.lon, 350)
                        ) {
                            return {
                                cumulativeDistance: startDistance,
                                cumulativeTime: 0,
                                trip_id: point.trip_id,
                                date_pst: point.date_pst,
                                latitude: point.latitude,
                                longitude: point.longitude,
                                speed: point.speed,
                                vehicle_id: point.vehicle_id,
                            }
                        }

                        const prev = array[index - 1]
                        const time = calculateTimeElapsed(prev.timestamp, point.timestamp)
                        const currIdx = findNearestIndex(path, { lat: point.latitude, lon: point.longitude })
                        cumulativeDistance = path[currIdx].shape_dist_traveled
                        cumulativeTime += time

                        return {
                            cumulativeDistance,
                            cumulativeTime,
                            trip_id: point.trip_id,
                            date_pst: point.date_pst,
                            latitude: point.latitude,
                            longitude: point.longitude,
                            speed: point.speed,
                            vehicle_id: point.vehicle_id,
                        }
                    })
                })

                const stationDistanceEntries = stopsEntry[directionConfig.stopsKey].stops.map((stop) => {
                    const idx = findNearestIndex(path, {
                        lat: stop.location.latitude,
                        lon: stop.location.longitude,
                    })
                    return {
                        cumulativeDistance: path[idx].shape_dist_traveled,
                        stop_id: stop.stop_id,
                        stop_name: stop.stop_name,
                        k_line_index: idx,
                    }
                })

                const intersectionDistanceEntries = stopsEntry.intersections.stops.map((intersection) => {
                    const idx = findNearestIndex(path, {
                        lat: intersection.location.latitude,
                        lon: intersection.location.longitude,
                    })
                    return {
                        cumulativeDistance: path[idx].shape_dist_traveled,
                        intersection_name: intersection.stop_name,
                        k_line_index: idx,
                    }
                })

                const westPortalIndex = findNearestIndex(path, WEST_PORTAL_COORDS)
                const westPortalDist = path[westPortalIndex]?.shape_dist_traveled ?? 0

                if (ignore) return

                setGraphData(processedTrips)
                const dates = [...new Set(combinedData.map((item) => item.date_pst))].sort()
                setAvailableDates(dates)
                setSelectedDate(dates[0] ?? null)
                setLocationBlueprint(blueprint)
                setLocationStats(blueprint.map((loc) => ({ ...loc })))
                setStationDistances(stationDistanceEntries)
                setIntersectionDistances(intersectionDistanceEntries)
                setWestPortalDistance(westPortalDist)
            } catch (error) {
                console.error('Failed to load K Line data', error)
            } finally {
                if (!ignore) {
                    setIsLoading(false)
                }
            }
        }

        loadData()

        return () => {
            ignore = true
        }
    }, [directionKey, directionConfig])

    useEffect(() => {
        const svgElement = graphSvgRef.current
        if (!svgElement) return

        const svg = d3.select(svgElement)
        svg.selectAll('*').remove()

        if (isLoading || !displayTrips.length || !locationBlueprint.length) {
            return
        }

        const flatData = displayTrips.flat()
        if (!flatData.length) {
            setLocationStats(locationBlueprint.map((loc) => ({ ...loc })))
            setTotalDurationOfFullTrips(0)
            setTotalNumberOfFullTrips(0)
            return
        }

        const maxXValue = d3.max(flatData, metricConfig.accessValue)
        const maxYValue = d3.max(flatData, (d) => d?.cumulativeDistance)

        if (!Number.isFinite(maxXValue) || !Number.isFinite(maxYValue)) {
            return
        }

        svg.attr('viewBox', `0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`).attr('preserveAspectRatio', 'xMidYMid meet')

        const xScale = d3
            .scaleLinear()
            .domain([0, maxXValue])
            .range([GRAPH_MARGIN.left, GRAPH_WIDTH - GRAPH_MARGIN.right])

        const yScale = d3
            .scaleLinear()
            .domain([0, maxYValue])
            .range([GRAPH_HEIGHT - GRAPH_MARGIN.bottom, GRAPH_MARGIN.top])

        const line = d3
            .line()
            .x((d) => xScale(metricConfig.accessValue(d)))
            .y((d) => yScale(d?.cumulativeDistance))

        const thresholdDistance = westPortalDistance ?? 0

        if (directionKey === 'inbound') {
            svg.append('rect')
                .attr('x', GRAPH_MARGIN.left)
                .attr('y', yScale(maxYValue))
                .attr('width', GRAPH_WIDTH - GRAPH_MARGIN.left - GRAPH_MARGIN.right)
                .attr('height', yScale(thresholdDistance) - yScale(maxYValue))
                .attr('fill', 'lightgray')
                .attr('opacity', 0.5)
        } else {
            svg.append('rect')
                .attr('x', GRAPH_MARGIN.left)
                .attr('y', yScale(thresholdDistance))
                .attr('width', GRAPH_WIDTH - GRAPH_MARGIN.left - GRAPH_MARGIN.right)
                .attr('height', GRAPH_HEIGHT - GRAPH_MARGIN.bottom - yScale(thresholdDistance))
                .attr('fill', 'lightgray')
                .attr('opacity', 0.5)
        }

        const container = d3.select(graphContainerRef.current)
        let tooltip = container.select('.graph-tooltip')
        if (tooltip.empty()) {
            tooltip = container.append('div').attr('class', 'graph-tooltip')
        }
        tooltip.style('opacity', 0)

        svg.append('g')
            .attr('transform', `translate(0,${GRAPH_HEIGHT - GRAPH_MARGIN.bottom})`)
            .call(d3.axisBottom(xScale).tickFormat(metricConfig.formatTick))

        svg.append('g').attr('transform', `translate(${GRAPH_MARGIN.left},0)`).call(d3.axisLeft(yScale))

        const color = d3.scaleOrdinal(d3.schemeCategory10)
        const stats = locationBlueprint.map((loc) => ({ ...loc, timeAtStop: 0, numVehicles: 0 }))
        let fullTripTotal = 0
        let fullTripDuration = 0

        displayTrips.forEach((trip, index) => {
            let lastStop = null
            let lastPoint = null
            const visited = new Set()
            let leavingStartStation = null

            trip.forEach((point) => {
                const locationMatch = stats.find(({ location }) =>
                    isWithinDistance(
                        point.latitude,
                        point.longitude,
                        location.latitude,
                        location.longitude,
                        VEHICLE_AT_STOP_RADIUS_FEET
                    )
                )

                if (locationMatch) {
                    if (!visited.has(locationMatch.name)) {
                        visited.add(locationMatch.name)
                        locationMatch.numVehicles += 1
                    }

                    if (locationMatch.name === directionConfig.startStationName) {
                        leavingStartStation = point
                    }

                    if (locationMatch.name === directionConfig.endStationName && leavingStartStation) {
                        const tripDuration = point.cumulativeTime - leavingStartStation.cumulativeTime
                        leavingStartStation = null
                        fullTripTotal += 1
                        fullTripDuration += tripDuration
                    }
                }

                if (locationMatch && lastPoint) {
                    const timeDelta = point.cumulativeTime - lastPoint.cumulativeTime
                    if (lastStop === locationMatch && timeDelta > 0) {
                        const distanceFeet = getDistanceInFeet(
                            point.latitude,
                            point.longitude,
                            lastPoint.latitude,
                            lastPoint.longitude
                        )
                        const speedFeetPerSecond = distanceFeet / timeDelta
                        const calculatedSpeed = speedFeetPerSecond * 0.3048

                        if (point.speed < 3.12928 || calculatedSpeed < 3.12928) {
                            locationMatch.timeAtStop += timeDelta
                        }
                    }
                    lastStop = locationMatch
                } else if (locationMatch) {
                    lastStop = locationMatch
                }

                lastPoint = point
            })

            svg.append('path')
                .datum(trip)
                .attr('fill', 'none')
                .attr('stroke', color(index))
                .attr('stroke-width', 1.5)
                .attr('d', line)
        })

        svg.append('text')
            .attr('x', GRAPH_WIDTH / 2)
            .attr('y', GRAPH_HEIGHT - 10)
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .attr('font-weight', 'bold')
            .text(metricConfig.xLabel)

        svg.append('text')
            .attr('x', -(GRAPH_HEIGHT / 2))
            .attr('y', 15)
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .attr('font-weight', 'bold')
            .attr('transform', 'rotate(-90)')
            .text('Distance (miles)')

        const addStationTooltip = (entry, hoverLine) => (event) => {
            hoverLine.attr('stroke-dasharray', null).attr('stroke-width', 2)
            d3.select(`#label-${entry.k_line_index}`).attr('font-weight', 'bold')

            const locationInfo = stats.find((loc) => loc.name === entry.stop_name)
            if (!locationInfo) return

            const avgStopDuration = Number.isFinite(locationInfo.timeAtStop / locationInfo.numVehicles)
                ? (locationInfo.timeAtStop / locationInfo.numVehicles).toFixed(1)
                : '0'

            const [xPos, yPos] = d3.pointer(event, graphContainerRef.current)
            tooltip
                .style('opacity', 1)
                .style('left', `${xPos + 16}px`)
                .style('top', `${yPos - 20}px`)
                .html(
                    `
                        <div><strong>${entry.stop_name}</strong></div>
                        <div>Vehicles: ${locationInfo.numVehicles}</div>
                        <div>Time at stop: ${
                            locationInfo.timeAtStop > 60
                                ? `${(locationInfo.timeAtStop / 60).toFixed(2)}min`
                                : `${locationInfo.timeAtStop.toFixed(1)}s`
                        }</div>
                        <div>Average stop duration: ${avgStopDuration}s</div>
                    `.trim()
                )
        }

        stationDistances.forEach((entry) => {
            const yPosition = yScale(entry.cumulativeDistance)

            const stationLine = svg
                .append('line')
                .attr('x1', GRAPH_MARGIN.left)
                .attr('x2', GRAPH_WIDTH - GRAPH_MARGIN.right)
                .attr('y1', yPosition)
                .attr('y2', yPosition)
                .attr('stroke', 'gray')
                .attr('stroke-dasharray', '4,4')
                .attr('class', 'station-line')

            svg.append('line')
                .attr('x1', GRAPH_MARGIN.left)
                .attr('x2', GRAPH_WIDTH - GRAPH_MARGIN.right)
                .attr('y1', yPosition)
                .attr('y2', yPosition)
                .attr('stroke', 'transparent')
                .attr('stroke-width', 10)
                .on('mouseover', addStationTooltip(entry, stationLine))
                .on('mouseout', () => {
                    stationLine.attr('stroke-dasharray', '4,4').attr('stroke-width', 1)
                    d3.select(`#label-${entry.k_line_index}`).attr('font-weight', 'normal')
                    tooltip.style('opacity', 0)
                })

            svg.append('text')
                .attr('id', `label-${entry.k_line_index}`)
                .attr('x', GRAPH_MARGIN.left - 20)
                .attr('y', yPosition + 3)
                .attr('text-anchor', 'end')
                .attr('font-size', '10px')
                .attr('fill', 'black')
                .text(entry.stop_name)
        })

        intersectionDistances.forEach((entry) => {
            const yPosition = yScale(entry.cumulativeDistance)

            const intersectionLine = svg
                .append('line')
                .attr('x1', GRAPH_MARGIN.left)
                .attr('x2', GRAPH_WIDTH - GRAPH_MARGIN.right)
                .attr('y1', yPosition)
                .attr('y2', yPosition)
                .attr('stroke', 'blue')
                .attr('stroke-dasharray', '4,4')
                .attr('class', 'intersection-line')

            svg.append('line')
                .attr('x1', GRAPH_MARGIN.left)
                .attr('x2', GRAPH_WIDTH - GRAPH_MARGIN.right)
                .attr('y1', yPosition)
                .attr('y2', yPosition)
                .attr('stroke', 'transparent')
                .attr('stroke-width', 10)
                .on('mouseover', (event) => {
                    intersectionLine.attr('stroke-dasharray', null).attr('stroke-width', 2)
                    d3.select(`#label-intersection-${entry.k_line_index}`).attr('font-weight', 'bold')

                    const locationInfo = stats.find((loc) => loc.name === entry.intersection_name)
                    if (!locationInfo) return

                    const avgIntersectionStop = Number.isFinite(locationInfo.timeAtStop / locationInfo.numVehicles)
                        ? (locationInfo.timeAtStop / locationInfo.numVehicles).toFixed(1)
                        : '0'

                    const [xPos, yPos] = d3.pointer(event, graphContainerRef.current)
                    tooltip
                        .style('opacity', 1)
                        .style('left', `${xPos + 16}px`)
                        .style('top', `${yPos - 20}px`)
                        .html(
                            `
                                <div><strong>${entry.intersection_name}</strong></div>
                                <div>Vehicles: ${locationInfo.numVehicles}</div>
                                <div>Time at stop: ${
                                    locationInfo.timeAtStop > 60
                                        ? `${(locationInfo.timeAtStop / 60).toFixed(2)}min`
                                        : `${locationInfo.timeAtStop.toFixed(1)}s`
                                }</div>
                                <div>Average stop duration: ${avgIntersectionStop}s</div>
                            `.trim()
                        )
                })
                .on('mouseout', () => {
                    intersectionLine.attr('stroke-dasharray', '4,4').attr('stroke-width', 1)
                    d3.select(`#label-intersection-${entry.k_line_index}`).attr('font-weight', 'normal')
                    tooltip.style('opacity', 0)
                })

            svg.append('text')
                .attr('id', `label-intersection-${entry.k_line_index}`)
                .attr('x', GRAPH_WIDTH - GRAPH_MARGIN.right + 6)
                .attr('y', yPosition + 3)
                .attr('text-anchor', 'start')
                .attr('font-size', '10px')
                .attr('fill', 'blue')
                .text(entry.intersection_name)
        })

        svg.append('text')
            .attr('id', 'label-intersection')
            .attr('x', GRAPH_WIDTH - GRAPH_MARGIN.right + 6)
            .attr(
                'y',
                directionKey === 'inbound' && maxYValue > 2.7
                    ? yScale(2.7) - 10
                    : yScale(maxYValue) - 10
            )
            .attr('text-anchor', 'start')
            .attr('font-size', '13px')
            .attr('fill', 'blue')
            .attr('font-weight', 'bold')
            .attr('style', 'text-decoration: underline;')
            .text('Intersections')

        svg.append('text')
            .attr('id', 'label-stations')
            .attr('x', GRAPH_MARGIN.left - 20)
            .attr('y', yScale(maxYValue) - 10)
            .attr('text-anchor', 'end')
            .attr('font-size', '13px')
            .attr('fill', 'gray')
            .attr('font-weight', 'bold')
            .attr('style', 'text-decoration: underline;')
            .text('Stations')

        if (directionKey === 'inbound') {
            svg.append('rect')
                .attr('x', GRAPH_WIDTH - GRAPH_MARGIN.right - 95)
                .attr('y', (yScale(maxYValue) + yScale(thresholdDistance)) / 2 - 10)
                .attr('width', 85)
                .attr('height', 20)
                .attr('fill', 'black')
                .attr('opacity', 0.6)

            svg.append('text')
                .attr('x', GRAPH_WIDTH - GRAPH_MARGIN.right - 16)
                .attr('y', (yScale(maxYValue) + yScale(thresholdDistance)) / 2 + 5)
                .attr('text-anchor', 'end')
                .attr('font-size', '14px')
                .attr('fill', 'white')
                .text('Underground')

            svg.append('rect')
                .attr('x', GRAPH_WIDTH - GRAPH_MARGIN.right - 65)
                .attr('y', (yScale(thresholdDistance) + yScale(0)) / 2 - 10)
                .attr('width', 55)
                .attr('height', 20)
                .attr('fill', 'black')
                .attr('opacity', 0.6)

            svg.append('text')
                .attr('x', GRAPH_WIDTH - GRAPH_MARGIN.right - 16)
                .attr('y', (yScale(thresholdDistance) + yScale(0)) / 2 + 5)
                .attr('text-anchor', 'end')
                .attr('font-size', '14px')
                .attr('fill', 'white')
                .text('Surface')
        } else {
            svg.append('rect')
                .attr('x', GRAPH_WIDTH - GRAPH_MARGIN.right - 65)
                .attr('y', (yScale(maxYValue) + yScale(thresholdDistance)) / 2 - 10)
                .attr('width', 55)
                .attr('height', 20)
                .attr('fill', 'black')
                .attr('opacity', 0.6)

            svg.append('text')
                .attr('x', GRAPH_WIDTH - GRAPH_MARGIN.right - 16)
                .attr('y', (yScale(maxYValue) + yScale(thresholdDistance)) / 2 + 5)
                .attr('text-anchor', 'end')
                .attr('font-size', '14px')
                .attr('fill', 'white')
                .text('Surface')

            svg.append('rect')
                .attr('x', GRAPH_WIDTH - GRAPH_MARGIN.right - 95)
                .attr('y', (yScale(thresholdDistance) + yScale(0)) / 2 - 10)
                .attr('width', 85)
                .attr('height', 20)
                .attr('fill', 'black')
                .attr('opacity', 0.6)

            svg.append('text')
                .attr('x', GRAPH_WIDTH - GRAPH_MARGIN.right - 16)
                .attr('y', (yScale(thresholdDistance) + yScale(0)) / 2 + 5)
                .attr('text-anchor', 'end')
                .attr('font-size', '14px')
                .attr('fill', 'white')
                .text('Underground')
        }

        setLocationStats(stats)
        setTotalNumberOfFullTrips(fullTripTotal)
        setTotalDurationOfFullTrips(fullTripDuration)
        updateZoomSnapshot()
    }, [
        directionKey,
        displayTrips,
        intersectionDistances,
        isLoading,
        locationBlueprint,
        metricConfig,
        stationDistances,
        updateZoomSnapshot,
        westPortalDistance,
    ])

    return (
        <div className="d-flex graph-layout">
            <div className="v-container">
                <div className="v-row">
                    <div className="v-col">
                        <div className="v-card">
                            <div className="v-card-title">{title}</div>
                            <div className="v-card-text">
                                <div className="date-button-container">
                                    <div className="button-row">
                                        {availableDates.map((date) => (
                                            <button
                                                key={date}
                                                type="button"
                                                className={`v-btn v-btn-small${
                                                    !allDatesMode && date === selectedDate ? ' active' : ''
                                                }`}
                                                onClick={() => {
                                                    setSelectedDate(date)
                                                    setCurrentTripIndex(-1)
                                                    setAllDatesMode(false)
                                                }}
                                            >
                                                {date.substring(0, 5)}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            className="v-btn v-btn-small"
                                            onClick={() => {
                                                if (!filteredTrips.length) return
                                                setCurrentTripIndex((prev) => {
                                                    if (prev === -1) return 0
                                                    return (prev - 1 + filteredTrips.length) % filteredTrips.length
                                                })
                                            }}
                                        >
                                            Previous Trip
                                        </button>
                                        <button
                                            type="button"
                                            className="v-btn v-btn-small"
                                            onClick={() => {
                                                if (!filteredTrips.length) return
                                                setCurrentTripIndex((prev) => {
                                                    if (prev === -1) return 0
                                                    return (prev + 1) % filteredTrips.length
                                                })
                                            }}
                                        >
                                            Next Trip
                                        </button>
                                        <button
                                            type="button"
                                            className="v-btn v-btn-small"
                                            onClick={() => {
                                                setCurrentTripIndex(-1)
                                                setAllDatesMode(true)
                                            }}
                                        >
                                            Show All Trips
                                        </button>
                                        <span className="trip-indicator">
                                            {currentTripIndex >= 0
                                                ? `Showing Trip ${currentTripIndex + 1} of ${filteredTrips.length}`
                                                : `Showing ${
                                                      allDatesMode ? 'All Trips For All Dates' : 'All Trips'
                                                  } (${filteredTrips.length})`}
                                        </span>
                                    </div>
                                </div>

                                <div className="zoom-controls">
                                    <button
                                        type="button"
                                        className={`v-btn v-btn-small${isZoomEnabled ? ' active' : ''}`}
                                        onClick={toggleZoom}
                                    >
                                        {isZoomEnabled ? 'Disable Zoom' : 'Enable Zoom'}
                                    </button>
                                    {isZoomEnabled && <span className="zoom-hint">Hover over the graph to zoom.</span>}
                                </div>

                                <div
                                    ref={graphContainerRef}
                                    className={`graph-container${isZoomEnabled ? ' zoom-active' : ''}`}
                                    onMouseMove={handleGraphMouseMove}
                                    onMouseLeave={handleGraphMouseLeave}
                                >
                                    {isLoading && (
                                        <div className="loader-overlay">
                                            <div className="loader-spinner" aria-label="Loading data"></div>
                                        </div>
                                    )}
                                    {isZoomEnabled && isZoomLensVisible && (
                                        <div className="zoom-lens" style={zoomLensStyles} />
                                    )}
                                    <svg id="line-graph" ref={graphSvgRef}></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <aside className="rail pa-4">
                <h2 className="totals-header">Totals and Averages</h2>
                <div className="totals-wrapper">
                    <div className="summary-box">
                        <h4>Total time at intersections:</h4>
                        <p>{(totalTimeAtIntersections / 60).toFixed(2)} (minutes)</p>
                    </div>
                    <div className="summary-box">
                        <h4>Average intersection duration:</h4>
                        <p>{averageIntersectionDurationDisplay}</p>
                    </div>
                    <div className="summary-box">
                        <h4>Average full trip duration:</h4>
                        <p>{averageFullTripDurationDisplay}</p>
                    </div>
                    <div className="summary-box">
                        <h4>Total full trips:</h4>
                        <p>{totalNumberOfFullTrips} (vehicles)</p>
                    </div>
                </div>
            </aside>
        </div>
    )
}

export default KLineChart
