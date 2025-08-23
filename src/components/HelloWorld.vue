<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import * as d3 from 'd3'
import { calculateDistance, calculateTimeElapsed, arePointsWithin350Feet, safeToArray } from '../utils/helpers.js'

defineProps({
    msg: String,
})

const graphData = ref([])
const currentTripIndex = ref(-1)   // -1 means "show all trips"
const isLoading = ref(true)        // NEW: loading state

// Decide which trips to display: either all or one
const displayTrips = computed(() => {
    if (currentTripIndex.value === -1) return graphData.value
    return [graphData.value[currentTripIndex.value]]
})

// Load and process the data
onMounted(async () => {
    try {
        // Load data from may 11 to may 16, 2025
        const responseDayOne = await fetch(`${import.meta.env.BASE_URL}data/gfts_realtime_data_2025-05-11_8-00_PST.json`)
        const responseDayTwo = await fetch(`${import.meta.env.BASE_URL}data/gfts_realtime_data_2025-05-12_8-00_PST.json`)
        const responseDayThree = await fetch(`${import.meta.env.BASE_URL}data/gfts_realtime_data_2025-05-13_8-00_PST.json`)
        const responseDayFour = await fetch(`${import.meta.env.BASE_URL}data/gfts_realtime_data_2025-05-14_8-00_PST.json`)
        const responseDayFive = await fetch(`${import.meta.env.BASE_URL}data/gfts_realtime_data_2025-05-15_8-00_PST.json`)
        const responseDaySix = await fetch(`${import.meta.env.BASE_URL}data/gfts_realtime_data_2025-05-16_8-00_PST.json`)
        const dataDayOne = await responseDayOne.json()
        const dataDayTwo = await responseDayTwo.json()
        const dataDayThree = await responseDayThree.json()
        const dataDayFour = await responseDayFour.json()
        const dataDayFive = await responseDayFive.json()
        const dataDaySix = await responseDaySix.json()

        // Convert the JSON object into an array
        const dataArrayDayOne = safeToArray(dataDayOne)
        const dataArrayDayTwo = safeToArray(dataDayTwo)
        const dataArrayDayThree = safeToArray(dataDayThree)
        const dataArrayDayFour = safeToArray(dataDayFour)
        const dataArrayDayFive = safeToArray(dataDayFive)
        const dataArrayDaySix = safeToArray(dataDaySix)

        const combinedData = [ 
            ...dataArrayDayOne,
            ...dataArrayDayTwo,
            ...dataArrayDayThree,
            ...dataArrayDayFour,
            ...dataArrayDayFive,
            ...dataArrayDaySix
        ];

        // Group data by trip_id, vehicle_id, and date into a 2D array
        const filteredData = Object.values(
            combinedData.reduce((acc, item) => {
                if (item.route_id === "K" && item.direction_id === 1) {
                    const uniqueKey = item.trip_id + '_' + item.vehicle_id + '_' + item.date_pst
                    if (!acc[uniqueKey]) {
                        acc[uniqueKey] = []
                    }
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
                    return { cumulativeDistance: 0, cumulativeTime: 0 };
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
                };
            });
        });

        graphData.value = allProcessedTrips
    } finally {
        isLoading.value = false  // ✅ stop loading whether success or error
    }
})

// Update the graph to use cumulative values
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

// Handlers
const showPrevTrip = () => {
    if (!graphData.value.length) return
    if (currentTripIndex.value === -1) currentTripIndex.value = 0
    else currentTripIndex.value = (currentTripIndex.value - 1 + graphData.value.length) % graphData.value.length
}
const showNextTrip = () => {
    if (!graphData.value.length) return
    if (currentTripIndex.value === -1) currentTripIndex.value = 0
    else currentTripIndex.value = (currentTripIndex.value + 1) % graphData.value.length
}
const showAllTrips = () => {
    currentTripIndex.value = -1
}
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
                        <div class="mb-4 flex gap-2">
                            <v-btn color="primary" @click="showPrevTrip">Previous Trip</v-btn>
                            <v-btn color="primary" @click="showNextTrip">Next Trip</v-btn>
                            <v-btn color="secondary" @click="showAllTrips">Show All Trips</v-btn>
                            <span v-if="currentTripIndex >= 0">
                                Showing Trip {{ currentTripIndex + 1 }} of {{ graphData.length }}
                            </span>
                            <span v-else>
                                Showing All Trips ({{ graphData.length }})
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

<style scoped>
.v-btn {
    margin-right: 12px;
}
.graph-container {
    position: relative;
}
#loader {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
}
</style>
