<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import * as d3 from 'd3'
import { calculateTimeElapsed, safeToArray, findNearestIndex, isWithinDistance, getDistanceInFeet } from '../utils/helpers.js'

const graphData = ref([])
const currentTripIndex = ref(-1)   // -1 means "show all trips"
const isLoading = ref(true)
const availableDates = ref([])
const selectedDate = ref(null)
const allDatesMode = ref(false)    // Track whether all dates are shown
const westPortalStationIndex = ref(null) // Index of West Portal station in K line path
const westPortalDistance = ref(null) // Distance of West Portal station along K line path
const stationDistances = ref([]) // Distances of all stations along K line path
const intersectionDistances = ref([]) // Distances of intersections along K line path
const locations = ref([]); // Locations of stops and intersections
const vehicleAtStopRadiusFeet = ref(250); // 250 feet radius to consider vehicle at stop
const totalNumberOfFullTrips = ref(0); // Total number of full trips (from start to end station)
const totalDurationOfFullTrips = ref(0); // Total duration of all full trips (from start to end station)

// ✅ All trips in scope (date-filtered OR all dates)
const filteredTrips = computed(() => {
    if (allDatesMode.value) return graphData.value
    if (!selectedDate.value) return []
    return graphData.value.filter(trip =>
        trip.some(item => item.date_pst === selectedDate.value)
    )
})

// ✅ Trips to actually render
const displayTrips = computed(() => {
    if (currentTripIndex.value === -1) return filteredTrips.value
    return [filteredTrips.value[currentTripIndex.value]]
})

// Total sum for time at all intersections (excludes stations)
const totalTimeAtIntersections = computed(() => {
    return locations.value.reduce((sum, loc) => {
        return loc.isIntersection ? sum + loc.timeAtStop : sum
    }, 0)
})

// Total sum for numVehicles at all intersectoins (excludes stations)
const totalNumVehiclesAtIntersections = computed(() => {
    return locations.value.reduce((sum, loc) => {
        return loc.isIntersection ? sum + loc.numVehicles : sum
    }, 0)
})

// Display values for average intersection duration with checks to avoid division by zero
const averageIntersectionDurationDisplay = computed(() => {
    const avgSeconds = totalTimeAtIntersections.value / totalNumVehiclesAtIntersections.value
    return Number.isFinite(avgSeconds) ? `${avgSeconds.toFixed(2)} (seconds)` : 'No intersection data'
})

// Display values for average full trip duration with checks to avoid division by zero
const averageFullTripDurationDisplay = computed(() => {
    const avgMinutes = totalDurationOfFullTrips.value / totalNumberOfFullTrips.value / 60
    return Number.isFinite(avgMinutes) ? `${avgMinutes.toFixed(2)} (minutes)` : 'No full trips'
})

// Handlers
const showPrevTrip = () => {
    if (!filteredTrips.value.length) return
    if (currentTripIndex.value === -1) currentTripIndex.value = 0
    else currentTripIndex.value = (currentTripIndex.value - 1 + filteredTrips.value.length) % filteredTrips.value.length
}
const showNextTrip = () => {
    if (!filteredTrips.value.length) return
    if (currentTripIndex.value === -1) currentTripIndex.value = 0
    else currentTripIndex.value = (currentTripIndex.value + 1) % filteredTrips.value.length
}
const showAllTrips = () => {
    currentTripIndex.value = -1
    allDatesMode.value = true  // ✅ show everything again
}

// shape_id for inbound K line is 9495
// shape_id for outbound K line is 9436

// Load and process the data
onMounted(async () => {
    try {
        // Load data from May 11 to May 16, 2025
        const responses = await Promise.all([
            fetch(`${import.meta.env.BASE_URL}data/gfts_realtime_data_2025-05-11_8-00_PST.json`),
            fetch(`${import.meta.env.BASE_URL}data/gfts_realtime_data_2025-05-12_8-00_PST.json`),
            fetch(`${import.meta.env.BASE_URL}data/gfts_realtime_data_2025-05-13_8-00_PST.json`),
            fetch(`${import.meta.env.BASE_URL}data/gfts_realtime_data_2025-05-14_8-00_PST.json`),
            fetch(`${import.meta.env.BASE_URL}data/gfts_realtime_data_2025-05-15_8-00_PST.json`),
            fetch(`${import.meta.env.BASE_URL}data/gfts_realtime_data_2025-05-16_8-00_PST.json`),
        ])
        const jsonData = await Promise.all(responses.map(r => r.json()))
        const combinedData = jsonData.flatMap(d => safeToArray(d))

        // Group data by trip_id, vehicle_id, and date into a 2D array
        const filteredData = Object.values(
            combinedData.reduce((acc, item) => {
                if (item.route_id === "K" && item.direction_id === 0) { // 0 for outbound
                    const uniqueKey = item.trip_id + '_' + item.vehicle_id + '_' + item.date_pst
                    if (!acc[uniqueKey]) acc[uniqueKey] = []
                    acc[uniqueKey].push(item)
                }
                return acc
            }, {})
        )

        // Load stops.json data
        const stopsResponse = await fetch(`${import.meta.env.BASE_URL}data/stops.json`)
        const stopsData = await stopsResponse.json()
        const stopsArray = Array.isArray(stopsData) ? stopsData : Object.values(stopsData)

        // Array of location objects (intersections and stations), includes total time at each location (timeAtStop) and total number of vehicles (numVehicles)
        locations.value = [
            { isIntersection: false, name: "Balboa Park BART Mezzanine Level", location: stopsArray[0].outbound.stops[19].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: true, name: "Ocean Ave & Balboa Park", location: stopsArray[0].intersections.stops[3].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: true, name: "Howlth St & Ocean Ave", location: stopsArray[0].intersections.stops[1].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Ocean Ave/CCSF Pedestrian Bridge", location: stopsArray[0].outbound.stops[18].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Ocean Ave & Lee St", location: stopsArray[0].outbound.stops[17].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: true, name: "Ocean Ave & Plymouth Ave", location: stopsArray[0].intersections.stops[4].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Ocean Ave & Miramar Ave", location: stopsArray[0].outbound.stops[16].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Ocean Ave & Jules Ave", location: stopsArray[0].outbound.stops[15].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Ocean Ave & Victoria Street", location: stopsArray[0].outbound.stops[14].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: true, name: "Ocean Ave & Cerritos Ave", location: stopsArray[0].intersections.stops[5].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Ocean Ave & Aptos Ave", location: stopsArray[0].outbound.stops[13].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Ocean Ave & San Leandro Way", location: stopsArray[0].outbound.stops[12].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Junipero Serra Blvd & Ocean Ave", location: stopsArray[0].outbound.stops[11].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: true, name: "Junipero Serra Blvd & Monterey Blvd", location: stopsArray[0].intersections.stops[0].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "West Portal Ave & Sloat Blvd", location: stopsArray[0].outbound.stops[10].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: true, name: "West Portal Ave & 15th Ave", location: stopsArray[0].intersections.stops[6].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "West Portal Ave & 14th Ave", location: stopsArray[0].outbound.stops[9].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: true, name: "West Portal Ave & Vicente St", location: stopsArray[0].intersections.stops[2].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "West Portal Station", location: stopsArray[0].outbound.stops[8].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Forest Hill Station", location: stopsArray[0].outbound.stops[7].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Castro Station", location: stopsArray[0].outbound.stops[6].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Church Station", location: stopsArray[0].outbound.stops[5].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Van Ness Station", location: stopsArray[0].outbound.stops[4].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Civic Center Station", location: stopsArray[0].outbound.stops[3].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Powell Station", location: stopsArray[0].outbound.stops[2].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Montgomery Station", location: stopsArray[0].outbound.stops[1].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Embarcadero Station", location: stopsArray[0].outbound.stops[0].location, timeAtStop: 0, numVehicles: 0 },
        ];

        // Lon and Lat of start station (beyond Embarcadero station, using first point on polyline)
        const startStationLongitude = stopsArray[0].polyline.shapeArrayOutbound[0].shape_pt_lon;
        const startStationLatitude = stopsArray[0].polyline.shapeArrayOutbound[0].shape_pt_lat;

        // Get the K line path coordinates
        const kLinePath = stopsArray[0].polyline.shapeArrayOutbound.map(point => ({
            lat: point.shape_pt_lat,
            lon: point.shape_pt_lon,
            shape_dist_traveled: point.shape_dist_traveled
        }));

        // Find and store the index and distance of West Portal station for drawing the underground background
        westPortalStationIndex.value = findNearestIndex(kLinePath, { lat: 37.741171, lon: -122.465609 })
        westPortalDistance.value = kLinePath[westPortalStationIndex.value].shape_dist_traveled

        // Store distances of all stations along K line path
        stationDistances.value = stopsArray[0].outbound.stops.map(stop => {
            const idx = findNearestIndex(kLinePath, { lat: stop.location.latitude, lon: stop.location.longitude })
            return {
                cumulativeDistance: kLinePath[idx].shape_dist_traveled,
                stop_id: stop.stop_id,
                stop_name: stop.stop_name,
                k_line_index: idx
            };
        })

        // Store distances of intersections along K line path
        intersectionDistances.value = stopsArray[0].intersections.stops.map(intersection => {
            const idx = findNearestIndex(kLinePath, { lat: intersection.location.latitude, lon: intersection.location.longitude })
            return {
                cumulativeDistance: kLinePath[idx].shape_dist_traveled,
                intersection_name: intersection.stop_name,
                k_line_index: idx
            };
        })

        // Process each trip to calculate cumulative distance and time
        const allProcessedTrips = filteredData.map((trip) => {
            let cumulativeDistance = 0;
            let cumulativeTime = 0;

            return trip.map((item, index, array) => {
                // If within 350 feet of start station, vehicle is considered at start
                if (index === 0 || isWithinDistance(item.latitude, item.longitude, startStationLatitude, startStationLongitude, 350)) {
                    return { cumulativeDistance: 0, cumulativeTime: 0, trip_id: item.trip_id, date_pst: item.date_pst, latitude: item.latitude, longitude: item.longitude, speed: item.speed, vehicle_id: item.vehicle_id};
                }

                // Calculate time elapsed since last point
                const prev = array[index - 1];
                const time = calculateTimeElapsed(prev.timestamp, item.timestamp);

                // Find nearest point on K line path
                const currIdx = findNearestIndex(kLinePath, { lat: item.latitude, lon: item.longitude });

                cumulativeDistance = kLinePath[currIdx].shape_dist_traveled;
                cumulativeTime += time;

                return {
                    cumulativeDistance,
                    cumulativeTime,
                    trip_id: item.trip_id,
                    date_pst: item.date_pst,
                    latitude: item.latitude,
                    longitude: item.longitude,
                    speed: item.speed,
                    vehicle_id: item.vehicle_id
                };
            });
        });

        graphData.value = allProcessedTrips

        // Collect unique dates
        const dates = [...new Set(combinedData.map(d => d.date_pst))].sort()
        availableDates.value = dates
        selectedDate.value = dates[0] // default to first date
    } finally {
        isLoading.value = false
    }
})

// Update the graph
watch(
    () => displayTrips.value,
    (allTrips) => {
        if (isLoading.value || !allTrips.length) return;

        const svg = d3.select('#line-graph');
        svg.selectAll('*').remove();

        const container = d3.select('.graph-container');
        let tooltip = container.select('.graph-tooltip');
        if (tooltip.empty()) {
            tooltip = container.append('div')
                .attr('class', 'graph-tooltip');
        }
        tooltip.style('opacity', 0);

        const width = 1100;
        const height = 760;
        svg
            .attr('viewBox', `0 0 ${width} ${height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');
        const margin = { top: 20, right: 140, bottom: 50, left: 200 };

        const flatData = allTrips.flat();

        const x = d3.scaleLinear()
            .domain([0, d3.max(flatData, d => d?.cumulativeTime)])
            .range([margin.left, width - margin.right]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(flatData, d => d?.cumulativeDistance)])
            .range([height - margin.bottom, margin.top]);

        const line = d3.line()
            .x(d => x(d?.cumulativeTime))
            .y(d => y(d?.cumulativeDistance));

        const maxYValue = d3.max(flatData, d => d?.cumulativeDistance);

        // Add gray background rectangle for distances <= kLinePath[westPortalStationIndex].shape_dist_traveled
        const thresholdDistance = westPortalDistance.value || 0; // Default to 0 if not found
        svg.append('rect')
            .attr('x', margin.left)
            .attr('y', y(thresholdDistance))
            .attr('width', width - margin.left - margin.right)
            .attr('height', height - margin.bottom - y(thresholdDistance))
            .attr('fill', 'lightgray')
            .attr('opacity', 0.5);

        svg.append('g')
            .attr('transform', `translate(0,${height - margin.bottom})`)
            .call(
                d3.axisBottom(x).tickFormat((d) => {
                    const minutes = Math.floor(d / 60);
                    const seconds = Math.floor(d % 60);
                    return `${minutes}m ${seconds}s`;
                })
            );

        svg.append('g')
            .attr('transform', `translate(${margin.left},0)`)
            .call(d3.axisLeft(y));

        const color = d3.scaleOrdinal(d3.schemeCategory10);

        // Reset timeAtStop and numVehicles for all locations
        locations.value.forEach(location => {
            location.timeAtStop = 0;
            location.numVehicles = 0;
        });

        // Reset total trip counters
        totalNumberOfFullTrips.value = 0;
        totalDurationOfFullTrips.value = 0;

        // Cycle through each individual trip, check if vehicle is at location, and draw svg path
        allTrips.forEach((trip, i) => {
            let lastStop = null; // previous location match in this trip
            let lastPoint = null; // previous point in this trip
            let alreadyVisitedLocations = []; // array or already visited locations
            let leavingFirstTerminalStation = null; // point where the vehicle first leaves the terminal station starting the trip

            // Check each point in the trip against all locations to see where the vehicle is stopped
            trip.forEach((point) => {
                const locationMatch = locations.value.find(({ location }) =>
                    isWithinDistance(point.latitude, point.longitude, location.latitude, location.longitude, vehicleAtStopRadiusFeet.value)
                );

                // If vehicle is at a location
                if (locationMatch) {
                    const seen = alreadyVisitedLocations.some(loc => loc.name === locationMatch.name)

                    // If this is the first time vehicle is at this location during this trip
                    if (!seen) {
                        alreadyVisitedLocations.push(locationMatch);
                        locationMatch.numVehicles += 1; // Increment vehicle count for this location
                    }

                    // If vehicle is at starting terminal station, set leavingFirstTerminalStation to signify start of trip
                    if (locationMatch.name === "Embarcadero Station") {
                        leavingFirstTerminalStation = point;
                    }

                    // If vehicle is at ending terminal station, and left starting terminal station in same trip, compute trip duration
                    if (locationMatch.name === "Balboa Park BART Mezzanine Level" && leavingFirstTerminalStation) {
                        const tripDuration = point.cumulativeTime - leavingFirstTerminalStation.cumulativeTime;
                        leavingFirstTerminalStation = null; // reset for next trip
                        totalNumberOfFullTrips.value += 1;
                        totalDurationOfFullTrips.value += tripDuration;
                    }
                }

                // If vehicle is at the same location as last point, accumulate time at stop
                if (locationMatch && lastPoint) {
                    const time = point.cumulativeTime - lastPoint.cumulativeTime;
                    let calculatedSpeed = null;

                    // If vehicle is at same stop as last point
                    if (lastStop === locationMatch) {
                        // Calculate speed since last point
                        const distanceFeet = getDistanceInFeet(point.latitude, point.longitude, lastPoint.latitude, lastPoint.longitude);
                        const speedFeetPerSecond = distanceFeet / time;
                        calculatedSpeed = speedFeetPerSecond * 0.3048; // Convert to m/s

                        // If vehicle speed is less that 7mph
                        if (point.speed < 3.12928 || calculatedSpeed < 3.12928) { // 7mph in m/s
                            locationMatch.timeAtStop += time;
                        }
                    }
                    lastStop = locationMatch;
                }
                lastPoint = point;
            });

            svg.append('path')
                .datum(trip)
                .attr('fill', 'none')
                .attr('stroke', color(i))
                .attr('stroke-width', 1.5)
                .attr('d', line);
        });

        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height - 10)
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .attr('font-weight', 'bold')
            .text('Time (seconds)');

        svg.append('text')
            .attr('x', -(height / 2))
            .attr('y', 15)
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .attr('font-weight', 'bold')
            .attr('transform', 'rotate(-90)')
            .text('Distance (miles)');

        // Add horizontal lines and labels for station distances
        stationDistances.value.forEach(entry => {
            const yPosition = y(entry.cumulativeDistance);

            // Add the actual horizontal line
            const line = svg.append('line')
                .attr('x1', margin.left)
                .attr('x2', width - margin.right)
                .attr('y1', yPosition)
                .attr('y2', yPosition)
                .attr('stroke', 'gray')
                .attr('stroke-dasharray', '4,4')
                .attr('class', 'station-line');

            // Add an invisible line for easier hover detection
            svg.append('line')
                .attr('x1', margin.left)
                .attr('x2', width - margin.right)
                .attr('y1', yPosition)
                .attr('y2', yPosition)
                .attr('stroke', 'transparent') // Invisible line
                .attr('stroke-width', 10) // Wider hover area
                .on('mouseover', function (event) {
                    line.attr('stroke-dasharray', null) // Remove dashed style
                        .attr('stroke-width', 2); // Make the line thicker

                    d3.select(`#label-${entry.k_line_index}`)
                        .attr('font-weight', 'bold'); // Bold the corresponding label

                    const locationInfo = locations.value.find(loc => loc.name === entry.stop_name);
                    if (!locationInfo) return;

                    // Check if numVehicles is zero to avoid division by zero
                    const avgStopDuration = Number.isFinite(locationInfo.timeAtStop / locationInfo.numVehicles)
                        ? (locationInfo.timeAtStop / locationInfo.numVehicles).toFixed(1)
                        : '0';

                    const [xPos, yPos] = d3.pointer(event, container.node());
                    tooltip
                        .style('opacity', 1)
                        .style('left', `${xPos + 16}px`)
                        .style('top', `${yPos - 20}px`)
                        .html(`
                            <div><strong>${entry.stop_name}</strong></div>
                            <div>Vehicles: ${locationInfo.numVehicles}</div>
                            <div>Time at stop: ${locationInfo.timeAtStop > 60 ? `${(locationInfo.timeAtStop / 60).toFixed(2)}min` : `${locationInfo.timeAtStop.toFixed(1)}s`}</div>
                            <div>Average stop duration: ${avgStopDuration}s</div>
                        `.trim());
                })
                .on('mouseout', function () {
                    line.attr('stroke-dasharray', '4,4') // Restore dashed style
                        .attr('stroke-width', 1); // Restore original width

                    d3.select(`#label-${entry.k_line_index}`)
                        .attr('font-weight', 'normal'); // Restore normal font weight

                    tooltip.style('opacity', 0);
                });

            // Add label
            svg.append('text')
                .attr('id', `label-${entry.k_line_index}`) // Add an ID for easier selection
                .attr('x', margin.left - 20) // Position to the left of the graph
                .attr('y', yPosition + 3) // Slightly above the line
                .attr('text-anchor', 'end') // Align text to the end (right)
                .attr('font-size', '10px')
                .attr('fill', 'black')
                .text(entry.stop_name);
        });

        // Add horizontal lines and labels for intersection distances
        intersectionDistances.value.forEach(entry => {
            const yPosition = y(entry.cumulativeDistance);

            // Add the actual horizontal line
            const line = svg.append('line')
                .attr('x1', margin.left)
                .attr('x2', width - margin.right)
                .attr('y1', yPosition)
                .attr('y2', yPosition)
                .attr('stroke', 'blue')
                .attr('stroke-dasharray', '4,4')
                .attr('class', 'intersection-line');

            // Add an invisible line for easier hover detection
            svg.append('line')
                .attr('x1', margin.left)
                .attr('x2', width - margin.right)
                .attr('y1', yPosition)
                .attr('y2', yPosition)
                .attr('stroke', 'transparent') // Invisible line
                .attr('stroke-width', 10) // Wider hover area
                .on('mouseover', function (event) {
                    line.attr('stroke-dasharray', null) // Remove dashed style
                        .attr('stroke-width', 2); // Make the line thicker

                    d3.select(`#label-intersection-${entry.k_line_index}`)
                        .attr('font-weight', 'bold'); // Bold the corresponding label

                    const locationInfo = locations.value.find(loc => loc.name === entry.intersection_name);
                    if (!locationInfo) return;

                    // Check if numVehicles is greater than 0 to avoid division by zero
                    const avgIntersectionStop = Number.isFinite(locationInfo.timeAtStop / locationInfo.numVehicles)
                        ? (locationInfo.timeAtStop / locationInfo.numVehicles).toFixed(1)
                        : '0';

                    const [xPos, yPos] = d3.pointer(event, container.node());
                    tooltip
                        .style('opacity', 1)
                        .style('left', `${xPos + 16}px`)
                        .style('top', `${yPos - 20}px`)
                        .html(`
                            <div><strong>${entry.intersection_name}</strong></div>
                            <div>Vehicles: ${locationInfo.numVehicles}</div>
                            <div>Time at stop: ${locationInfo.timeAtStop > 60 ? `${(locationInfo.timeAtStop / 60).toFixed(2)}min` : `${locationInfo.timeAtStop.toFixed(1)}s`}</div>
                            <div>Average stop duration: ${avgIntersectionStop}s</div>
                        `.trim());
                })
                .on('mouseout', function () {
                    line.attr('stroke-dasharray', '4,4') // Restore dashed style
                        .attr('stroke-width', 1); // Restore original width

                    d3.select(`#label-intersection-${entry.k_line_index}`)
                        .attr('font-weight', 'normal'); // Restore normal font weight

                    tooltip.style('opacity', 0);
                });

            // Add label
            svg.append('text')
                .attr('id', `label-intersection-${entry.k_line_index}`) // Add an ID for easier selection
                .attr('x', width - margin.right + 6) // Position to the right of the graph
                .attr('y', yPosition + 3) // Slightly above the line
                .attr('text-anchor', 'start') // Align text to the start (left)
                .attr('font-size', '10px')
                .attr('fill', 'blue')
                .text(entry.intersection_name);
        });

        // Add "Intersections" label
        svg.append('text')
            .attr('id', `label-intersection`) // Add an ID for easier selection
            .attr('x', width - margin.right + 6) // Position to the right of the graph
            .attr('y', y(maxYValue) - 10) // Above last intersection line
            .attr('text-anchor', 'start') // Align text to the start (left)
            .attr('font-size', '13px')
            .attr('fill', 'blue')
            .attr('font-weight', 'bold')
            .attr('style', 'text-decoration: underline;')
            .text("Intersections");

        // Add "Stations" label
        svg.append('text')
            .attr('id', `label-stations`) // Add an ID for easier selection
            .attr('x', margin.left - 20) // Position to the left of the graph
            .attr('y', y(maxYValue) - 10) // Above last station line
            .attr('text-anchor', 'end') // Align text to the end (right)
            .attr('font-size', '13px')
            .attr('fill', 'gray')
            .attr('font-weight', 'bold')
            .attr('style', 'text-decoration: underline;')
            .text("Stations");

        // Add "Underground" label with background
        svg.append('rect')
            .attr('x', width - margin.right - 65) // Adjust position to align with text
            .attr('y', (y(maxYValue) + y(thresholdDistance)) / 2 - 10) // Center vertically and adjust for text height
            .attr('width', 55) // Width of the background rectangle
            .attr('height', 20) // Height of the background rectangle
            .attr('fill', 'black')
            .attr('opacity', 0.6);

        svg.append('text')
            .attr('x', width - margin.right - 16) // Right-aligned
            .attr('y', (y(maxYValue) + y(thresholdDistance)) / 2 + 5) // Vertically centered on the gray background
            .attr('text-anchor', 'end') // Align text to the end (right)
            .attr('font-size', '14px')
            .attr('fill', 'white') // Text color to contrast with the black background
            .text('Surface');

        // Add "Surface" label with background
        svg.append('rect')
            .attr('x', width - margin.right - 95) // Adjust position to align with text
            .attr('y', (y(thresholdDistance) + y(0)) / 2 - 10) // Center vertically and adjust for text height
            .attr('width', 85) // Width of the background rectangle
            .attr('height', 20) // Height of the background rectangle
            .attr('fill', 'black')
            .attr('opacity', 0.6);

        svg.append('text')
            .attr('x', width - margin.right - 16) // Right-aligned
            .attr('y', (y(thresholdDistance) + y(0)) / 2 + 5) // Vertically centered on the rest of the graph
            .attr('text-anchor', 'end') // Align text to the end (right)
            .attr('font-size', '14px')
            .attr('fill', 'white') // Text color to contrast with the black background
            .text('Underground');
    },
    { immediate: true }
);
</script>

<template>
    <div class="d-flex">
        <v-container>
            <v-row>
                <v-col>
                    <v-card>
                        <v-card-title>
                            Tenco CityScale K Line Intersection Delays For Outbound K Line (Distance vs Time)
                        </v-card-title>
                        <v-card-text>
                            <!-- Date filter buttons -->
                            <div class="date-button-container mb-4 flex gap-2">
                                <v-btn
                                    v-for="date in availableDates"
                                    class="mr-2"
                                    size="small"
                                    :key="date"
                                    :color="(!allDatesMode && date === selectedDate) ? 'primary' : 'secondary'"
                                    @click="selectedDate = date; currentTripIndex = -1; allDatesMode = false"
                                >
                                    {{ date.substring(0, 5) }}
                                </v-btn>
                                <v-btn class="mr-2" size="small" color="prev" @click="showPrevTrip">Previous Trip</v-btn>
                                <v-btn class="mr-2" size="small" color="next" @click="showNextTrip">Next Trip</v-btn>
                                <v-btn class="mr-2" size="small" color="all" @click="showAllTrips">Show All Trips</v-btn>
                                <span v-if="currentTripIndex >= 0">
                                    Showing Trip {{ currentTripIndex + 1 }} of {{ filteredTrips.length }}
                                </span>
                                <span v-else>
                                    Showing {{ allDatesMode ? 'All Trips For All Dates' : 'All Trips' }} ({{ filteredTrips.length }})
                                </span>
                            </div>

                            <!-- Trip navigation -->
                            <div class="mb-4 flex gap-2">
                    
                            </div>

                            <!-- Graph container with loader overlay -->
                            <div class="graph-container relative">
                                <div
                                    v-if="isLoading"
                                    id="loader"
                                    class="absolute inset-0 flex items-center justify-center z-10"
                                >
                                    <v-progress-circular
                                        indeterminate
                                        color="primary"
                                        size="64"
                                    />
                                </div>
                                <svg id="line-graph"></svg>
                            </div>
                        </v-card-text>
                    </v-card>
                </v-col>
            </v-row>
        </v-container>

        <!-- Right Rail -->
        <div class="rail pa-4">
            <h2 class="totals-header">Totals and Averages</h2>
            <div class="totals-wrapper">
                <div class="summary-box">
                    <h4>Total time at intersections:</h4>
                    <p>{{ (totalTimeAtIntersections / 60).toFixed(2) }} (minutes)</p>
                </div>
                <div class="summary-box">
                    <h4>Average intersection duration:</h4>
                    <p>{{ averageIntersectionDurationDisplay }}</p>
                </div>
                <div class="summary-box">
                    <h4>Average full trip duration:</h4>
                    <p>{{ averageFullTripDurationDisplay }}</p>
                </div>
                <div class="summary-box">
                    <h4>Total full trips:</h4>
                    <p>{{ totalNumberOfFullTrips }} (vehicles)</p>
                </div>
            </div>
        </div>
    </div>
</template>

<style>

.v-container {
    padding: 0;
}

div.v-card-title {
    padding-bottom: 4px;
    margin: 0 16px 12px;
    border-bottom: 1px solid #010101;
    padding-left: 0;
    text-align: left;
    font-size: 1.5rem;
}

.v-card-text div span {
    display: inline-block;
    max-width: 10rem;
}

.v-card-text > div:first-of-type {
    display: flex;
    justify-content: start;
    align-items: center;
}

.v-progress-circular, #loader, .v-card-text, .v-card {
    background-color: #f9f8f7;
}

div.v-col {
    padding: 0;
}

.graph-container {
    position: relative;
    width: 100%;
    max-width: 1200px;
    aspect-ratio: 1100 / 760;
}

.graph-container svg {
    width: 100%;
    height: 100%;
}

.graph-tooltip {
    position: absolute;
    pointer-events: none;
    background: rgba(0, 0, 0, 0.8);
    color: #fff;
    padding: 0.35rem 0.5rem;
    border-radius: 4px;
    font-size: 14px;
    line-height: 1.2;
    white-space: nowrap;
}

.graph-tooltip strong {
    display: block;
    margin-bottom: 0.15rem;
}

.rail {
    background-color: #f9f8f7;
    color: #010101;
    margin: 4px 4px 4px 0;
    border-radius: 4px;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
}

.totals-wrapper {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-end;
}

.summary-box {
    margin-bottom: 32px;
    padding: 0;
    border-radius: 3px;
    border: 1px solid #010101;
    background-color: #fff;
    box-shadow: 0 0 6px 4px rgba(0, 0, 0, 0.05);
    width: 100%;
}

.summary-box h4 {
    line-height: 1.125rem;
    padding: 8px;
    background-color: #f0f0f0;
    border-bottom: 1px solid #d3d3d3;
    border-radius: 3px;
}

.summary-box p {
    padding: 8px 0;
    line-height: 1.125rem;
}

.v-container.v-container {
    max-width: none;
}

.date-button-container {
    padding-bottom: 16px;
    border-bottom: 1px solid #010101;
}
</style>
