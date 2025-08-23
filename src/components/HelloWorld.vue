<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import * as d3 from 'd3'
import { calculateDistance, calculateTimeElapsed, arePointsWithin350Feet, safeToArray } from '../utils/helpers.js'

const graphData = ref([])
const currentTripIndex = ref(-1)   // -1 means "show all trips"
const isLoading = ref(true)
const availableDates = ref([])
const selectedDate = ref(null)
const allDatesMode = ref(false)    // NEW: track whether all dates are shown

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

        const stopsResponse = await fetch(`${import.meta.env.BASE_URL}data/stops.json`)
        const stopsData = await stopsResponse.json()
        const stopsArray = Array.isArray(stopsData) ? stopsData : Object.values(stopsData)

        const startStationLongitude = stopsArray[0].inbound.stops[0].location.longitude;
        const startStationLatitude = stopsArray[0].inbound.stops[0].location.latitude;

        const allProcessedTrips = filteredData.map((trip) => {
            let cumulativeDistance = 0;
            let cumulativeTime = 0;

            return trip.map((item, index, array) => {
                if (index === 0 || arePointsWithin350Feet(item.latitude, item.longitude, startStationLatitude, startStationLongitude)) {
                    return { cumulativeDistance: 0, cumulativeTime: 0, trip_id: item.trip_id, date_pst: item.date_pst };
                }

                const prev = array[index - 1];
                const distance = calculateDistance(
                    prev.latitude,
                    prev.longitude,
                    item.latitude,
                    item.longitude
                );
                const time = calculateTimeElapsed(prev.timestamp, item.timestamp);

                cumulativeDistance += distance;
                cumulativeTime += time;

                return {
                    cumulativeDistance,
                    cumulativeTime,
                    trip_id: item.trip_id,
                    date_pst: item.date_pst,
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
        const height = window.innerHeight * 0.8;
        const margin = { top: 20, right: 30, bottom: 50, left: 60 };

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

        allTrips.forEach((trip, i) => {
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
            .text('Cumulative Time (seconds)');

        svg.append('text')
            .attr('x', -(height / 2))
            .attr('y', 15)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .attr('transform', 'rotate(-90)')
            .text('Cumulative Distance (meters)');
    },
    { immediate: true }
);
</script>

<template>
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
                                :key="date"
                                :color="(!allDatesMode && date === selectedDate) ? 'primary' : 'secondary'"
                                @click="selectedDate = date; currentTripIndex = -1; allDatesMode = false"
                            >
                                {{ date }}
                            </v-btn>
                        </div>

                        <!-- Trip navigation -->
                        <div class="mb-4 flex gap-2">
                            <v-btn class="mr-2" color="primary" @click="showPrevTrip">Previous Trip</v-btn>
                            <v-btn class="mr-2" color="primary" @click="showNextTrip">Next Trip</v-btn>
                            <v-btn class="mr-2" color="secondary" @click="showAllTrips">Show All Trips</v-btn>
                            <span v-if="currentTripIndex >= 0">
                                Showing Trip {{ currentTripIndex + 1 }} of {{ filteredTrips.length }}
                            </span>
                            <span v-else>
                                Showing {{ allDatesMode ? 'All Trips Across All Dates' : 'All Trips' }} ({{ filteredTrips.length }})
                            </span>
                        </div>

                        <!-- Graph container with loader overlay -->
                        <div class="graph-container relative" style="width:1100px; height:80vh;">
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
                            <svg id="line-graph" width="1100" height="100%"></svg>
                        </div>
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>
    </v-container>
</template>
