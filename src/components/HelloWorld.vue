<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import * as d3 from 'd3'
import { calculateTimeElapsed, arePointsWithin350Feet, safeToArray, findNearestIndex, isWithinDistance, getDistanceInFeet } from '../utils/helpers.js'

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
                if (item.route_id === "K" && item.direction_id === 1) {
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
            { isIntersection: false, name: "San Jose & Geneva Ave", location: stopsArray[0].inbound.stops[0].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: true, name: "Ocean Ave & Balboa Park", location: stopsArray[0].intersections.stops[3].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: true, name: "Howlth St & Ocean Ave", location: stopsArray[0].intersections.stops[1].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Ocean Ave/CCSF Pedestrian Bridge", location: stopsArray[0].inbound.stops[1].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Ocean Ave & Lee St", location: stopsArray[0].inbound.stops[2].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: true, name: "Ocean Ave & Plymouth Ave", location: stopsArray[0].intersections.stops[4].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Ocean Ave & Miramar Ave", location: stopsArray[0].inbound.stops[3].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Ocean Ave & Dorado Ter", location: stopsArray[0].inbound.stops[4].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Ocean Ave & Fairfield Way", location: stopsArray[0].inbound.stops[5].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: true, name: "Ocean Ave & Cerritos Ave", location: stopsArray[0].intersections.stops[5].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Ocean Ave & Aptos Ave", location: stopsArray[0].inbound.stops[6].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Ocean Ave & San Leandro Way", location: stopsArray[0].inbound.stops[7].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Junipero Serra Blvd & Ocean Ave", location: stopsArray[0].inbound.stops[8].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: true, name: "Junipero Serra Blvd & Monterey Blvd", location: stopsArray[0].intersections.stops[0].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "West Portal Ave & Sloat Blvd", location: stopsArray[0].inbound.stops[9].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: true, name: "West Portal Ave & 15th Ave", location: stopsArray[0].intersections.stops[6].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "West Portal Ave & 14th Ave", location: stopsArray[0].inbound.stops[10].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: true, name: "West Portal Ave & Vicente St", location: stopsArray[0].intersections.stops[2].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "West Portal Station", location: stopsArray[0].inbound.stops[11].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Forest Hill Station", location: stopsArray[0].inbound.stops[12].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Castro Station", location: stopsArray[0].inbound.stops[13].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Church Station", location: stopsArray[0].inbound.stops[14].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Van Ness Station", location: stopsArray[0].inbound.stops[15].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Civic Center Station", location: stopsArray[0].inbound.stops[16].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Powell Station", location: stopsArray[0].inbound.stops[17].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Montgomery Station", location: stopsArray[0].inbound.stops[18].location, timeAtStop: 0, numVehicles: 0 },
            { isIntersection: false, name: "Embarcadero Station", location: stopsArray[0].inbound.stops[19].location, timeAtStop: 0, numVehicles: 0 },
        ];

        // Lon and Lat of start station (San Jose and Geneva)
        const startStationLongitude = stopsArray[0].inbound.stops[0].location.longitude;
        const startStationLatitude = stopsArray[0].inbound.stops[0].location.latitude;

        // Get the K line path coordinates
        const kLinePath = stopsArray[0].polyline.shapeArray.map(point => ({
            lat: point.shape_pt_lat,
            lon: point.shape_pt_lon,
            shape_dist_traveled: point.shape_dist_traveled
        }));

        // Find and store the index and distance of West Portal station for drawing the underground background
        westPortalStationIndex.value = findNearestIndex(kLinePath, { lat: 37.741171, lon: -122.465609 })
        westPortalDistance.value = kLinePath[westPortalStationIndex.value].shape_dist_traveled

        // Store distances of all stations along K line path
        stationDistances.value = stopsArray[0].inbound.stops.map(stop => {
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
                if (index === 0 || arePointsWithin350Feet(item.latitude, item.longitude, startStationLatitude, startStationLongitude)) {
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

        const width = 1100;
        const height = 760;
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

        // Add gray background rectangle for distances >= kLinePath[westPortalStationIndex].shape_dist_traveled
        const thresholdDistance = westPortalDistance.value || 0; // Default to 0 if not found
        svg.append('rect')
            .attr('x', margin.left)
            .attr('y', y(maxYValue))
            .attr('width', width - margin.left - margin.right)
            .attr('height', y(thresholdDistance) - y(maxYValue))
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

        const vehicleAtStopRadiusFeet = 250; // 250 feet radius to consider vehicle at stop

        allTrips.forEach((trip, i) => {
            let lastStop = null;
            let lastPoint = null;
            let alreadyVisitedLocations = [];

            // Check each point in the trip against all locations to see where the vehicle is stopped
            trip.forEach((point) => {
                const locationMatch = locations.value.find(({ location }) =>
                    isWithinDistance(point.latitude, point.longitude, location.latitude, location.longitude, vehicleAtStopRadiusFeet)
                );

                // If vehicle is at a location
                if (locationMatch) {
                    const seen = alreadyVisitedLocations.some(loc => loc.name === locationMatch.name)

                    // If this is the first time vehicle is at this location during this trip
                    if (!seen) {
                        alreadyVisitedLocations.push(locationMatch);
                        locationMatch.numVehicles += 1; // Increment vehicle count for this location
                    }
                }

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
            .attr('font-size', '12px')
            .text('Time (seconds)');

        svg.append('text')
            .attr('x', -(height / 2))
            .attr('y', 15)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
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
                .on('mouseover', function () {
                    line.attr('stroke-dasharray', null) // Remove dashed style
                        .attr('stroke-width', 2); // Make the line thicker

                    d3.select(`#label-${entry.k_line_index}`)
                        .attr('font-weight', 'bold'); // Bold the corresponding label
                })
                .on('mouseout', function () {
                    line.attr('stroke-dasharray', '4,4') // Restore dashed style
                        .attr('stroke-width', 1); // Restore original width

                    d3.select(`#label-${entry.k_line_index}`)
                        .attr('font-weight', 'normal'); // Restore normal font weight
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
                .on('mouseover', function () {
                    line.attr('stroke-dasharray', null) // Remove dashed style
                        .attr('stroke-width', 2); // Make the line thicker

                    d3.select(`#label-intersection-${entry.k_line_index}`)
                        .attr('font-weight', 'bold'); // Bold the corresponding label
                })
                .on('mouseout', function () {
                    line.attr('stroke-dasharray', '4,4') // Restore dashed style
                        .attr('stroke-width', 1); // Restore original width

                    d3.select(`#label-intersection-${entry.k_line_index}`)
                        .attr('font-weight', 'normal'); // Restore normal font weight
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
            .attr('y', 
                (2.7 < maxYValue ? y(2.7) - 10 : y(maxYValue) - 10)
            ) // Above last intersection line
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
            .attr('x', width - margin.right - 110) // Adjust position to align with text
            .attr('y', (y(maxYValue) + y(thresholdDistance)) / 2 - 10) // Center vertically and adjust for text height
            .attr('width', 100) // Width of the background rectangle
            .attr('height', 20) // Height of the background rectangle
            .attr('fill', 'black')
            .attr('opacity', 0.6);

        svg.append('text')
            .attr('x', width - margin.right - 16) // Right-aligned
            .attr('y', (y(maxYValue) + y(thresholdDistance)) / 2 + 5) // Vertically centered on the gray background
            .attr('text-anchor', 'end') // Align text to the end (right)
            .attr('font-size', '14px')
            .attr('fill', 'white') // Text color to contrast with the black background
            .text('Underground');

        // Add "Surface" label with background
        svg.append('rect')
            .attr('x', width - margin.right - 76) // Adjust position to align with text
            .attr('y', (y(thresholdDistance) + y(0)) / 2 - 10) // Center vertically and adjust for text height
            .attr('width', 66) // Width of the background rectangle
            .attr('height', 20) // Height of the background rectangle
            .attr('fill', 'black')
            .attr('opacity', 0.6);

        svg.append('text')
            .attr('x', width - margin.right - 16) // Right-aligned
            .attr('y', (y(thresholdDistance) + y(0)) / 2 + 5) // Vertically centered on the rest of the graph
            .attr('text-anchor', 'end') // Align text to the end (right)
            .attr('font-size', '14px')
            .attr('fill', 'white') // Text color to contrast with the black background
            .text('Surface');
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
                            Tenco CityScale K Line Intersection Delays For Inbound K Line
                        </v-card-title>
                        <v-card-text>
                            <!-- Date filter buttons -->
                            <div class="mb-4 flex gap-2">
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
                            <div class="graph-container relative" style="height:760px;">
                                <div
                                    v-if="isLoading"
                                    id="loader"
                                    class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-10"
                                >
                                    <v-progress-circular
                                        indeterminate
                                        color="primary"
                                        size="64"
                                    />
                                </div>
                                <svg id="line-graph" width="1200" height="100%"></svg>
                            </div>
                        </v-card-text>
                    </v-card>
                </v-col>
            </v-row>
        </v-container>

        <!-- Right Rail -->
        <div class="rail pa-4">
            <div class="totals-wrapper">
                <h4>Total time at intersections</h4>
                <p>{{ totalTimeAtIntersections }} (seconds)</p>
                <h4>Average intersection duration</h4>
                <p>{{ (totalTimeAtIntersections / totalNumVehiclesAtIntersections).toFixed(2) }} (seconds)</p>
            </div>
        </div>
    </div>
</template>

<style>

.v-container {
    padding: 0;
}

div.v-card-title {
    padding-bottom: 1rem;
}

.v-card-text div span {
    display: inline-block;
    max-width: 10rem;
}

.v-card-text > div:first-of-type {
    display: flex;
    justify-content: center;
    align-items: center;
}

div.v-col {
    padding: 0;
}

</style>